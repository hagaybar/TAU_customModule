# Upstream sync — design

**Status:** approved (2026-05-06)
**Owner:** Hagay Bar
**Scope:** TAU `customModule` fork ↔ upstream `ExLibrisGroup/customModule`

---

## 1. Context

The TAU `customModule` repository is a long-lived fork of `ExLibrisGroup/customModule` with substantial customizations (currently 75 commits ahead of upstream, ~257 files different). Upstream is small but evolves — recent commits introduced webpack `publicPath` handling that touches files TAU has heavily customized (`prebuild.js`, `webpack.config.js`, `src/styles.scss`).

A previous attempt to automate sync via GitHub Actions (`.github/workflows/sync-fork.yml`) protects `README.md` via `.gitattributes merge=ours`, but real conflict-prone files (`LICENSE`, `prebuild.js`, `proxy/*`, `src/app/app.module.ts`, `src/app/injection-tokens.ts`) have no such protection. Past sync runs created an unresolved `sync/conflicts` PR that required manual intervention. Several other automation workflows were tried and reverted.

The user wants the safest possible path: **manual trigger, agent-assisted analysis with recommendations, then explicit per-commit selection — never silent auto-merge to `main`.**

## 2. Goals

- Make pulling upstream changes a low-risk, on-demand operation initiated by the user.
- Surface, per upstream commit, *which TAU customization* it might affect, in human-readable form.
- Keep the human in the decision loop for what gets pulled.
- Verify with `npm run build` before pushing or opening a PR.
- Maintain a permanent audit trail (which upstream commits were considered, applied, or skipped, and when).
- Reuse existing skills (`git-expert`) for git/PR operations rather than reinventing them.

## 3. Non-goals

- No scheduled or background syncing. No autopilot.
- No agent-driven "this is safe, auto-merging it" decisions. Agent classifies and recommends; human applies.
- No direct push to `main`. All changes go through a branch + PR.
- No automatic merge of the resulting PR.
- No GitHub Actions workflow for this flow (the existing `sync-fork.yml` becomes legacy).

## 4. Architecture

A single Claude Code skill, `upstream-sync`, project-scoped at `.claude/skills/upstream-sync/`. Two modes invoked conversationally:

- **Analyze** — fetch upstream, list new commits since last applied, classify each, write a dated report.
- **Apply** — given a list of SHAs, create a branch, cherry-pick in order, run `npm run build`, open a PR.

Plus two side commands:
- **Skip** — mark an upstream commit as "reviewed and not wanted" so it stops appearing in future analyses.
- **Resolve** — sub-flow invoked when a cherry-pick conflicts; walks files one at a time, Claude proposes merges, user accepts/edits/aborts per file.

Git operations (branch creation, commits, push, PR open) are delegated to the existing `git-expert` skill so conventions stay consistent with the rest of the project.

A small Node script, `scripts/upstream-sync/classify.mjs`, performs the deterministic file-path-to-category bucketing. The skill calls it during the Analyze phase. Claude itself does the natural-language summarization and recommendation framing — but never the bucketing.

State lives in three places, in priority order:
1. **Git history** (source of truth) — cherry-picks land with `-x`, leaving a `cherry picked from commit <sha>` footer that's grep-able.
2. **`docs/upstream-sync/applied.json`** — ledger of decisions (applied, skipped) with timestamps. Faster lookup than scanning git log; also records "explicitly skipped" decisions which git history can't.
3. **`docs/upstream-sync/<YYYY-MM-DD>.md`** — analysis reports, one per Analyze run, kept permanently as audit trail.

## 5. Owned-files config (categories)

**File:** `.upstream-sync/owned-files.json` at the project root, committed.

Customizations are organized by **category** rather than as flat lists. Each category has a risk level and a file/glob list. A file may belong to multiple categories (categories are tags, not folders).

