# TAU CustomModule — Primo NDE

Tel Aviv University's customization package for Primo's New Discovery Experience (NDE), built on
Ex Libris' CustomModule template. Institution `972TAU_INST`; live view `NDE`, test view `NDE_TEST`
(and `TMA_NDE`/`TMA`). Customizations: external search (ULI, WorldCat, Google Scholar), call-number
directionality, custom CSS (summary in `README.md`). For the build, views, packages and Ex Libris'
reference template, load the project skill **`tau-nde-build`**.

## `main` is production (RULE)

This repo has no `prod` branch: `main` is the source of the package on the live `NDE` view, so the
global `main`→DevSandbox / `prod`→Prod topology does **not** apply. The care owed to `prod` is owed to `main`:
- **No direct pushes to `main`**; every change lands through a PR (branch protection; the admin exemption is for outages only).
- **A merge is the next deploy**: whatever is on `main` ships in the next package anyone builds.
- **Never upload a package built from an unmerged branch to the live `NDE` view**; branch packages go to `NDE_TEST`.
- **A refactor merges only when its verification gate is green** (where a design defines one, e.g. §7.1–7.2 of `docs/superpowers/specs/2026-09-09-per-view-isolation-design.md`).
- **Hotfix path:** branch → PR → merge → rebuild for `VIEW_ID=NDE` → upload in Alma Back Office → confirm the boot banner names the new package. Skipping the PR owes a follow-up PR.

## GitHub write target (RULE)

Every GitHub write goes to **`hagaybar/TAU_customModule`**, named explicitly (`gh … -R hagaybar/TAU_customModule`,
`repos/hagaybar/TAU_customModule/...`). The `upstream` remote (`ExLibrisGroup/customModule`) is read-only
unless the user asks otherwise. This rule authorizes no merge, push to production or deploy.

## The session's view (RULE)

- **`VIEW_ID` in `build-settings.env` is the view this session is directed at**, and the answer to which view an unqualified request means: "remove the logo" means the declared view's family, always. Don't ask back, and don't infer from the file edited last; if it's the wrong view, change the declaration. Check it with `npm run view`; switch with `npm run view:use <nde|nde-test|tma>` (a SessionStart hook prints it; `/view` on demand).
- **Never hand-edit `VIEW_ID` or `ASSET_BASE_URL`**: they must agree, or every asset 404s. `view:use` writes both and regenerates.
- **A build refuses when uncommitted work sits in another family**, and `view:use` refuses to leave a family with uncommitted work. For a genuine two-family change: `TAU_ALLOW_CROSS_FAMILY=1`.

## Per-view content (RULE)

- **`build-settings.env` selects; committed source defines.** That file only names the view.
- **Edit under `src/assets/views/<family>/`** (`nde` serves `NDE` and `NDE_TEST`). `src/assets/css/custom.css` and the other fixed paths are generated and gitignored: editing them is a silent no-op.
- **An undeclared `VIEW_ID` fails the build**: add it to `VIEW_FAMILY` in `scripts/select-view.mjs`. Never infer a family from a view's name.
- **Before merging anything that touches the build, and before a live upload**, compare packages: `npm run compare:packages -- <baseline.zip> <candidate.zip>`.

## Packages (RULE)

- `npm run build` archives every zip to `~/agent-work/tau-packages/` automatically. **Never copy a package anywhere else.**
- **Never upload a `-dirty` package**: commit, rebuild, upload that.
- Packages built only to compare: `npm run build:check` (archived under `verification/`, never uploaded).
- **A build is not a deploy.** Upload by hand in Alma Back Office, fill in the manifest's `note`, and confirm the boot banner in the browser console names the package.

## Debug logging (RULE)

- **No direct `console.log`/`warn`/`info` in shipped components**: use `dlog()`/`dwarn()` from `src/app/services/debug.util.ts` (off in `NDE`, on in `NDE_TEST`, silent in any other view). `console.error` is allowed for real errors.
- **Never log raw host components, DOM nodes, or patron/request-form data**, not even via `dlog`.
- The one ungated line, `[TAU] custom module · <package> · debug logging ON/OFF` in `debug.util.ts`, stays exactly once, static. How to switch logging on at runtime: `docs/development/debug-logging.md`.

## Upstream files

Before editing a build or config file, check whether it is still Ex Libris' own: `git diff upstream/main -- <file>`
(empty = never touched). Prefer a new script under `scripts/` chained from `package.json` over editing an
upstream-identical file. Syncing with upstream: the **`upstream-sync`** skill.

## Where to look

- TAU customizations: `README.md`, `docs/features/` (CSS and banner: `docs/features/landing-banner-customization.md`; TMA history: `docs/features/tma-view-changelog.md`, add an entry for every TMA change)
- Reference: `docs/reference/`; planned work: `docs/planning/FUTURE_TASKS.md`
- Ex Libris' template and examples: https://github.com/ExLibrisGroup/customModule (when to check it: `tau-nde-build`); development guidelines: `docs/development/AGENTS.md`
- Always update the relevant doc with a change. `AGENTS.md` is the reviewer's brief (Codex reviews, report only).
