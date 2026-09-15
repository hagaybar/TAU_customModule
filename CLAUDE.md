# Instructions for Claude Code

This file contains specific instructions for Claude Code when working with this TAU CustomModule project.

## Project Context

This is Tel Aviv University's customization package for Primo's New Discovery Experience (NDE), based on the ExLibris CustomModule template.

## `main` is production (RULE)

**`main` is the source of the package running on the live `NDE` view, which has been serving
patrons since early September 2026.** This repository has no `prod` branch, so the generic
`main` → DevSandbox / `prod` → Prod topology described in the user-level `CLAUDE.md` **does not
apply here**. Do not go looking for a `prod` branch to be careful about — `main` is the one.

The care that topology asks for on a `prod` branch is owed to `main` in this repo:

- **No direct pushes to `main`. Every change lands through a pull request.** Enforced by GitHub
  branch protection (pull request required, force-push and deletion blocked). Administrators are
  deliberately *exempt*, so a genuine emergency still has a path — that exemption is for outages,
  not for convenience.
- **Whatever is on `main` ships in the next package anyone builds.** Pushing `main` deploys
  nothing on its own (see *Where built packages go*), but the next person to run `npm run build`
  builds from `main` and may well upload it. There is no staging step between merge and package.
  Treat merging as "this is in the next deploy," whether or not that was the intent.
- **Never upload a package built from an unmerged branch to the live `NDE` view.** Branch packages
  go to `NDE_TEST` (or another test view). The commit in the package filename is what makes a live
  package traceable to reviewed source; a branch package breaks that.
- **A refactor or experimental branch merges only once its own verification gate is green.**
  Where a design document defines that gate, the gate is the merge condition, not a suggestion.
  For the per-view isolation work this is §7.1 and §7.2 of
  `docs/superpowers/specs/2026-09-09-per-view-isolation-design.md`.
- **The hotfix path, named here so it is not improvised under pressure:** branch from `main` → PR
  → merge → rebuild the package for `VIEW_ID=NDE` → upload to Alma Back Office → confirm the boot
  banner in the browser console names the new package. Skipping the PR is what the admin exemption
  is for, and it still owes the repository a follow-up PR recording what was done.

## ExLibris CustomModule Reference Repository

**IMPORTANT:** Always refer to the official ExLibris repository for documentation, examples, and troubleshooting:

**Repository URL:** https://github.com/ExLibrisGroup/customModule

### When to Check the ExLibris Repository

1. **Before implementing new features** - Check for examples and best practices
2. **When troubleshooting** - Look for default file structures and configurations
3. **For documentation** - README.md contains comprehensive setup and development guides
4. **For proxy/theme configuration** - Reference latest proxy setup and Material 3 theme examples
5. **When unsure about file structure** - Compare with default ExLibris implementation

### How to Use the Repository

- **Browse directly:** Navigate through the repository structure to find relevant files
- **Search for files:** Use glob patterns or file search to find specific configurations
- **Read documentation:** Fetch and read the README.md or other documentation files
- **Compare implementations:** Check how ExLibris implements similar features
- **Find examples:** Look for sample components and customization patterns

## TAU-Specific Customizations

This repository contains TAU-specific customizations documented in:
- `README.md` - Summary of all TAU customizations
- `docs/features/` - Detailed feature documentation
- `docs/features/landing-banner-customization.md` - **Playbook for the landing banner & search-bar styling** (font, color, overlay, search-bar width) + a **complete inventory of every `src/assets/views/nde/css/custom.css` rule** and the layout gotchas (h1/h2, landing vs top-bar, local-proxy ≠ production). Read this before tweaking any banner/CSS styling.
- `docs/reference/` - Technical reference documents
- `docs/planning/FUTURE_TASKS.md` - Planned enhancements and future work

## Key Differences from ExLibris Base

1. **Institution ID:** `972TAU_INST`
2. **View IDs:**
   - Production: `NDE`
   - Test: `NDE_TEST` (configured in `build-settings.env`)
3. **Custom Features:**
   - External search integration (ULI, WorldCat, Google Scholar)
   - Call number directionality fixes
   - Custom CSS styling

## Development Workflow

1. **Local development:** Use `npm run start:proxy` with proxy pointing to production
2. **Build settings:** Configure `build-settings.env` before building
3. **Proxy configuration:** `proxy/proxy.const.mjs` determines which Primo instance to proxy to
4. **Custom styles:** Edit `src/assets/views/<family>/css/custom.css` — `nde` for the live
   `NDE` and `NDE_TEST` views. `src/assets/css/custom.css` is *generated* from it and
   gitignored; an edit there is discarded by the next build. See *Per-view content* below.
5. **Documentation:** Always update relevant docs when making changes

## Critical Build Requirements

**MANDATORY: After ANY changes to `build-settings.env`, you MUST regenerate files:**

