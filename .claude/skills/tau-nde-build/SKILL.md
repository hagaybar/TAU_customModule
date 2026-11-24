---
name: tau-nde-build
description: Use when building, packaging, uploading or verifying the TAU Primo NDE custom module, switching the session's view (NDE, NDE_TEST, TMA_NDE, TMA), adding a per-view asset or component, editing build-settings.env, or when assets 404, a package is -dirty, or a build refuses with a cross-family or undeclared-view error.
---

# TAU NDE build, views and packages

The rules are in `CLAUDE.md`; this is the mechanics and the reasons behind them.

## Regenerating after build settings change

**MANDATORY: After ANY changes to `build-settings.env`, you MUST regenerate files:**

```bash
npm run generate
# OR
npm run build
```

**Why this is critical:**
- `npm run generate` runs `prebuild.js`, `scripts/write-tracking-token.mjs`, then `scripts/select-view.mjs`. Run all three, not
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

## Why the session's view decides

**Why this exists.** The failure is not picking the wrong view at build time — the package
filename and the boot banner both catch that. It is being asked for a change, not knowing
which view was meant, and editing the wrong family: the build then succeeds, the view you
cared about is unchanged, and the other one is quietly damaged. `main` is production here,
so the other one is often the live NDE view.

## Views and families

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

## Proving a change did not disturb another view

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
`~/agent-work/tau-packages/<date>/` by every build, so the baseline usually already exists.

Do this before merging anything that touches the build, and before uploading to a live view.
Clicking around a test view only exercises the pages you happen to open; this covers all of them.

Tests: `npm run test:scripts`. Design:
`docs/superpowers/specs/2026-09-09-per-view-isolation-design.md`.

## The package archive

**Every `npm run build` archives its zip to `~/agent-work/tau-packages/` automatically** —
`postbuild.js` does it. **Never copy a package anywhere else**; one location with a history is
the whole point, and ad-hoc copies are how it stops being answerable which source produced a
live package.

```
~/agent-work/tau-packages/2026-09-03/972TAU_INST-NDE_20260903T081135Z_06cca6e.zip
~/agent-work/tau-packages/MANIFEST.tsv  # built_utc, view, commit, dirty, bytes, file, note
~/agent-work/tau-packages/README.md     # how to read a filename; what unknown/-dirty mean
```

**Same folder whether you build in the sandbox or in WSL.** The archive is the `tau-packages`
folder *beside the repository's main checkout* (`scripts/package-archive.cjs`), not one in the
home directory — the sandbox and WSL have different homes, and only `~/agent-work` is shared
by both, backed up by restic, and browsable from Windows Explorer
(`\\wsl$\Ubuntu\home\hagaybar\agent-work\tau-packages`). A build in a worktree still
archives there. Until 2026-10-26 the archive was `~/tau-packages`; a package found there, or a
build that prints a path under a home directory, is a sign something is out of date.

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

### Explicit archive root for host-side builds

`TAU_PACKAGE_ARCHIVE_ROOT` optionally selects an absolute archive root. Without it,
Git's common directory still determines the default described above. Empty or relative
settings fail rather than silently selecting another destination.

For an independent WSL checkout, set this variable to
`/home/hagaybar/agent-work/tau-packages` in the WSL build environment. Windows can browse it at
`\\wsl.localhost\Ubuntu\home\hagaybar\agent-work\tau-packages`.
This does not make that host folder accessible from a sandbox where it is not mapped.
Do not create a sandbox directory with the same name as a substitute.

The override changes only the root: date folders, commit filenames, manifest fields,
and the separate `verification/` directory are unchanged. Archive write failures retain
the existing warning behavior; confirm the archive-success message after a host build.

### Verification builds

Proving a change did not disturb another view means building that view's package purely to
diff it against one built from `main` (see *Per-view content* and
`scripts/compare-packages.mjs`). Those packages are **never uploaded**, and sitting next to
the real ones they are indistinguishable from them — which quietly destroys the one thing
this archive is for.

```bash
npm run build:check      # instead of npm run build
```

That archives to `~/agent-work/tau-packages/verification/<date>/` with its own `MANIFEST.tsv`, prints
"Not for upload" during the build, and leaves the top-level archive meaning exactly one
thing: **a package that could be deployed.** Nothing in `verification/` ever should be.

Deploy is still manual: upload the zip to Alma Back Office. Pushing to `main` deploys nothing.
After uploading, confirm the right package went live by the boot banner in the browser console —
it names the package it was built for.

## Development workflow

1. **Local development:** Use `npm run start:proxy` with proxy pointing to production
2. **Build settings:** Configure `build-settings.env` before building
3. **Proxy configuration:** `proxy/proxy.const.mjs` determines which Primo instance to proxy to
4. **Custom styles:** Edit `src/assets/views/<family>/css/custom.css` — `nde` for the live
   `NDE` and `NDE_TEST` views. `src/assets/css/custom.css` is *generated* from it and
   gitignored; an edit there is discarded by the next build. See *Per-view content* below.
5. **Documentation:** Always update relevant docs when making changes

## Primo context

- The custom module loads as web components into Primo's host application
- Typography and theme changes may not affect the entire Primo UI, only custom components
- Always test changes in the dev environment before building for production
- Maintain documentation for all customizations in the `docs/` folder

## Ex Libris' reference template

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

Differences from the base template:

1. **Institution ID:** `972TAU_INST`
2. **View IDs:**
   - Production: `NDE`
   - Test: `NDE_TEST` (configured in `build-settings.env`)
3. **Custom Features:**
   - External search integration (ULI, WorldCat, Google Scholar)
   - Call number directionality fixes
   - Custom CSS styling
