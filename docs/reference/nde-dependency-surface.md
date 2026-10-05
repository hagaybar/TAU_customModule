# NDE Dependency Surface — what this module relies on in the Primo NDE host

**Written:** 2026-10-05 for issue #75 (Primo NDE Angular 19 → 20, February 2027 release)
**Reflects commit:** `bbb852a` (`main` at time of writing)
**Purpose:** the complete list of host behaviour, markup and runtime this package depends on, so
the Angular 20 upgrade has a finite list to re-verify. Every entry cites the file and line that
creates the dependency. Where something is *not* verified, it says so.

Scope: the `nde` family (`VIEW_ID=NDE`, live; `NDE_TEST`) and the `tma` family (`TMA_NDE`, `TMA`).
Family selection is described in `CLAUDE.md` → *Per-view content*.

**The short version.** No mapped component injects a host service, the host NgRx `Store`, the
host `TranslateService`, or a `hostComponent` input (grep of `src/app`, excluding specs and the
disabled ILL sorter). Every coupling is one of: (1) the shared Angular runtime, (2) extension-slot
names, (3) host DOM — element tags, classes, `data-qa` attributes — read with
`querySelector`/`closest`/`MutationObserver`, (4) `<html lang|dir>` and URL parameters, and
(5) host selectors and `--sys-*` tokens in the host-fetched `custom.css`.

---

## 1. Shared runtime (module federation)

`webpack.prod.config.js` is `...require('./webpack.config')` plus `mode: 'production'` and
`devtool: false` — the shared list is identical. It is declared at `webpack.config.js:76-86`,
via the `share()` helper from `@angular-architects/module-federation`.

What `share()` does with these entries (read from
`node_modules/@angular-architects/module-federation/src/utils/share-utils.js:158-183`):
`requiredVersion: "auto"` is replaced by the range in our `package.json` (e.g. `^18.2.8`), `version`
by that range stripped of its prefix, and `includeSecondaries` defaults to `true`, so secondary
entry points (`@angular/core/primitives/*`, `@angular/common/http`, …) are shared too. It sets
**no** `singleton` and **no** `strictVersion` on the `auto` entries.

| Package | `webpack.config.js` | Settings | `package.json` range | Installed (`package-lock.json`) |
|---|---|---|---|---|
| `@angular/core` | :77 | `requiredVersion: auto` → `^18.2.8` | `^18.2.8` | 18.2.8 |
| `@angular/common` | :78 | `auto` → `^18.2.8` | `^18.2.8` | 18.2.8 |
| `@angular/router` | :79 | `auto` → `^18.2.8` | `^18.2.8` | 18.2.8 |
| `rxjs` | :80 | `auto` → `~7.8.0` | `~7.8.0` | 7.8.1 |
| `@angular/common/http` | :81 | `auto` (secondary of `@angular/common`) | — | 18.2.8 |
| `@angular/platform-browser` | :82 | `auto` → `^18.2.8` | `^18.2.8` | 18.2.8 |
| `@ngx-translate/core` | :83 | `singleton: true`, no `requiredVersion` | `^15.0.0` | 15.0.0 |
| `@ngrx/store` | :84 | `singleton: true`, no `requiredVersion` | `^18.1.0` | 18.1.0 |

**Not shared — bundled into our `remoteEntry.js`**, but built against the shared `@angular/core`:
`@angular/material` 18.2.9, `@angular/cdk` 18.2.9, `@angular/elements` 18.2.8,
`@angular/animations`, `@angular/compiler` 18.2.8 (JIT, imported at `src/bootstrap.ts:1`),
`@angular-architects/module-federation-tools` **19.0.1** (a devDependency, yet it is the runtime
`bootstrap()` at `src/bootstrap.ts:3,6`). `zone.js` 0.14.10 is in our `polyfills`
(`angular.json`); whether the host loads our polyfills bundle at all is **not verified** — the host
loads `remoteEntry.js` and calls the exposed `./custom-module` (`webpack.config.js:67-69`).

**Why each is a risk in 18 → 20** (we are on 18; the host is on 19 today and will be on 20):