```bash
npm run generate
# OR
npm run build
```

**Why this is critical:**
- `npm run generate` runs `prebuild.js` and then `scripts/select-view.mjs`. Run the pair, not
  `node prebuild.js` alone — that regenerates the asset path but leaves the *content* of the
  build set to whichever view was selected last.
- `prebuild.js` reads `build-settings.env` and generates `src/app/state/asset-base.generated.ts`
- This generated file contains the asset path (`ASSET_BASE_URL`) used at runtime
- If not regenerated, asset paths will be wrong, causing 404 errors for all images/icons
- `prebuild` and `prestart` both run `npm run generate`, so `npm run build` and
  `npm run start:proxy` are covered — but nothing runs it before a commit

**Proxy configuration is also parametric:**
- `proxy/customization_config_override.mjs` automatically reads from `build-settings.env`
- No manual updates needed when switching between test/production views
- Proxy paths will always match your current `INST_ID` and `VIEW_ID` settings

**Example of what goes wrong:**
- `build-settings.env` says: `/nde/custom/972TAU_INST-NDE_TEST`
- Generated file still has: `/nde/custom/972TAU_INST-NDE`
- Result: All assets fail to load with 404 errors

**When to regenerate:**
1. After changing `VIEW_ID` in `build-settings.env`
2. After changing `ASSET_BASE_URL` in `build-settings.env`
3. After switching between production/test views
4. Before committing changes to `build-settings.env`

## Per-view content (RULE)

**One repository builds every view, and `VIEW_ID` in `build-settings.env` selects which content
goes in.** The rule that keeps that safe: **`build-settings.env` selects; committed source
defines.** That file is edited casually before every build and does not count as a source change,
so it must never carry a definition — it names the view, and committed code decides what the view
contains.

`scripts/select-view.mjs` (run by `npm run generate`) holds the only table mapping a view to a
**family**:

| `VIEW_ID` | Family | Role |
|---|---|---|
| `NDE` | `nde` | production — live for patrons |
| `NDE_TEST` | `nde` | test, a duplicate of production |
| `TMA_NDE` | `tma` | test / build-out |
| `TMA` | `tma` | production, after cutover |

- **An undeclared `VIEW_ID` fails the build.** No package is produced at all. Add the view to
  `VIEW_FAMILY` in `scripts/select-view.mjs`, with the family whose content it should ship. Never
  infer a family by parsing the view name: the Back Office owns those names, so parsing would let
  a colleague change a build's behaviour by naming a view.
- **Components** live in `src/app/views/<family>/component-map.ts`. `select-view.mjs` writes a
  one-line re-export to `src/app/state/view.generated.ts`, which `app.module.ts` imports. The
  unselected family is never imported, so its components are not in the bundle. Do not merge the
  maps: a `Map` literal cannot hold two entries for one key, so a merge would silently keep
  whichever row came last.
- **Host-fetched assets** (`custom.css`, `custom.js`, the footer and homepage HTML) live in
  `src/assets/views/<family>/`. Primo fetches them from a *fixed* URL that cannot vary per view,
  so the build copies the selected family's file over that fixed path. **Those fixed paths are
  generated and gitignored.** Editing `src/assets/css/custom.css` is a silent no-op — the next
  build overwrites it. Edit under `src/assets/views/<family>/`.
- **Adding a new per-view asset** means adding its generated destination to `.gitignore`.
  `select-view.mjs` refuses to run until you do, because an untracked generated file makes
  `postbuild.js` stamp every package `-dirty`, and a `-dirty` package must not be uploaded.
- `src/assets/css/custom.js` (174 bytes, an Ex Libris template placeholder) is **not** per-view.
  Leave it where it is.

**Proving a change did not disturb another view.** Everything the host fetches lives under
`assets/`, so a per-view mistake is always a wrong *zip*, never a runtime surprise. Build the
same `VIEW_ID` from `main` and from your branch and compare the two packages:

```bash
npm run compare:packages -- <baseline.zip> <candidate.zip>
```

