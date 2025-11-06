# External Search Enhancements – Migration Plan

## Goals
- Recreate and modernize the legacy Primo classic “External Search” facet and no-results links for the Primo NDE microfrontend.
- Deliver institution-specific external targets (ULI, WorldCat, Google Scholar, etc.) with Hebrew/English support and dynamic query mapping.
- Ensure the enhancement is configurable, testable, and works when packaged as the Angular Module Federation remote.

## Key Differences vs. Legacy Implementation
- **Framework**: Legacy code used AngularJS components injected into Primo classic templates. New implementation must use Angular 18 components registered through `selectorComponentMap`.
- **View Model Access**: Instead of `$location` and `prmFacetCtrl`, we must rely on NDE-provided context (event payloads, query params, or exposed services). If NDE lacks direct APIs, we fall back to parsing the current URL and using Primo’s custom events.
- **Templating**: Legacy used static HTML (`externalSearch.html`). We will replace this with Angular component templates and optionally reuse `.html.tmpl` fragments for ease of editing.
- **Styling/Assets**: Move image assets to `src/assets/images` and ensure access via `AutoAssetSrcDirective` or direct bundling to avoid hard-coded `custom/<vid>` paths.

## Proposed Architecture
1. **Configuration Layer**
   - Create `ExternalSearchConfig` TypeScript interface with multilingual labels, icon references, and a `buildUrl` function (successor to `mapping`).
   - Store default configuration in `src/app/config/external-search.config.ts`. Allow overrides via environment JSON (e.g., new file under `src/assets/config/external-search.json`) loaded at runtime.

2. **Shared Services**
   - `ExternalSearchService`:
     - Determines active Primo language (from query string or host-provided context).
     - Builds normalized search queries/filters (replicating legacy `mapping` logic).
     - Exposes an observable list of targets with computed URLs.
   - `PrimoQueryService` (if not provided by NDE SDK):
     - Reads current search state from query params or host events.
     - Watches for state changes (route updates) to keep component in sync.

3. **UI Components**
   - `ExternalSearchFacetComponent`:
     - Registered via `selectorComponentMap` under the appropriate region (to confirm with NDE docs; candidate selectors: `nde-facet-exact-after` or similar).
     - Renders facet title and list of external links, respecting RTL/LTR direction and translations.
     - Supports optional expansion/collapse behavior to mimic facet UX.
   - `ExternalSearchNoResultsComponent`:
     - Registered to the no-results drop zone (confirm selector, e.g., `nde-no-results-after`).
     - Displays external link card with translated labels and icons.

4. **Styling**
   - Create SCSS module (`external-search.component.scss`) with bidi-aware styles.
   - Provide shareable mixins/variables if both components require common styling.

5. **Testing**
   - Unit tests for `ExternalSearchService` to cover query normalization and URL generation.
   - Component tests using Angular TestBed to verify rendering for EN/HE languages and fallback scenarios.
   - Optionally add e2e smoke test (if infrastructure allows) to confirm module exposes components correctly.

## Implementation Steps
1. **Discovery (1–2 days)**
   - Confirm NDE drop-zone selectors, available inputs, and event APIs.
   - Review Primo NDE customization docs (e.g., Ex Libris GitHub wiki, `README.md` in this repo, Alma BO help) to enumerate supported selectors for facets and result tiles.
   - Capture findings in an internal reference table (selector → description → required inputs) to drive `selectorComponentMap` updates.
   - Validate how queries and filters are exposed in NDE (URL, state service, etc.).
   - Collect current asset files (logos) and translation strings.
   - **Filters pane selectors (current findings)**:
     - Toolbar wrapper remains present even when collapsed: `div.filters-container[data-height-id="filtersContainer"]` → `div.filters-wrapper` → `button#allFilterToggleButton`.
     - Quick-filter carousel lives under `div.quick-filters-and-filters-container` with `div#button-list.quick-filters-items-list` housing `nde-selected-filters-container` and `nde-quick-filters`.
     - Expanded drawer toggles the class on `div.results-container` between `filters-slide-open`/`filters-slide-closed`; the right column is `div.filters-side-bar-content.filters-layout-right`.
     - Insert the external module into the blue-highlighted area by targeting `nde-search-filters-side-nav .scroller-content` and calling `insertBefore(newNode, firstChild)` so the element sits above the existing slide toggles.

2. **Foundations**
   - Generate configuration and service scaffolding (`ng generate service`).
   - Port legacy mapping logic into TypeScript utilities with unit tests.
   - Add runtime configuration loader (optional: HTTP fetch of JSON with caching).

3. **Facet Component**
   - Scaffold Angular component and template.
   - Subscribe to `ExternalSearchService` for target data; handle loading/error states.
   - Implement on-init facet registration if needed (e.g., push facet metadata to host via exposed API or mimic facet-like layout internally).
   - Map component into `selectorComponentMap` once the correct drop-zone selector is confirmed (e.g., patterns such as `nde-recommendations-before`, `nde-header`, `nde-footer` per upstream README/header-footer guide).
   - Add bilingual labels and direction handling (use Angular Material typography and `[dir]` attribute).

4. **No-Results Component**
   - Scaffold component mirroring legacy link card.
   - Use same service for query and target URL generation.
   - Support translation via `@ngx-translate` or internal dictionary.

5. **Integration**
   - Update `selectorComponentMap` to register new components for the identified selectors (facet drop zone + no-results tile). Document selector usage inline for future reference.
   - Ensure assets referenced in configuration exist under `src/assets/images` and leverage `autoAssetSrc`.
   - Add translations to `src/assets/i18n` (if translation files exist) or inline dictionaries.

6. **Styling & Accessibility**
   - Apply Material card/list styling or custom SCSS.
   - Ensure links include accessible labels (`aria-label`, translate pipes).
   - Verify LTR/RTL layout and keyboard navigation.

7. **Testing & Verification**
   - Run unit tests (`npm run test`) and adjust for new specs.
   - Manually validate in local NDE environment with `npm run start` (with `useLocalCustomPackage=true`) and `npm run start:proxy`.
   - Document manual verification checklist (EN/HE, facet insertion order, link correctness).

8. **Documentation & Handoff**
   - Update `SPECS.md` with new components/services.
   - Provide README section for maintaining `external-search.config`.
   - Prepare config template for institutions to add/remove targets.

## Open Questions
- Exact NDE selectors for facet and no-results injection must be confirmed.
- Which host lifecycle hooks or events expose facet context in NDE (documentation reference needed)?
- Determine best source for language and query state in NDE (query params vs. SDK).
- Clarify whether facet should appear in a dedicated group or integrated within existing facet group UI.
- Verify asset hosting guidelines for NDE (relative vs. absolute URLs) to ensure compatibility with `AutoAssetSrcDirective`.
- Compile authoritative selector catalog. Tentative sources: Ex Libris Knowledge Center “NDE customization points”, GitHub CustomModule README, in-app DOM inspection (`nde-...` elements), and network panel responses providing component manifests.
