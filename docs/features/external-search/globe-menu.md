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

## Before this goes to NDE

`NDE` and `NDE_TEST` share the `nde` family, so merging this branch ships it to production.
Decide first whether the globe menu replaces the sidebar panel for good. If so, delete the
commented-out row and this "trial" status. If not, restore the row and drop the branch.

## Also on this trial branch: main-menu shadow + search pill

The same NDE_TEST package carries a second, unrelated trial: a visible shadow under the main
menu on results and full-record pages, with the search bar in a blue pill (ULiège style). One CSS block,
`main-menu shadow + search pill` in `src/assets/views/nde/css/custom.css`.