- **`@angular/core`, `common`, `router`, `platform-browser`, `common/http`.** A host on 19 or 20 does
  not satisfy `^18.2.8`. For a non-singleton shared module webpack falls back to the remote's own
  bundled copy when no registered version satisfies the range. **Verified 2026-10-05 on the live
  `NDE` view: we already run our own Angular 18 inside a 19 host** — `<nde-app-root>` carries
  `ng-version="19.1.3"`, our `<nde-header-before-from-remote-0>` carries `ng-version="18.2.x"`.
  The smoke test prints both on every run (`ng-version` line). So the February move to 20 is the
  same situation as today, one major further apart, not a new one. Two Angular cores on one page is what makes host
  `providers` (below) and host-created custom elements fragile across a major. This is the
  single highest risk.
- **`@ngrx/store`, `@ngx-translate/core` (singletons, no version check).** We get the host's
  copy, whatever version it is. Nothing mapped uses either today, so the risk is latent: it becomes
  real the day a component injects `Store` (see `project_nde_host_store_access` work on branch
  `feature/19-host-store-access`, not on `main`).
- **`rxjs`.** `~7.8.0`; Angular 20 still uses rxjs 7, so low risk.
- **Bundled Material/CDK 18.** Our Shelf Map button and dialog render with *our* Material, inside a
  host that runs its own Material. Both create a `.cdk-overlay-container` on `<body>`; whether they
  coexist cleanly after the host moves to 20 is **not verified**. Our SCSS also targets Material-18
  MDC token names (§3.3).
- **`module-federation-tools` `bootstrap()`.** Shares a platform per Angular `VERSION` and a global
  `NgZone` (`angular-architects-module-federation-tools.mjs:129-217`). A host/remote version split
  produces a second platform; a zone-less Angular 20 host would change the `NgZone` sharing.

### Bootstrap and registration mechanics

| What | Where | Host dependency |
|---|---|---|
| Host calls the exposed `bootstrapRemoteApp(bootstrapOptions)` | `src/bootstrap.ts:5-13` | The host's call contract: `{providers, shellRouter}` |
| `bootstrap(AppModule(...), {production: true, appType: 'microfrontend'})` | `src/bootstrap.ts:6-9` | module-federation-tools platform/zone sharing |
| `AppModule` is a factory over host-supplied `providers` and `shellRouter` | `src/app/app.module.ts:19,32` | Whatever providers the host passes — unknown to us, host-controlled |
| `SHELL_ROUTER` token wraps the host router | `src/app/injection-tokens.ts:4`, `app.module.ts:32` | Provided but **not injected anywhere** today |
| Our own `Router` is injected and `dispose()`d so it does not fight the host router | `app.module.ts:42` | Relies on `Router.dispose()` existing |
| `BrowserModule`, `HttpClientModule`, `TranslateModule.forRoot({})` | `app.module.ts:25-29` | `HttpClientModule` is deprecated from Angular 18 (`provideHttpClient()`); still present in 20 per our reading, **re-check** |
| Map read from the generated re-export | `app.module.ts:10`, `src/app/state/view.generated.ts:3` | — |
| Each entry → `createCustomElement(component, {injector})`, stored, **not** `customElements.define()`d | `app.module.ts:54-58` | **The host** defines the elements, under `'<slot>-from-remote-<n>'` (comment `component-map.ts:40-41`), by calling `getComponentRef(slot)` (`app.module.ts:70`) |
| Boot banner, always printed | `app.module.ts:48-49` → `src/app/services/debug.util.ts:152-182` | Text: `[TAU] custom module · 972TAU_INST-<VIEW> · debug logging ON/OFF (<reason>)` |

---

## 2. Extension slots

The host mounts each component as a custom element named `<slot>-from-remote-<n>` —
`customElements.get('nde-header-before')` is `false` by design (`component-map.ts:40-41`). The
custom element *is* the component host: our `tau-*` selectors never appear in the DOM. The suffix
was observed live for `nde-header-before` (2026-08-02) and
`nde-collection-discovery-gallery-top` (2026-09-07, inside an `ng-component` wrapper,
`component-map.ts:47-50`); for the other three slots it is assumed from the same mechanism.

