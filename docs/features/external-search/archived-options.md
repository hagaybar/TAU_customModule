# External search: archived placement options

**Status (2026-10-26):** archived. None of these were accepted, and it is undecided whether any
will be. The sidebar panel (`FilterAssistPanelComponent`, slot `nde-filters-group-before`) is
what `NDE` and `NDE_TEST` ship.

Between 2026-10-05 and 2026-10-13 these alternatives to the sidebar panel were trialled on
`NDE_TEST` (PR #83, closed unmerged):

- **Globe menu** beside **All Filters** (slot `nde-search-bar-filters-before`), opening ULI,
  WorldCat and Google Scholar with the current query. ULiège's NDE view was the model.
- **Option 1:** a visible label and caret on that button ("Search in external sources" /
  "חיפוש במקורות חיצוניים").
- **Option 3:** "Didn't find what you were looking for?" with the three links, after the last
  result (slot `nde-search-results-pagination-before`).

Also on the same branch, and archived with it: the **main-menu shadow trial (option E)**, a
white gap above the blue search band. It is a CSS block only.

## Where it is

Everything is in the git tag **`archive/external-search-options-2026-10-26`** — the code,
tests, staff review pages and the full write-up (`docs/features/external-search/globe-menu.md`
inside the tag, including what was verified live and how it behaves on phones). The two
branches it came from, `feature/external-search-globe-menu` and
`feature/globe-label-plus-prompt`, were deleted after tagging; the tag holds every commit of
both.

The Hebrew staff pages stay published on `gh-pages` (`globe-button-options/`,
`menu-shadow-options/`).

## Restoring it

```bash
git fetch origin --tags
git checkout -b feature/external-search-<name> archive/external-search-options-2026-10-26
git rebase origin/main        # the tag is based on main as of 2026-10-13
```

Then read `globe-menu.md`. Two things to decide before any of it reaches `main`:

- `NDE` and `NDE_TEST` share the `nde` family, so merging ships it to production.
- The trial **comments out the sidebar panel** row in `src/app/views/nde/component-map.ts`.
  Restore that row unless the panel is meant to go. The shadow trial may need dropping too.