It compares every file in both packages, fails on any difference under `assets/` (excluding
`assets/views/`, which carries every family's sources by design), and reports bundle-hash
differences without failing. It **aborts rather than reporting "no differences"** when a package
looks too small to be real — a check that cannot fail is not a check. Packages are archived to
`~/tau-packages/<date>/` by every build, so the baseline usually already exists.

Do this before merging anything that touches the build, and before uploading to a live view.
Clicking around a test view only exercises the pages you happen to open; this covers all of them.

Tests: `npm run test:scripts`. Design:
`docs/superpowers/specs/2026-09-09-per-view-isolation-design.md`.

## Where built packages go (RULE)

**Every `npm run build` archives its zip to `~/tau-packages/` automatically** — `postbuild.js`
does it. **Never copy a package anywhere else**; one location with a history is the whole point,
and ad-hoc copies are how it stops being answerable which source produced a live package.

```
~/tau-packages/2026-09-03/972TAU_INST-NDE_20260903T081135Z_06cca6e.zip
~/tau-packages/MANIFEST.tsv     # built_utc, view, commit, dirty, bytes, file, note
~/tau-packages/README.md        # how to read a filename; what unknown/-dirty mean
```

- **The commit in the filename is the point.** It maps an uploaded package back to reproducible
  source months later. `dist/` is overwritten by the next build and answers nothing.
- **`-dirty` means the tree had uncommitted changes**, so the package cannot be rebuilt exactly.
  **Do not upload a `-dirty` package.** Commit first, rebuild, upload that.
- Selecting a view (`build-settings.env`, `asset-base.generated.ts`) does **not** count as dirty
  — that edit is how you choose a view, not a source change.
- Archiving never fails a build; if it cannot write, it warns and the zip in `dist/` is unaffected.
- **A build is not a deploy.** The `note` column is written empty; fill it in by hand when you
  actually upload one, because nothing else records which package went live.
- Packages named `_unknown` predate this archive (imported 2026-09-03 from four scattered
  locations). Their manifest notes carry an *inferred* commit, explicitly marked NOT verified.

Deploy is still manual: upload the zip to Alma Back Office. Pushing to `main` deploys nothing.
After uploading, confirm the right package went live by the boot banner in the browser console —
it names the package it was built for.

## Important Notes

- The custom module loads as web components into Primo's host application
- Typography and theme changes may not affect the entire Primo UI, only custom components
- Always test changes in the dev environment before building for production
- Maintain documentation for all customizations in the `docs/` folder

## Debug logging (RULE)

**Shipped components must not call `console.log`/`console.warn`/`console.info` directly.**
The custom module loads into Primo in every user's browser, so diagnostic logging would
otherwise dump host/DOM objects and patron form data to the production console (see issue #10).

- **Use the gated logger** `dlog()` / `dwarn()` from `src/app/services/debug.util.ts` for all
  diagnostic logging. It is **OFF by default in production** (`NDE`); **ON by default in `NDE_TEST`**.
  Any other view fails closed to silent.
- **`console.error` is allowed** for genuine, always-visible error reporting (e.g. catch blocks).
- **Never log raw host components, DOM nodes, or patron/request-form data** — not even via `dlog`.
- **One line always prints**, in every view: `[TAU] custom module · <package> · debug logging ON/OFF`.
  This is the *only* sanctioned ungated `console.log`, it lives in `debug.util.ts` (already the
  guard's exemption), and it must stay a static string plus build-time constants — no runtime
  values. Do not add a second one, and do not remove this one: it is what makes an empty console
  distinguishable from a module that never loaded.
- **Activate at runtime (no rebuild)** — three switches, later ones win:
  ```js
  ?tauDebug=1                              // in the URL — persists itself; a link you can send
  localStorage.setItem('tauDebug', '1');   // then reload — persists; '0' is an explicit OFF
  window.__TAU_DEBUG__ = true;             // this session only; beats both
  ```
  `setItem('tauDebug','0')` silences even `NDE_TEST`; `removeItem` falls back to the view default.
  Full guide: `docs/development/debug-logging.md`. Design: `docs/superpowers/specs/2026-08-09-debug-logging-activation-design.md`.
- The **dev proxy** (`proxy/proxy.conf.mjs`) runs at `logLevel: 'info'`, not `'debug'`, to avoid
  printing the live host's cookies/auth headers to the terminal. Raise to `'debug'` only temporarily.

## Resources

- **ExLibris Repository:** https://github.com/ExLibrisGroup/customModule
- **Project Documentation:** `docs/` folder
- **Development Guidelines:** `docs/development/AGENTS.md`
- **Future Tasks:** `docs/planning/FUTURE_TASKS.md`

## Syncing with upstream ExLibris repo

The `upstream-sync` Claude Code skill (`.claude/skills/upstream-sync/SKILL.md`) handles pulling changes from `ExLibrisGroup/customModule`.

**To use:**
- "let's check upstream" → analyzes new upstream commits, writes a dated report under `docs/upstream-sync/`, classifies each commit by impact on TAU customizations.
- "pull commits A, B, C" → cherry-picks chosen SHAs onto a `sync/upstream-<date>` branch, runs `npm run build`, opens a PR.
- "skip commit A — we don't want X" → marks commits as decided-against so they stop appearing in future analyses.

The skill never pushes directly to `main` and never auto-merges PRs.

**Configuration:** `.upstream-sync/owned-files.json` lists TAU-customized files organized into categories with risk levels. Update this file when you take ownership of a new file or add a new feature area — the skill itself will suggest additions when it sees you skipping changes to files it considered "clean."

**Spec:** `docs/superpowers/specs/2026-05-06-upstream-sync-design.md`