### `nde` family — `src/app/views/nde/component-map.ts`

| Slot | Line | Component | Page | Placement |
|---|---|---|---|---|
| `nde-filters-group-before` | :17 | `FilterAssistPanelComponent` | Results, `/nde/search?query=…` | Filter sidebar; mounted once **per filter group**, only one renders |
| `nde-search-no-results-bottom` | :23 | `NoResultsExternalLinksComponent` | Results with zero hits | Last child of `<nde-search-no-results>` |
| `nde-location-top` | :26 | `CenlibMapButtonComponent` | Full record, `/nde/fulldisplay?docid=…` | Per `<nde-location>` in Get It; several instances per location |
| `nde-header-before` | :42 | `AnnouncementBannerComponent` | Every page | Sibling *before* `<nde-header>`, above `header.top-bar`; outside the router outlet, never destroyed |
| `nde-collection-discovery-gallery-top` | :51 | `CollectionDiscoveryFilterComponent` | `/nde/collectionDiscovery` (lobby and every level) | First child of `<nde-collection-discovery-gallery>` |

**Disabled:** `['nde-ill-request-top', IllPickupLibrarySorterComponent]` (`component-map.ts:54`,
import commented out at :6). It is the only component that would use host internals:
`@Input() hostComponent` (`ill-pickup-library-sorter.component.ts:29`), `window.ng.getComponent`
on `nde-ill-request` (:70-81), the host's `requestService._formFields` (:101-111) and the shared
`TranslateService` (:36, :140). Treat it as unverified against 19, let alone 20, before enabling.