```json
{
  "categories": {
    "build-infrastructure": {
      "risk": "high",
      "description": "Parametric build via build-settings.env, asset path generation",
      "files": [
        "prebuild.js",
        "postbuild.js",
        "webpack.config.js",
        "webpack.prod.config.js",
        "build-settings.env",
        "angular.json",
        "tsconfig*.json"
      ]
    },
    "module-registration": {
      "risk": "high",
      "description": "Where TAU components attach into Primo's app",
      "files": [
        "src/app/app.module.ts",
        "src/app/injection-tokens.ts"
      ]
    },
    "proxy-config": {
      "risk": "high",
      "description": "Local dev proxy to Primo, parametric per build-settings",
      "files": ["proxy/**"]
    },
    "external-search-integration": {
      "risk": "medium",
      "description": "FilterAssistPanel + NoResultsExternalLinks (ULI/WorldCat/Scholar)",
      "files": [
        "src/app/custom1-module/filter-assist-panel/**",
        "src/app/custom1-module/no-results-external-links/**",
        "src/assets/images/external-sources/**"
      ]
    },
    "homepage": {
      "risk": "medium",
      "files": ["src/assets/homepage/**"]
    },
    "header-footer": {
      "risk": "medium",
      "files": ["src/assets/header-footer/**"]
    },
    "global-styles": {
      "risk": "medium",
      "files": ["src/styles.scss", "src/assets/css/**"]
    },
    "branding": {
      "risk": "low",
      "files": [
        "src/assets/images/library-logo*",
        "README.md",
        "CLAUDE.md",
        "SPECS.md",
        "LICENSE",
        "docs/**"
      ]
    }
  },
  "ignored": [
    ".a5c/**",
    ".claude/**",
    ".angular/**",
    ".playwright-mcp/**"
  ]
}
```

**Bucketing rule** (deterministic, applied per commit):

| Hits any `risk: high` category | Hits any `risk: medium`/`low` only | Bucket | Default recommendation |
|---|---|---|---|
| Yes | — | `structural` | needs review |
| No | Yes | `owned-touch` | worth a look |
| No | No | `clean` | safe to pull |

Files matching `ignored` are dropped before evaluation.

**Validation step before going live:** replay every past upstream-conflict commit through the classifier; confirm none would have bucketed as `clean`. If any did, expand the categories before trusting the skill.

**Maintenance:** when Claude observes a `clean` commit that the user chooses not to pull, ask "should I add any of these files to a category?" and update the JSON on confirmation. The list converges over time.

## 6. Phase 1 — Analyze

**Trigger:** conversational ("let's check upstream", "analyze upstream", or `/upstream-analyze` if registered as a slash command).

**Steps:**

1. `git fetch upstream` (silent on success).
2. Determine cutoff: latest SHA in `applied.json` with `decision: "applied"`, OR the merge-base with `upstream/main` if ledger is empty.
3. List upstream commits between cutoff and `upstream/main` HEAD (chronological order).
4. Filter out commits with `decision` of `applied` or `skipped` in the ledger, AND any commit whose SHA appears in `git log main` as a `cherry picked from commit` footer.
5. For each remaining commit:
   - `git show --name-only <sha>` → list of changed files.
   - Run `scripts/upstream-sync/classify.mjs <sha>` → bucket + matched categories.
   - Claude reads the diff (`git show <sha>`) and writes a 1-3 line impact note.
6. Write `docs/upstream-sync/<YYYY-MM-DD>.md` with the report. Display it in chat.

**Report format:**

```markdown
# Upstream sync analysis — 2026-05-06

**Range:** <merge-base sha-short> → upstream/main (<head sha-short>)
**New commits since last apply:** N (M clean, K owned-touch, J structural)

## Recommended action
<top-level recommendation: "Pull all clean now; review the structural ones below.">

---

### <sha-short> — <commit subject>
- **Author:** <name>, **Date:** <YYYY-MM-DD>
- **Files touched:** <list>
- **Categories hit:** `category-a`, `category-b`  *(or "none")*
- **Bucket:** clean / owned-touch / structural
- **Impact:** <1-3 line summary of what the commit does and how it might interact with TAU's customizations in the listed categories>
- **Recommendation:** safe to pull | worth a look | needs review

### <next sha>
...
```

**Idempotency:** running Analyze twice on the same day overwrites that day's report (no historical loss — git history of the report file preserves prior versions).

## 7. Phase 2 — Apply

**Trigger:** conversational ("pull commits c1eb45f, c713f83, 5eed863").

**Pre-flight gates** (any failure stops the apply):

- Working tree clean (`git status --porcelain` empty).
- Currently on `main` (or user explicitly confirms switching).
- Each requested SHA exists in `upstream/main`.
- Each requested SHA is not already applied (per ledger AND git log scan).
- If any SHA is marked `skipped`, ask before proceeding.
- If the requested SHA order does not match upstream's chronological order, warn the user with both orderings shown, and ask whether to (a) auto-reorder to chronological, (b) proceed in user-specified order, or (c) cancel. Default suggestion: (a).

