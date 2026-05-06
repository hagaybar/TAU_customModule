---
name: upstream-sync
description: Manually-triggered upstream sync for the TAU customModule fork (origin → ExLibrisGroup/customModule). Analyzes new upstream commits, classifies each by impact on TAU's customizations using a deterministic file-path → category map, and lets the user selectively cherry-pick chosen commits onto a verification branch with `npm run build` gating before opening a PR. Triggers when the user says "check upstream", "analyze upstream", "pull upstream commits ...", "skip upstream commit ...", or invokes `/upstream-analyze`, `/upstream-apply`, `/upstream-skip`.
---

# Upstream Sync Skill

This skill orchestrates pulling changes from `upstream/main` (`ExLibrisGroup/customModule`) into the TAU fork, with deterministic impact analysis and human-controlled selection.

**Reference:** `docs/superpowers/specs/2026-05-06-upstream-sync-design.md` is the source of truth for design decisions.

## Modes

The skill has four conversational modes. Pick the one that matches the user's intent:

| User intent | Mode | Section below |
|---|---|---|
| "let's check upstream", "analyze upstream", "/upstream-analyze" | **Analyze** | §1 |
| "pull commits A, B, C", "apply upstream commits ...", "/upstream-apply A B" | **Apply** | §2 |
| "skip commit A (because ...)" | **Skip** | §3 |
| (during Apply) cherry-pick reports a conflict | **Resolve** | §4 |

## Hard rules (apply to every mode)

- **Never push directly to `main`.** All upstream changes go through a `sync/upstream-<date>` branch and a PR.
- **Never auto-merge the PR.** The user reviews and merges manually.
- **Never proceed past a build failure or PR-creation failure.** Stop and report.
- **Never write to the ledger unless the full apply sequence (picks + build + push + PR) succeeded.** Atomic ledger writes only.
- **Delegate all git operations to the `git-expert` skill** (branch creation, commits, push, PR open). Invoke `Skill { skill: "git-expert" }` when you need its conventions.

## §1 — Analyze mode

**1.1 Fetch upstream:**
```bash
git fetch upstream
```
If this fails, stop and surface the error to the user.

**1.2 Determine cutoff:**
- Read `docs/upstream-sync/applied.json` (via `node scripts/upstream-sync/ledger.mjs list`).
- Take the latest entry with `decision: "applied"`. Its `sha` is the cutoff.
- If the ledger is empty, the cutoff is `git merge-base main upstream/main`.

**1.3 List candidate commits:**
```bash
git log --format=%H upstream/main ^main
```
This gives all upstream commits not yet on `main` (chronologically newest-first; reverse for oldest-first when reporting).

**1.4 Filter already-decided commits:**
For each candidate SHA:
- `node scripts/upstream-sync/ledger.mjs has-sha <full-sha>` — if it returns `applied` or `skipped`, drop it.
- Also check `git log main --format=%B | grep "cherry picked from commit <sha>"` — if found, drop it (already cherry-picked).

**1.5 Classify each remaining commit:**
```bash
node scripts/upstream-sync/classify.mjs <sha>
```
Parse the JSON output. You'll get `bucket`, `matchedCategories`, `changedFiles`, `recommendation`.

**1.6 Read the diff for an impact summary:**
```bash
git show --stat <sha>
git show <sha> -- <files-of-interest>  # for the categories that hit
```
Write a 1-3 line natural-language impact note: what the commit does, how it might interact with TAU's customizations in the matched categories. Be specific: reference TAU file paths or features by name when relevant. If you're not sure, say so.