Other slots verified to exist but unused: `nde-header-top`, `nde-header-bottom`, `nde-header-after`
(`component-map.ts:33-36`); `nde-search-no-results` (full replacement — replaced by `-bottom` per
issue #4, :19-22).

### `tma` family — `src/app/views/tma/component-map.ts`

Empty map (`:19`): a TMA build registers zero components. TMA depends on the host only through
§1 bootstrap and §4 assets.

---

## 3. Host DOM and internals, per component

Shared helpers first, because three components use them.

### 3.1 Shared services

| Helper | Host dependency | Where |
|---|---|---|
| `readUiLanguage()` | `document.documentElement` `lang` (prefix `he`), then URL `?lang=`, then `<html dir="rtl">` | `src/app/services/ui-language.ts:32-44` |
| `watchUiLanguage()` | `MutationObserver` on `<html>`, `attributeFilter: ['lang','dir']` — relies on the host rewriting `<html lang/dir>` on an in-app language switch, and on its router using `pushState` (no `popstate`) | `ui-language.ts:58-75` |
| `SearchQueryService` | `window.location.search`: `query` (all, format `field,op,term,bool`), `pfilter` (all), `lang` (`he`/`he_IL`) | `filter-assist-panel/services/search-query.service.ts:18,48,67,121-122` |
| `AutoAssetSrcDirective` / `AssetBaseService` | Prefixes asset paths with `/nde/custom/972TAU_INST-<VIEW>` (generated) — relies on the host serving the package at that path | `services/auto-asset-src.directive.ts`, `services/asset-base.service.ts`, `state/asset-base.generated.ts:1` |
| Debug switches | `?tauDebug=`, `localStorage.tauDebug`, `window.__TAU_DEBUG__` | `services/debug.util.ts:99-135` |
| Usage tracking | `fetch()` to Mixpanel EU; view id derived from the build constant, not the host | `services/usage-tracking.ts:28,50-53,87-99` |

### 3.2 Per component

**FilterAssistPanelComponent** — `custom1-module/filter-assist-panel/`
- Host DOM read: none. Inputs: URL `query`, `pfilter`, `lang` only (via `SearchQueryService`).
- Renders only when `query` is present (`filter-assist-panel.component.html:4`) and only in the
  first instance to register (`filter-assist-panel.component.ts:67`, registry service) — depends on
  the host destroying old instances when filters change.
- Visible DOM: `section.external-search-panel[role=complementary]` →
  `h3.external-search-panel__title` ("Search also in" / "לחפש במנועי חיפוש נוספים") →
  `ul.external-search-panel__list` → 3 × `a.external-search-panel__link[target=_blank]` (ULI,
  WorldCat, Google Scholar; Crossref is commented out, `config/external-sources.config.ts:79-92`),
  each with `img.external-search-panel__icon` and `span.external-search-panel__name`.

**NoResultsExternalLinksComponent** — `custom1-module/no-results-external-links/`
- Host DOM read: `document.querySelector('.we-suggest-container')` (the host's
  "expand results" box), retried 5 × 100 ms, then `ResizeObserver` on it to copy its width
  (`no-results-external-links.component.ts:73-97`). Absence is non-fatal (falls back to
  `fit-content`).
- URL: `query`, `pfilter`, `lang` (:54-57).
- Visible DOM: `section.tau-external-search` → `p.tau-external-search__title`
  ("Try searching in external sources:" / "נסו לחפש במקורות חיצוניים:") →
  3 × `a.tau-external-search__link` with `span.tau-external-search__label`. Renders unconditionally
  once mounted (no `*ngIf` on the section).
- Host CSS tokens: `--border`, `--sys-outline` (`no-results-external-links.component.scss:15-16`).

**CenlibMapButtonComponent** — `custom1-module/cenlib-map/` (most host-coupled component)
- `closest('nde-location')` (`cenlib-map-button.component.ts:179, 228, 324`).
- Inside it: `.getit-library-title` text (:186), `[data-qa="location-sub-location"]` text with a
  trailing `;` stripped (:192-198), `[data-qa="location-call-number"]` text (:202-205). All three
  must be non-empty or the button stays hidden.
- `MutationObserver` on `nde-location`, `childList + subtree`, until those appear; 500 ms retry
  (:231-249).
- Writes `data-tau-shelf-map-owner` on `nde-location` (:31, :342) and queries
  `button.cenlib-map-button` to detect a live sibling instance (:335, :413) — depends on the host
  creating several instances per location and destroying them.
- Finds `button.getit-locate-button`, **moves our host element** into its parent before it and sets
  it `display:none`; restores on destroy (:352-376, :387-427). Depends on the Locate button and its
  parent surviving our DOM move.
- Language: `readUiLanguage()` + `watchUiLanguage()` (:110-111, :160-170).
- `MatDialog` (our bundled Material) with `panelClass: 'cenlib-map-dialog-panel'` (:431-445);
  dialog reads `MAT_DIALOG_DATA` and URL `docid` (`cenlib-map-dialog.component.ts:73, 138`).
- Network, not host: CloudFront `mapping.csv` and `maps/floor_<n>.svg`
  (`config/data-source.config.ts:9-37`), falling back to the package copy under
  `assets/cenlib-map/` (`services/map-asset-fallback.ts:44-61`).
- Show condition: library title matches `Sourasky Central Library` / `הספרייה המרכזית סוראסקי`
  (`config/library.config.ts:53-57, 95-102`), sub-location is a configured location, and the CSV
  maps the call number.
- Visible DOM: `button.cenlib-map-button.mat-mdc-unelevated-button` (`mat-flat-button`) with
  `mat-icon` "location_on" and `span.button-text` "Shelf Map" / "מפת מדף", where the Locate button
  was (`cenlib-map-button.component.html:1-8`). Click → `.cdk-overlay-container
  .cenlib-map-dialog-panel` containing `tau-cenlib-map-dialog` and `tau-shelf-map-svg`.
- SCSS uses Material 18 MDC tokens `--mdc-filled-button-container-color`,
  `--mdc-filled-button-label-text-color`, `--mat-filled-button-state-layer-color` and host tokens
  `--sys-primary-container`, `--sys-primary` (`cenlib-map-button.component.scss:42-48`).

**AnnouncementBannerComponent** — `custom1-module/announcement-banner/`
- Host DOM read: none beyond `<html lang/dir>` (`announcement-banner.component.ts:99-102, 130-140`)
  and its own tag name for logging (:104-108).
- Depends on the slot being outside the router outlet (component lives for the whole session).
- `localStorage['tauAnnouncementDismissed:v2']` hides it (:64, :147-162).
- Visible DOM: `div.tau-announcement[role=status]` → `p.tau-announcement__text`
  ("Welcome to DaTA’s refreshed look, with the same familiar search experience from Tel Aviv
  University Libraries" / Hebrew at :87) + `button.tau-announcement__dismiss` (×)
  (`announcement-banner.component.html:1-18`). Styling uses only `--tau-announcement-*` tokens.

**CollectionDiscoveryFilterComponent** — `custom1-module/collection-discovery-filter/`
- `closest('nde-collection-discovery-gallery')` (`collection-discovery-filter.component.ts:15, 58`).
- `MutationObserver` on the gallery, `childList + subtree`, coalesced by `requestAnimationFrame`,
  outside the zone (:68-97).
- Each card is `nde-collection-discovery-gallery-collection`; its ID is the `collectionId` query
  parameter of the first `a[href*="collectionId="]` inside it (`collection-filter.ts:17, 20, 39-49`).
- Writes `display:none !important` and `data-tau-hidden-collection="<id>"` on matching cards,
  reversibly (`collection-filter.ts:27, 61-75`).
- IDs: `81444210450004146`, `81429943170004146` (`hidden-collections.config.ts:19-22`).
- Visible DOM: none of its own (`template: ''`, `:host {display:none}`, :38-39). The observable effect
  is the two cards being hidden.

---

## 4. Host-fetched assets and CSS

### 4.1 Files and fixed URLs

`scripts/select-view.mjs:44-49` maps a view to a family and copies every file under
`src/assets/views/<family>/` over the same relative path under `src/assets/` (:195-214); the
destinations are gitignored (`.gitignore:80-93`). The host fetches them from
`https://tau.primo.exlibrisgroup.com/nde/custom/972TAU_INST-<VIEW>/assets/<path>`.

| Package path | `nde` | `tma` | Fetched when |
|---|---|---|---|
| `assets/css/custom.css` | yes | yes | Every page |
| `assets/js/custom.js` | yes — quick links → new tab | yes — homepage card `vid` rewrite | Every page (~1.2 s, `nde/css/custom.css:205`) |
| `assets/header-footer/footer_{en,he}.html` | yes | yes | Every page, by language |
| `assets/homepage/homepage_{en,he}.html` | ships, unused | yes | Only when Back Office Landing Page "Enable configuration" is **off** (`docs/features/tma-view-changelog.md:47-51`) |
| `assets/homepage/homepage.css` | — | yes | Same condition |
| `assets/images/library-logo.png`, `library-logo-he.png` | yes | yes | Header logo |
| `assets/icons/favicon.ico` | yes | yes | — |
| `assets/images/loadingAnimations/LoadingAnimationJson.json` | yes | yes | Boot; host falls back to `/nde/assets/images/loadingAnimations/…` if absent (`docs/troubleshooting/loading-animation-color-not-themed.md:24-27`) |
| `assets/images/tma-*.jpg` | — | yes | Via `custom.css` / homepage |

Not per-view, also fetched: `assets/images/homePageImages/search_background_{en,he}.png` (via
`nde` `custom.css`), `assets/images/external-sources/*.png` (via `AutoAssetSrcDirective`),
`assets/cenlib-map/` (fallback maps). `src/assets/css/custom.js` is an unused 174-byte template
placeholder.

Host markup the scripts rely on:
- `nde/js/custom.js:28, 38, 55, 91-100` — `nde-landing-quick-links a[href]`, `<html lang>`,
  `MutationObserver` on `body` and on `<html lang|dir>`; mirrors host label `nde.aria.opensInaNewTab`.
- `tma/js/custom.js:29, 33, 63-72` — `a.tma-card[href*="vid="]` (our own homepage HTML), URL `vid`.
- `nde/homepage/*.html` uses host typography classes `mat-headline-medium`, `mat-title-medium`,
  `mat-body-large`, `mat-headline-large` (`homepage_en.html:101-121`) — inert while the landing
  page is native.
- `tma/homepage/homepage.css:16, 79, 94` — `.mat-typography` scoping, `--sys-primary`,
  `--sys-on-surface-variant`.

### 4.2 `nde` `custom.css` — every host selector (`src/assets/views/nde/css/custom.css`)

| Area | Lines | Host selectors / tokens |
|---|---|---|
| My Account | 5 | `nde-personal-settings button.text-align-for-update-credentials` |
| Get It / location | 24 | `.getit-library-title.mat-title-medium` |
| | 33 | `.view-it-title.mat-title-small.ng-star-inserted span` (`ng-star-inserted` is an Angular animation class — fragile) |
| | 52 | `nde-locations-container [data-qa="location-call-number"]` |
| | 67 | `nde-location-item .getit-items-brief-property:nth-child(3) span[ndetooltipifoverflow]` (positional) |
| | 372 | `nde-requests .no-requests` (host paints it with `--sys-error-container`) |
| Fines | 41 | `mat-card-title.mat-mdc-card-title.margin-bottom-medium` |
| Typography | 78-84 | `nde-app-root`, `nde-view`, `body` (plus inert `prm-*`) |
| Snackbar | 98, 102 | `mat-snack-bar-container.mat-mdc-snack-bar-container`, `--mdc-snackbar-container-color`, `.mdc-snackbar__surface` |
| RTL / buttons | 107 | `html[dir="rtl"] .dropdown-group` |
| | 111-112 | `.ti-browzine-button-container .ti-custom-button-text custom-svg-icon / .icon` (third-party BrowZine) |
| | 116 | `.mdc-button__label .quicklink-button-text` |
| Header | 125-126 | `html[lang="he"] nde-logo img`, `html:not([lang])[dir="rtl"] nde-logo img` |
| Banner | 135-143 | `.top-bar-background-image`, `.landing-search-background-image` (beats an inline style) |
| | 156-161 | `.landing-search-background-img` (host `<img>`, repainted with `content:`) |
| Search bar | 170 | `.advanced-search-button` |
| | 226 | `.search-container:has(nde-landing-page-config) > nde-top-bar:not(.top-bar-not-sticky)` — boot-flash suppression |
| | 308-318 | `.search-container:not(:has(nde-landing-page-config)) > nde-top-bar` and its `.search-dropdown-container-button-text`, `.search-dropdown-container-button-icon`, `.advanced-search-button`, `.mdc-button__label` |
| Landing | 181 | `nde-landing-about .help-sign-in-container ul` |
| Results | 249-256 | `nde-record-type span.record-type`, `--sys-primary`, `--sys-on-primary` |
| Main menu | 333 | `html[lang="he"] .main-menu-container .show-more-btn .mdc-button__label` |
| Legacy, inert in NDE | 12, 16 | `prm-location-items …`, `md-list-item …` |

Host layout facts the rules assume: the results top bar is a **direct child** of
`div.search-container`; the landing bar is nested under `.custom-search-bar-container`; the
full-record bar carries `.top-bar-not-sticky`; `<nde-landing-page-config>` exists only on the
landing route (`custom.css:186-229, 285-307`).

**Drift in `docs/features/landing-banner-customization.md`** (cross-checked for this document): its
inventory still lists `.landing-search-background-image .top-bar-container { width:75% }`, which is
**not** in the current file, and it omits `.landing-search-background-img`, `.advanced-search-button`,
`nde-landing-about …`, `nde-record-type span.record-type`, and the search-band rules (308-320).
This table is the current one.

### 4.3 `tma` `custom.css` (`src/assets/views/tma/css/custom.css`)

| Lines | Host selectors / tokens |
|---|---|
| 42-43 | `.top-bar-background-image`, `.landing-search-background-image` (`!important` vs inline style) |
| 75-76 | `header.top-bar nde-language-selector-container`, `header.top-bar nde-user-area` |
| 92 | `.mat-mdc-snack-bar-container:has(.login-btn)` |
| 119-130 | `--sys-primary`, `--sys-on-surface-variant`, `--sys-on-surface` (on our own `.tma-footer`) |
| 149 | `[id="nui.brief.results.tabs.links"]` — host id built from a label code |

(The header comment at :5 names a view `TMA_NDE_TEMP`, which `VIEW_FAMILY` does not declare.)

### 4.4 Host CSS custom properties we consume

`--sys-primary`, `--sys-on-primary`, `--sys-primary-container`, `--sys-outline`,
`--sys-on-surface`, `--sys-on-surface-variant`, `--border` (host theme tokens), and Material/MDC
component tokens `--mdc-snackbar-container-color`, `--mdc-filled-button-*`,
`--mat-filled-button-state-layer-color`. Component-token names are tied to the Material major —
the host's for `custom.css`, ours for component SCSS.

---

## 5. Re-verification checklist for Angular 20 (highest risk first)

| # | Item | How to check |
|---|---|---|
| 1 | Module loads at all; shared Angular resolves | Boot banner `[TAU] custom module · 972TAU_INST-<VIEW> · …` in console; inspect `__webpack_share_scopes__.default['@angular/core']`; no "Unsatisfied version" / NG0 errors. Smoke test. |
| 2 | Host still calls `bootstrapRemoteApp({providers, shellRouter})` and defines `<slot>-from-remote-<n>` | `[...document.querySelectorAll('*')].filter(e => e.localName.includes('-from-remote-'))` lists the mounted slots; with `?tauDebug=1`, the log shows "Total components to register: 5". Smoke test. |
| 3 | Each of the five slots still exists and mounts | Per page in §2: header banner on any page; filter panel on `/nde/search?query=…`; no-results box on a zero-hit search; Shelf Map on a Sourasky record; collection cards hidden on `/nde/collectionDiscovery`. Smoke test. |
| 4 | Shelf Map host DOM (`nde-location`, `.getit-library-title`, two `data-qa` attributes, `button.getit-locate-button`) | Button appears in the Locate button's place, Locate hidden; dialog opens and renders a floor map. |
| 5 | Material/CDK overlay coexistence (our 18 or upgraded, host 20) | Open the Shelf Map dialog; check it is styled, on top, closable; host menus/snackbars still work afterwards. |
| 6 | Collection Discovery DOM (`nde-collection-discovery-gallery`, `…-gallery-collection`, `collectionId` links) | Both configured IDs hidden at lobby level, in `en` and `he`; drill in and back. |
| 7 | `<html lang/dir>` rewrite on language switch | Switch language in-app: banner text and Shelf Map label follow without reload. |
| 8 | URL parameters `query`, `pfilter`, `lang`, `docid`, `vid` | External links carry the search term; Mixpanel event has `record_id`. |
| 9 | `.we-suggest-container` on no-results | External box width matches the host box (cosmetic). |
| 10 | `custom.css` selectors (§4.2, §4.3) | Each selector matches ≥1 element on its page (`document.querySelectorAll`); spot-check computed style for banner, logo, search band, pill chip, call-number LTR. Smoke test for the key ones. |
| 11 | Host theme tokens `--sys-*` still defined | `getComputedStyle(document.documentElement).getPropertyValue('--sys-primary')` non-empty. |
| 12 | Host-fetched files still requested at the same paths | Network tab: `assets/css/custom.css`, `assets/js/custom.js`, `footer_<lang>.html`, `LoadingAnimationJson.json` return 200 from `/nde/custom/972TAU_INST-<VIEW>/`. |
| 13 | `custom.js` targets (`nde-landing-quick-links a[href]`; TMA `a.tma-card`) | External quick links get `target=_blank`; TMA cards carry the current `vid`. |
| 14 | `HttpClientModule`, `Router.dispose()`, JIT `@angular/compiler` import | Build succeeds on 20 without deprecation errors; boot completes. |
| 15 | Disabled ILL sorter | Do not enable without a separate review — depends on `window.ng.getComponent` and private host fields. |

Related: issue #75; `docs/superpowers/specs/2026-09-09-per-view-isolation-design.md`;
`docs/features/collection-discovery-filter.md`; `docs/features/landing-banner-customization.md`;
`scripts/compare-packages.mjs` for the package-level diff.