**Apply steps:**

1. Delegate to `git-expert`: create branch `sync/upstream-<YYYY-MM-DD>` from current `main`. Suffix `-2`, `-3`, etc. if same-day branch already exists.
2. Cherry-pick loop: for each SHA in order, `git cherry-pick -x <sha>`.
   - Clean → continue.
   - Conflict → invoke **Resolve flow** (Section 8).
3. Build verification: `npm run build`. Show output tail in chat. On failure: stop, leave branch local, no push, no ledger update. Suggest revert / hand-fix / abort.
4. Update ledger: append entries for each successfully applied SHA:
   ```json
   {
     "sha": "c1eb45f",
     "subject": "Merge pull request #32 from ExLibrisGroup/...",
     "appliedAt": "2026-05-06",
     "branch": "sync/upstream-2026-05-06",
     "decision": "applied"
   }
   ```
   Commit the ledger update on the same branch.
5. Delegate to `git-expert`: push the branch, open a PR titled `Sync from upstream: <N> commits (<YYYY-MM-DD>)`. PR body:
   - Bullet list of cherry-picked SHAs with original subjects.
   - Impact notes copied from the analysis report.
   - Footer: `build: ✅ passed locally`.
6. Hand off: report PR URL in chat.

**Hard rules:**
- No direct push to `main`, ever.
- No auto-merge of the PR.
- No proceeding past a build failure or PR-creation failure.

## 8. Resolve flow

Invoked when `git cherry-pick` reports a conflict.

**Flow:**

1. List conflicting files. For each file, show:
   - The TAU version (`HEAD`).
   - The upstream change being applied.
   - The conflict markers in context (`<<<<<<< / ======= / >>>>>>>` blocks).
2. **For each conflicting hunk, Claude proposes a concrete merged version** with reasoning. Examples of useful reasoning: "upstream renamed `assetBase` → `publicPath`; your code reads `assetBase` in two other places — file:line and file:line — so I'd accept the rename and update those two readers." This is a *proposal*, not an action.
3. User chooses per file:
   - **Accept** ("apply it") → Claude writes the resolved file, `git add`s it, moves to next conflicting file.
   - **Edit** ("I'll fix it") → user opens file, edits, says "done"; Claude runs `git diff --check` (catches stray markers) and moves on.
   - **Abort** → `git cherry-pick --abort`, branch deleted (after confirming), back to clean state.
4. After all conflicts resolved: `git cherry-pick --continue`, resume the cherry-pick loop with the next SHA.
5. **Stickiness rule:** after one resolved conflict in an apply, if a *second* cherry-pick also conflicts, default suggestion shifts to **abort the whole apply**. Stacking resolutions across multiple commits is where silent merge bugs hide. User can override.

**`resolve --redo`:** "I accepted your proposal but on reflection it was wrong" → reverts the resolved file to its conflict-marker state for another attempt or abort. Cheap insurance.

**Guardrails on Claude's proposals:**
- Never auto-apply without user OK.
- Always show the proposed full file (or hunk in context for large files) before applying.
- If Claude can't form a confident proposal (upstream and TAU made conceptually different changes to the same logic), say so explicitly: "I don't have a clean merge — recommend you resolve by hand or abort."

## 9. Skip command

**Trigger:** conversational ("skip commits aef3d33, 1350889" or "skip aef3d33 — we don't want the dark mode work").

**Behavior:**

- For each SHA: append to `applied.json` with `decision: "skipped"`, optional `reason` field captured from the user's message.
- Commit the ledger update on `main` directly (skip is a metadata-only change; no branch needed).
- Future Analyze runs filter these SHAs out.
- Refuse to skip a SHA that's currently mid-apply on a branch — skip is decision-only, not a way to cancel an in-progress apply.

**Reversal:** to un-skip, edit `applied.json` by hand and remove the entry. Not part of the skill surface (rare operation, low cost to do manually).

## 10. Failure handling

**Principles:**