**1.7 Write the report:**
File: `docs/upstream-sync/<YYYY-MM-DD>.md` (today's date in ISO format).

Use this exact template:

````markdown
# Upstream sync analysis — YYYY-MM-DD

**Range:** <merge-base sha-short> → upstream/main (<head sha-short>)
**New commits since last apply:** N (M clean, K owned-touch, J structural)

## Recommended action
<top-level guidance: "Pull all clean commits in one go; review the structural ones one at a time," or similar>

---

### <sha-short> — <commit subject>
- **Author:** <name>, **Date:** YYYY-MM-DD
- **Files touched:** <comma-separated list, truncate to ~10 with "(N more)" if longer>
- **Categories hit:** `category-a`, `category-b` *(or "none")*
- **Bucket:** clean | owned-touch | structural
- **Impact:** <1-3 lines>
- **Recommendation:** safe to pull | worth a look | needs review

### <next sha>
...
````

If the file already exists for today (re-running same day), overwrite it. Git history of the file preserves prior versions.

**1.8 Display the report in chat:**
After writing the file, paste the report contents into the conversation so the user can read it without opening the file. End with a one-line prompt: "Tell me which SHAs to pull (or skip)."

## §2 — Apply mode

**2.1 Parse the user's SHA list.**
The user gives short or full SHAs. Resolve each to full SHA via `git rev-parse <short>`. If any fail to resolve, stop and report.

**2.2 Pre-flight gates** (any failure → stop, report, do nothing):
- `git status --porcelain` is empty (working tree clean).
- Current branch is `main` (`git rev-parse --abbrev-ref HEAD`). If not, ask the user before switching.
- Each SHA exists in `upstream/main` (`git merge-base --is-ancestor <sha> upstream/main`).
- For each SHA, `node scripts/upstream-sync/ledger.mjs has-sha <sha>`:
  - `applied` → warn ("already applied, reapply intended?"). Wait for explicit yes.
  - `skipped` → warn ("you previously skipped this; override?"). Wait for explicit yes.
  - `none` → continue.
- Check the user's order against upstream's chronological order (`git log --format=%H upstream/main ^main` reversed). If they differ, present both orderings and ask: (a) auto-reorder to chronological [default], (b) proceed in user-specified order, (c) cancel.

**2.3 Create the branch** (delegate to git-expert):
- Branch name: `sync/upstream-<YYYY-MM-DD>`. If a branch with that name already exists, suffix `-2`, `-3`, etc.
- Branch off current `main`.

**2.4 Cherry-pick loop:**
For each SHA in the chosen order:
```bash
git cherry-pick -x <sha>
```
- Clean → continue to next SHA.
- Conflict → invoke **Resolve mode** (§4). Don't proceed without resolution.
- After the last SHA succeeds, fall through to step 2.5.

**2.5 Build verification:**
```bash
npm run build
```
- Pass → continue to step 2.6.
- Fail → **stop**. Show the last ~30 lines of build output. Do NOT push, do NOT update ledger. Suggest options: (a) `git revert HEAD` (drop the last cherry-pick), (b) hand-fix and re-run `npm run build`, (c) abort entirely (`git checkout main && git branch -D sync/upstream-<date>`).

**2.6 Update the ledger:**
For each successfully cherry-picked SHA:
```bash
node scripts/upstream-sync/ledger.mjs add \
  --sha <full-sha> \
  --decision applied \
  --subject "<commit subject>" \
  --appliedAt <YYYY-MM-DD> \
  --branch sync/upstream-<YYYY-MM-DD>
```
Then commit the ledger update on the branch:
```bash
git add docs/upstream-sync/applied.json
git commit -m "chore(upstream-sync): record applied commits"
```

**2.7 Push the branch and open a PR** (delegate to git-expert):
- Push: `git push -u origin sync/upstream-<YYYY-MM-DD>`
- PR title: `Sync from upstream: N commits (YYYY-MM-DD)` (where N is the count)
- PR body — use this template:

````markdown
## Upstream sync

**Source:** `ExLibrisGroup/customModule@<head-sha-short>` → fork `main`
**Date:** YYYY-MM-DD

### Cherry-picked commits

- `<sha>` — <subject>  *(impact: <copied from analysis>)*
- `<sha>` — <subject>  *(impact: ...)*

### Build status

✅ `npm run build` passed locally

### Review notes

<copy any "needs review" / "worth a look" notes from the analysis report>
````

**2.8 Hand off:**
Tell the user the PR URL, branch name, and that the ball is in their court for review and merge. Done.

## §3 — Skip mode

**3.1 Parse SHAs and reason.**
The user might say "skip aef3d33 — we don't want dark mode work." Capture the SHA list and the optional reason.

**3.2 Pre-flight:**
- Resolve each SHA to full via `git rev-parse`.
- For each, ensure no apply branch is currently mid-cherry-pick (`git status` should not show "You are currently cherry-picking"). If it does, refuse: "skip is decision-only; finish or abort the current apply first."
- Check `node scripts/upstream-sync/ledger.mjs has-sha <sha>`:
  - `applied` → refuse ("already applied; you can revert via PR but not skip after-the-fact").
  - `skipped` → no-op, inform user.
  - `none` → continue.

**3.3 Confirm with the user.**
List each SHA with its subject (`git log -1 --format='%h %s' <sha>`). Ask "skip these N commits? Reason will be: '<reason>'". Wait for explicit yes.

**3.4 Append ledger entries on `main`:**
```bash
git checkout main
for sha in <list>; do
  node scripts/upstream-sync/ledger.mjs add \
    --sha <sha> \
    --decision skipped \
    --subject "<one-line subject>" \
    --appliedAt <YYYY-MM-DD> \
    --reason "<reason or 'no reason given'>"
done
git add docs/upstream-sync/applied.json
git commit -m "chore(upstream-sync): mark <N> upstream commits as skipped"
```

**3.5 Confirm:**
"Marked N commits as skipped; they won't appear in the next analysis."

## §4 — Resolve mode (during Apply)

Invoked when `git cherry-pick` returns non-zero (conflict).

**4.1 Identify conflicting files:**
```bash
git diff --name-only --diff-filter=U
```

**4.2 For each conflicting file, walk the user through:**

Show:
1. The TAU version (`git show :2:<file>` or read the working file's HEAD-side block).
2. The upstream change (`git show :3:<file>` or the upstream-side block).
3. The conflict markers in context.

**Then propose a concrete merged version**, with reasoning. Example:
> "Upstream renamed `assetBase` → `publicPath` here. Your code reads `assetBase` in `prebuild.js:42` and `webpack.config.js:78`. I'd accept the rename and update those two readers. Here's the proposed merged file: <full file>. Apply it?"

If you can't form a confident proposal (upstream and TAU made conceptually different changes), say so: "I don't see a clean merge here. Recommend you resolve by hand or abort."

**4.3 User chooses per file:**
- **Accept** ("apply it") → write the proposed file, `git add <file>`, move to next conflicting file.
- **Edit** ("I'll fix it") → user opens file, edits, says "done" → run `git diff --check <file>` (catches stray markers); if clean, `git add <file>`, move on; if not clean, ask user to fix the markers.
- **Abort** → `git cherry-pick --abort`, ask before deleting the branch (`git branch -D sync/upstream-<date>` if user confirms), exit Resolve mode.

**4.4 After all files resolved:**
```bash
git cherry-pick --continue
```
Resume the Apply cherry-pick loop with the next SHA.

**4.5 Stickiness rule:**
After one resolved conflict in this Apply, if a *second* cherry-pick also conflicts, the default suggestion shifts to **abort the whole apply**. Tell the user: "Stacking resolutions across multiple commits is where silent merge bugs hide. I'd recommend aborting and treating these as a single manual merge, but you can override."

**4.6 `resolve --redo`:**
If during Resolve the user says "redo" / "that proposal was wrong":
```bash
git checkout -- <file>     # restore conflict-marker state
git reset HEAD <file>      # un-stage if previously added
```
Then re-enter the Resolve flow for that file.

## Failure handling cheat sheet

| Failure | Behavior |
|---|---|
| `git fetch upstream` fails | Stop, surface verbatim |
| `owned-files.json` missing/malformed | Stop, ask user to fix; no defaults |
| Ledger missing/malformed | Warn, treat as empty |
| Working tree dirty (Apply pre-flight) | Stop, list dirty files |
| Not on `main` (Apply pre-flight) | Ask before switching |
| SHA not in `upstream/main` | Stop, show valid range |
| `npm run build` fails | Stop, no push, no ledger write |
| `gh pr create` fails | Branch is pushed; report SHA list, offer manual PR |
| Cherry-pick conflict | Invoke Resolve (§4); default if user declines: abort |

## Operational notes

- The skill writes its own commits on the apply branch (e.g., the ledger update). These are not cherry-picks; the PR title's "N commits" count refers to the *cherry-picked* count, not total commits on the branch.
- All scripts live in `scripts/upstream-sync/`. Always invoke them via `node scripts/upstream-sync/<script>.mjs ...` from the repo root.
- Today's date for filenames/timestamps comes from `date -I` (ISO 8601).
- The legacy `.github/workflows/sync-fork.yml` exists but is no longer the recommended path — see its top-of-file note.
