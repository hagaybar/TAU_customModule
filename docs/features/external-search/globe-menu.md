# External search: globe menu (trial)

**Status (2026-10-05):** on trial in `NDE_TEST`, from an unmerged branch. Not on `NDE`.

A globe button in the results toolbar, just before **All Filters**. It opens a menu of the
external sources in `filter-assist-panel/config/external-sources.config.ts` (ULI, WorldCat,
Google Scholar), each carrying the current query. The placement copies ULiège's NDE view
(`32ULG_INST:NDE`), which mounts the same slot.

While on trial, the sidebar panel (`nde-filters-group-before` → `FilterAssistPanelComponent`) is
commented out in `src/app/views/nde/component-map.ts`, so the two are never shown together.

## How it behaves

- **Slot:** `nde-search-bar-filters-before`. Seen live as
  `nde-search-bar-filters-before-from-remote-0` on both ULiège and TAU. The host only renders it
  on the results page; it is absent from the home page.
- **Only after a search:** the component also renders nothing unless the URL holds a `query`.
  It re-reads the URL each time the menu opens, because the host navigates with pushState and the
  slot survives an in-app search. Verified: a second search typed on the results page produced
  links for the new term.
- **Language and direction:** language comes from `readUiLanguage()` / `watchUiLanguage()`
  (`src/app/services/ui-language.ts`). In Hebrew the block is `dir="rtl"`, names come from
  `nameHe`, and the menu is anchored to the button's right edge, so it grows away from the page
  edge. The host mirrors the toolbar itself, so the button lands to the right of the filters
  button in Hebrew without any work on our side.
- **Menu:** `position: fixed`, placed from the button's rect, so the toolbar's horizontal-scroll
  container cannot clip it. Closes on outside click, Escape (focus returns to the button), Tab,
  resize, any scroll, a language switch, and choosing a link. Arrow keys, Home and End move
  between items.

## Options 1 + 3: label on the button, prompt after the results

Staff said nobody would understand the globe without hovering. The staff page
(`globe-button-options`) offered three fixes and recommended 1 + 3 together. Both are on branch
`feature/globe-label-plus-prompt`, built on top of this one.

- **Option 1, label on the button:** the trigger now shows "Search in external sources" /
  "חיפוש במקורות חיצוניים" and a drop-down caret, like the other toolbar controls. The visible text
  is the accessible name, so the old `aria-label` and hover `title` are gone. Cost: the wider
  button pushes one or two quick filters behind the toolbar's scroll arrow.
- **Option 3, prompt after the results:** `ResultsEndExternalLinksComponent`
  (`src/app/custom1-module/results-end-external-links/`) shows "Didn't find what you were looking
  for?" and the three sources, with the current query, after the last result on every page.
  Slot `nde-search-results-pagination-before`.
  - **Feasibility (the open question on the staff page):** probed live through the dev proxy
    against NDE_TEST on 2026-10-12. `nde-search-results-bottom`, `nde-search-results-after`,
    `nde-search-results-pagination-before`, `nde-search-results-pagination-after` and
    `nde-search-results-container-bottom` all mount. `-pagination-before` is the one directly
    under the last result.
  - The host does not render the pagination on a zero-results page, so the strip never doubles
    up with the no-results box (verified).
  - Links are rebuilt from the URL on pointer, focus or touch, so they are current before any
    click. A second in-app search was verified to produce fresh links.
- **Phones (checked live 2026-10-13 at 390px):** the host drops `nde-search-bar-filters` below
  tablet width, so the globe button is absent on phones (present at 800px). The end-of-results
  strip does show. The old sidebar panel (`nde-filters-group-before`) does appear on phones, at
  the top of the filter drawer opened by the floating filter icon (seen on live `NDE`). So "panel
  on phones only, labelled button on desktop" is a feasible variant if phone users need an entry
  point above the results.


`NDE` and `NDE_TEST` share the `nde` family, so merging this branch ships it to production.
Decide first whether the globe menu replaces the sidebar panel for good. If so, delete the
commented-out row and this "trial" status. If not, restore the row and drop the branch.

## Also on this trial branch: main-menu shadow (option E)

The same NDE_TEST package carries a second, unrelated trial: the main menu's shadow made visible
on results and full-record pages, by leaving a small white gap above the blue search band. Staff
chose it as option E of six (review page source: `docs/assets/menu-shadow-options/`). One CSS
block, `main-menu shadow + gap above the search band` in `src/assets/views/nde/css/custom.css`.
