# Per-view isolation — design

**Status:** 📋 proposed (2026-09-09) — nothing built yet
**Owner:** Hagay Bar
**Scope:** `scripts/select-view.mjs` (new), `src/app/custom1-module/customComponentMappings.ts`,
`src/app/app.module.ts`, `src/assets/**`, `package.json`, `postbuild.js`
**Issue:** [#67](https://github.com/hagaybar/TAU_customModule/issues/67)
**Motivated by:** TAU is converting the TMA view (`972TAU_INST:TMA`) from classic Primo to NDE.
Work in progress at `972TAU_INST:TMA_NDE`, currently customized through Alma back-office tools only.

---

## 1. Context

TAU maintains one NDE customization package, built from this repository for the `NDE` view (and
its duplicate test view `NDE_TEST`). A second view is now being converted to NDE: `TMA`, a
subject-specific view with its own visual design, currently live as classic Primo.

TMA is not a variant of NDE. It will not activate the same components, will not share a
stylesheet, and needs its own package. The question this document answers is **where that
separation lives** — and the answer determines whether the two views can be maintained by one
person over years.

### The state today

The repository builds **one package per build**, selected by `VIEW_ID` in `build-settings.env`.
That much is already per-view. What is *not* per-view is everything inside the package:

| Layer | Today | Per-view? |
|---|---|---|
| Asset base path | `prebuild.js` → `src/app/state/asset-base.generated.ts` | ✅ yes |
| Component registrations | one flat `Map` in `customComponentMappings.ts` | ❌ no |
| Bundled styles | `src/styles.scss`, `src/app/styles/_customized-theme.scss` | ❌ no |
| Host-fetched assets | whole `src/assets` folder copied verbatim | ❌ no |

Build a TMA package off `main` today and you get an NDE package with a different asset path:
all five NDE components register, TAU's 25 KB `custom.css` applies, and the NDE header/footer
HTML ships. **No isolation exists. It has to be built.**

The five components currently registered, all unconditionally:

```
nde-filters-group-before               → FilterAssistPanelComponent
nde-search-no-results-bottom           → NoResultsExternalLinksComponent
nde-location-top                       → CenlibMapButtonComponent
nde-header-before                      → AnnouncementBannerComponent
nde-collection-discovery-gallery-top   → CollectionDiscoveryFilterComponent
```

## 2. Goals

- A package built for a view contains **only** that view's components, styles, and assets.
- Adding a view family is a small, reviewed, declarative change — not a new repository, and not
  a long-lived branch.
- Promoting a test view to production (`TMA_NDE` → `TMA`) requires **zero code changes** —
  only a `build-settings.env` edit and an upload.
- An unrecognized `VIEW_ID` **fails the build**. It must be impossible to produce a package for
  a view nobody declared.
- The existing `NDE` package is **unchanged in behaviour** by this refactor. This is a
  restructuring, not a feature.
- One upstream fork, one `npm install`, one Angular upgrade path — forever.

## 3. Non-goals

- No TMA styling or component work. This design creates the seams; filling them is separate.
- No change to how packages are built, archived, or uploaded. `postbuild.js`, `~/tau-packages/`,
  and the manual Back Office upload stay exactly as they are.
- No change to the debug-logging design. `VERBOSE_BY_DEFAULT` stays keyed on the exact view id,
  not the family — `NDE_TEST` is verbose, `NDE` is not, and that distinction is per-view-id by
  intent.
- No second repository, and no permanent per-view branch. See §7.
- No migration of TMA's classic Primo JavaScript. Classic customization packages are AngularJS-era;
  their CSS and HTML port as **design reference**, their directives do not port at all.

## 4. The organizing principle

> **`build-settings.env` selects. Committed source defines.**

`build-settings.env` is edited casually, before every build, without review — and `CLAUDE.md`
explicitly states that editing it "does not count as dirty … that edit is how you choose a view,
not a source change." A file with that status must never carry a *definition*. It names which
view you want; committed code decides what that view contains.

Every decision below follows from this one sentence.

## 5. Design

### 5.1 View families

Content is selected by **family**, not by view id. Two views in the same family are byte-identical
packages apart from their asset path.

| `VIEW_ID` | Family | Role |
|---|---|---|
| `NDE` | `nde` | production |
| `NDE_TEST` | `nde` | test (duplicate of production) |
| `TMA_NDE` | `tma` | test / build-out |
| `TMA` | `tma` | production, after cutover |

This table **is** the promotion guarantee in Goal 3: both `TMA_NDE` and `TMA` are declared from
day one, so cutover changes one line in `build-settings.env` and nothing else.

### 5.2 `scripts/select-view.mjs`

A new TAU-owned script holding the family table and doing the selection.

```js
const VIEW_FAMILY = {
  NDE:      'nde',
  NDE_TEST: 'nde',
  TMA_NDE:  'tma',
  TMA:      'tma',
};

const family = VIEW_FAMILY[viewId];              // viewId read from build-settings.env
if (!family) {
  console.error(`Unknown VIEW_ID "${viewId}". Known: ${Object.keys(VIEW_FAMILY).join(', ')}`);
  process.exit(1);                                // no package is produced at all
}
```

**Why a table and not string parsing.** `TMA_NDE` → strip `_NDE` → `tma` is clean until it meets
`NDE`, which strips to nothing. Ordering rules follow, then a rule for `NDE_TEST`, and then
someone creates `TMA2` in the Back Office and the parser guesses. The view id is a name Ex Libris'
Back Office owns, not one this repository controls — inferring content from it means a colleague
can change a build's behaviour by naming a view. Worse, it fails in the wrong direction: an
unrecognized name still yields *some* family, the build succeeds, and the wrong components ship.

**Why the table is not in `build-settings.env`.** Adding `VIEW_FAMILY=tma` next to
`VIEW_ID=TMA_NDE` means two fields that must agree with nothing checking them; a stale
`VIEW_FAMILY` ships TMA components to production NDE. This is §4.

**Why hard failure.** Same rule `debug.util.ts:41` already follows for `VERBOSE_BY_DEFAULT` —
anything not explicitly declared gets the safe outcome. Here the safe outcome is no package.

**Why a new script rather than editing `prebuild.js`.** `prebuild.js` is byte-identical to
`upstream/main` and every commit that ever touched it was authored by Ex Libris/Clarivate
(`david.bendavid@clarivate.com`, `DavidbdExl`, `nirshush`). Editing it converts a file that merges
for free into one that conflicts on every upstream change. `scripts/` contains no upstream code
at all (`sync-map-assets.mjs`, `check-debug-logging.mjs`, `upstream-sync/`), so a new script there
has zero conflict surface. The counter-example is `postbuild.js`: an upstream file TAU added 78
lines to, which will now conflict on every upstream change to it.

### 5.3 Wiring

`package.json` runs the generator in **two** places today — `prebuild` and `prestart`. Chain once,
not twice, or `npm run start:proxy` compiles against a stale generated file:

```json
"generate": "node prebuild.js && node scripts/select-view.mjs",
"prebuild": "npm run generate",
"prestart": "npm run generate"
```

`package.json` already diverges from upstream by 6 lines for TAU's own scripts, so this line is
already TAU-owned.

### 5.4 Components — build-time import selection

Split the single map into one per family:

```
src/app/views/nde/component-map.ts     export const map = new Map([ …5 NDE entries… ]);
src/app/views/tma/component-map.ts     export const map = new Map([ …TMA entries… ]);
```

`select-view.mjs` writes a one-line generated re-export:

```ts
// src/app/state/view.generated.ts — GENERATED by scripts/select-view.mjs. Do not edit.
export { map as selectorComponentMap } from '../views/tma/component-map';
```

`app.module.ts` imports `selectorComponentMap` from that generated file instead of from
`customComponentMappings.ts`. Its `ngDoBootstrap` loop is unchanged.

The compiler only reaches code something imports, so an unselected family's components are **not
in the bundle** — not excluded by a rule, simply never reached.

**The failure this prevents, specifically:** a `Map` literal cannot hold two entries for one key.
NDE already claims `nde-header-before` for the announcement banner. If TMA ever wants something
else in that slot, a merged map silently keeps whichever line comes last — no error, no warning.
Separate maps make the collision impossible to express.

`customComponentMappings.ts` is deleted; its five entries move verbatim into
`src/app/views/nde/component-map.ts`, comments included. The commented-out
`nde-ill-request-top` / `IllPickupLibrarySorterComponent` line moves with them.

### 5.5 Styles and assets — two different mechanisms

Styling reaches the browser two ways in this repository, and they need different treatment.

**(a) Compiled into the bundle.** `angular.json` lists `src/styles.scss` and
`src/app/styles/_customized-theme.scss` (emitted as `custom`, `inject: false`) under `styles`;
component-level `.scss` and component `.html` templates compile in too. These follow §5.4 exactly
— build-time import selection, unselected family never enters the bundle.

**(b) Copied verbatim, fetched by the host at a fixed path.** `angular.json` says
`"assets": ["src/favicon.ico", "src/assets"]` — the whole folder, unfiltered. Primo then fetches
well-known URLs from it:

| Path in the package | What it is |
|---|---|
| `assets/css/custom.css` | 25 KB of TAU rules — the live stylesheet |
| `assets/js/custom.js` | 3.8 KB of real TAU code (landing-page quick links → new tab) |
| `assets/header-footer/footer_{en,he}.html` | host-fetched, host picks by language |
| `assets/homepage/homepage_{en,he}.html` | same pattern |

(`src/assets/css/custom.js` is a deliberate 174-byte empty placeholder — leave it.)

**The constraint that decides the design:** Primo requests a *fixed* path. There is no way to tell
it to fetch `custom-tma.css`. Nothing is being compiled, so nothing can be selected by import.
The build must **place the right file at the fixed path**:

```
src/assets/
  css/custom.css                 ← GENERATED, do not edit
  js/custom.js                   ← GENERATED, do not edit
  header-footer/footer_en.html   ← GENERATED, do not edit
  header-footer/footer_he.html   ← GENERATED, do not edit
  homepage/homepage_en.html      ← GENERATED, do not edit
  homepage/homepage_he.html      ← GENERATED, do not edit
  views/
    nde/…                        ← edit these for NDE
    tma/…                        ← edit these for TMA
```

`select-view.mjs` copies `src/assets/views/<family>/**` over the fixed paths. Every generated file
carries a header comment naming its real source.

**Rejected:** generating `assets/css/custom.css` as a one-line `@import` of the family's real
stylesheet. It adds a second CSS round-trip, and the known cache behaviour after a package upload
(the browser serves the *old* `custom.css` until hard-refreshed) would then apply to two files
instead of one. Copying keeps one fetch.

### 5.6 Accepted cost

For components, the unselected family's code genuinely never enters the package. For assets it
does: `angular.json` copies `src/assets` wholesale, so the NDE package will contain
`assets/views/tma/css/custom.css`, unused and readable.

That is a few KB and carries no functional risk — the host only ever fetches the fixed path, which
holds the right file. Eliminating it means per-view globs in `angular.json`, an Ex Libris-owned
file currently identical to upstream. Not worth the permanent conflict for a few KB.

### 5.7 Three existing things this breaks

These fail in ways that are easy to miss, so each is a required part of the work, not a follow-up.

1. **`postbuild.js:34` has an exemption list that must be extended.**

   ```js
   const VIEW_SELECTION_FILES = ['build-settings.env', 'src/app/state/asset-base.generated.ts'];
   ```

   This is what stops a view switch from marking the tree dirty. Add generated CSS/JS/HTML without
   adding them here and **every package builds as `-dirty`** — which by TAU's own rule makes every
   package unuploadable. It fails loudly, but only after a build and an attempted deploy.

2. **`docs/features/landing-banner-customization.md` points at the wrong file.** `CLAUDE.md`
   instructs everyone to read that playbook before touching any banner or CSS styling, and it sends
   them to `src/assets/css/custom.css` — which becomes a generated file. The doc must be updated in
   the same commit, or the project's own rule contradicts the repository.

3. **`.upstream-sync/owned-files.json` needs the new paths.** `src/app/views/**` and
   `src/assets/views/**` are TAU-owned and should be declared so the sync skill flags changes to
   them. `scripts/select-view.mjs` belongs under `build-infrastructure`.

## 6. Rejected alternatives

**A second repository.** The strongest-sounding option, since TMA shares no components. It
duplicates the part TMA *does* share: the Ex Libris Angular 18 skeleton, module-federation config,
`prebuild.js`/`postbuild.js`, the proxy, `debug.util.ts`, `auto-asset-src.directive.ts`, and the
fork relationship itself. That means two forks of `ExLibrisGroup/customModule`, two
`.upstream-sync/owned-files.json`, and every Angular bump or host-contract change from Ex Libris
done twice. That cost recurs forever and grows. "Its own build" and "its own repository" are
different questions, and the build is already per-view.

**A long-lived TMA branch.** Same divergence as two repositories, with less discipline: no PR
gate, no review, and shared fixes silently applied to one side only. `main` is production for this
repository — there is no `prod` branch — so a permanent second branch has no promotion path either.

**Runtime filtering instead of build-time selection.** Register everything, skip what isn't for
this view at `ngDoBootstrap`. Simpler, but every package carries every family's code, and it does
not solve the duplicate-slot collision in §5.4 — the merged map still can't express two components
for `nde-header-before`.

## 7. Rollout — branch first, both builds verified, merge last

**All work happens on `feature/67-per-view-isolation`, branched from `main`. Nothing merges
until both packages have been built from that branch and verified.** This is not a formality: the
refactor moves the file the live production stylesheet is served from, and `main` is production
for this repository.

### 7.1 Build gate — run before opening the PR for review

Both builds, from the branch, in this order:

```bash
# 1. NDE — the regression case
#    edit build-settings.env → VIEW_ID=NDE
npm run build

# 2. TMA — the new case
#    edit build-settings.env → VIEW_ID=TMA_NDE
npm run build
```

For **each** package, confirm:

- [ ] The build succeeded and `postbuild.js` archived it to `~/tau-packages/` **without a
      `-dirty` suffix**. A `-dirty` package here means §5.7 item 1 was missed.
- [ ] Unzip it and list `assets/css/custom.css`, `assets/js/custom.js`, and the header/footer HTML.
      Each must be the **selected family's** content, not the other one's.
- [ ] Boot the package through the dev proxy with `?tauDebug=1` and read the registration lines.
      The NDE build must register exactly the five components in §1. The TMA build must register
      exactly TMA's set and **none of NDE's**.

Then the gate that matters most:

- [ ] **The NDE package built from the branch behaves identically to the NDE package built from
      `main`.** Build NDE from `main`, unzip both, and diff the asset files byte-for-byte —
      `custom.css`, `custom.js`, and all four header/footer/homepage HTML files must be identical.
      Any difference is a bug in the refactor, not an improvement. Goal 5 is this checkbox.

### 7.2 Live verification — before merge, not after

- [ ] Upload the TMA package to the **`TMA_NDE` test view** and confirm it loads: the boot banner
      names `972TAU_INST-TMA_NDE`, and TMA's components appear while NDE's do not.
- [ ] Do **not** upload anything to `NDE` from this branch. Production NDE keeps running its
      current package throughout.

### 7.3 Merge

Only after §7.1 and §7.2 are complete and recorded in the PR. Merging does not deploy — pushing
`main` updates no live view — but it makes this the source everyone builds from, so the NDE
regression gate has to be green first.

## 8. Open questions

1. **Which components does TMA actually need?** Unknown until the design work starts. The design
   assumes the answer is "some subset of NDE's, plus new ones"; if it turns out to be "none of
   NDE's", nothing here changes.
2. **Does TMA need its own Material theme,** or only its own `custom.css`? Affects whether
   `src/styles.scss` and `_customized-theme.scss` also need per-family splits (§5.5a) or can stay
   shared for now. Recommend deferring until TMA's design is known — the seam is the same either way.
3. **Does the old classic TMA package contain anything beyond CSS/HTML worth porting?** Worth
   reading before TMA styling starts, so the design intent is captured once rather than
   rediscovered.