1. **Stop on first ambiguity.** Cherry-pick conflict, build failure, PR creation failure → halt and report. Never guess past it.
2. **Branch is the safety boundary.** Anything that fails leaves the WIP branch local, no push, no ledger update. User can investigate or `git branch -D`.
3. **Ledger writes are atomic with success.** `applied.json` is updated *only* if the full apply sequence (picks + build + push + PR) completed.
4. **Resumability is git-native.** No separate state file; `git status` shows mid-cherry-pick state, user can `git cherry-pick --continue/--abort` directly.

**Failure-mode table:**

| Phase | Failure | Behavior |
|-------|---------|----------|
| Analyze | `git fetch upstream` fails | Stop, surface git error verbatim |
| Analyze | `owned-files.json` missing or malformed | Stop with clear message — no silent default fallback |
| Analyze | Ledger missing/malformed | Warn, treat as empty, continue |
| Apply pre-flight | Working tree dirty | Stop, list dirty files |
| Apply pre-flight | Not on `main` | Ask before switching |
| Apply pre-flight | SHA already applied | Warn, ask if reapply intended |
| Apply pre-flight | SHA marked `skipped` | Ask if user really wants to override |
| Cherry-pick | Conflict | Invoke Resolve flow. Default if user declines: abort whole apply |
| Build | `npm run build` fails | Leave branch local, show error tail, suggest revert / hand-fix / abort. No push, no ledger update |
| PR creation | `gh pr create` fails | Branch is pushed; report branch + SHA list, offer to retry or do manually |

## 11. File layout

```
.claude/skills/upstream-sync/
  SKILL.md                # skill instructions for Claude
  README.md               # human-facing overview, optional

.upstream-sync/
  owned-files.json        # category config

scripts/upstream-sync/
  classify.mjs            # deterministic file → bucket/categories
  ledger.mjs              # read/write applied.json (small helper)

docs/upstream-sync/
  applied.json            # decisions ledger
  2026-05-06.md           # analysis reports (one per Analyze run)
  2026-06-03.md
  ...
```

The existing `.github/workflows/sync-fork.yml` is **not deleted by this design**, but is no longer the recommended path. A note will be added to the workflow file pointing to this skill, and the workflow can be removed in a follow-up.

## 12. Interaction with existing `.gitattributes`

The repo currently has `README.md merge=ours` in `.gitattributes`, which protects the README during *merge* operations performed by the legacy `sync-fork.yml` workflow. **`merge=ours` does not apply to `git cherry-pick`.** This is intentional and correct for this design: a user explicitly choosing to cherry-pick an upstream commit that touches `README.md` should see the change land (and can choose to revert it via the Resolve flow if they want). The categorization gives `README.md` a `risk: low` (`branding`) tag, so commits touching it bucket as `owned-touch` and surface in the report — the user always decides.

The `.gitattributes` rule remains in place for the legacy workflow but is not load-bearing for the skill.

## 13. Open questions / future work

- **Notification surface for the report.** Currently the report lives on disk and in chat. If the user later wants pings (Slack, email) when an analysis run finds new structural commits, that's an additive change — out of scope for this design.
- **Multi-branch sync.** Today the skill only syncs `upstream/main` → fork `main`. If TAU later wants to track other upstream branches (e.g., a `release/...` branch), the SKILL.md and config would need a small extension. Out of scope now.
- **Cross-feature interaction warnings.** When a commit hits multiple categories, the impact note currently lists them flatly. A future enhancement could detect known cross-cutting risks (e.g., "`app.module.ts` change while `external-search-integration` is being actively developed on a feature branch"). Defer until experienced.
- **Auto-skip of commit types.** Some upstream commits (e.g., README-only changes) might be safe to auto-skip after explicit policy. Would require an explicit policy file and is a nontrivial trust expansion. Defer.

## 14. Initial validation plan (before first real use)

1. Implement `classify.mjs` and `owned-files.json`.
2. Run the classifier against every commit in `git log upstream/main ^main` (the 8 currently-pending commits) and confirm bucketing matches expectations.
3. Run the classifier against each commit from past conflict resolutions (PR #2 — `LICENSE`, `prebuild.js`, `proxy/customization_config_override.mjs`, `proxy/proxy.conf.mjs`, `src/app/app.module.ts`, `src/app/injection-tokens.ts`) and confirm none bucket as `clean`.
4. Write SKILL.md and dry-run an Analyze pass against current upstream state without writing the report.
5. Pick one low-risk upstream commit and run the full Apply path end-to-end to validate the pipeline.
6. Document the skill in the project README and update CLAUDE.md to reference it.
