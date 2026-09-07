# Collection Discovery filter: hide collections by ID

**Status:** ✅ deployed to NDE_TEST and NDE on 2026-09-07. Currently hidden: The Reconstructed Trademark Registry of Mandate Palestine (`81429943170004146`) and The Reconstructed Patent Registry of Mandate Palestine (`81444210450004146`).
**Design:** [`docs/superpowers/specs/2026-09-07-collection-discovery-filter-design.md`](../superpowers/specs/2026-09-07-collection-discovery-filter-design.md)

## The request

Hide chosen digital collections from `/nde/collectionDiscovery`, keyed on the
collection ID in each card's link, at every nesting level (the lobby, a
collection's sub-collections, their sub-collections…), in both UI languages,
as a standalone component.

## What the host renders (verified 2026-09-07, he + en)

- Every card at every level is one `<nde-collection-discovery-gallery-collection>`
  wrapping two anchors (thumbnail and title) whose href is
  `/nde/collectionDiscovery?collectionId=<id>&lang=<he|en>&vid=…`.
  The ID is the same in both languages; only `lang` differs.
- All cards sit under one `<nde-collection-discovery-gallery>`, present on the
  lobby and on every collection page. Drilling into a collection re-renders
  the grid under the same gallery.
- The lobby loads `myaccount/collection?name=get_collections`; collection pages
  load a `pnxs` search with `q=cdparentid,exact,<id>&isCDSearch=true`.
  Neither is interceptable from the custom module, so the DOM is the layer.
- The host applies its custom-slot directive to the gallery, so
  `nde-collection-discovery-gallery-top` is a valid mount point.
  Confirmed live through the dev proxy on 2026-09-07 (mounted at `nde-collection-discovery-gallery-top`).

## How it works

`CollectionDiscoveryFilterComponent` mounts at `nde-collection-discovery-gallery-top`, renders nothing
(`:host { display: none }`), finds the gallery with `closest()`, runs one pass,
and keeps a `MutationObserver` (`childList` + `subtree`) on it. A pass walks
every card under the gallery, parses `collectionId` from the card's link with
`URL.searchParams`, hides matches with `display: none !important` plus the
marker `data-tau-hidden-collection="<id>"`, and restores marked cards that no
longer match. Passes are coalesced through `requestAnimationFrame` and run
outside the Angular zone. Depth never matters: every level is the same card
component under the same gallery, and the pass queries the whole subtree.

The pure logic is `collection-filter.ts` (`readCollectionId`,
`applyCollectionFilter`); the component only decides when to run it.

## Adding or removing an ID

1. Open the collection in Primo. The address bar reads
   `…/collectionDiscovery?collectionId=<id>&…`; copy the number.
2. Add it to `HIDDEN_COLLECTION_IDS` in
   `src/app/custom1-module/collection-discovery-filter/hidden-collections.config.ts`,
   with a comment naming the collection.
3. `npm run build`, then upload the package (see the README's deploy steps).
   Fill in the `note` column in `~/tau-packages/MANIFEST.tsv` on upload.

Hiding a parent hides its card; its descendants only appear on the parent's
own page, which the UI no longer links to. To hide a sub-collection while its
parent stays visible, list the sub-collection's own ID.

## Verification (dev proxy)

With two real IDs in the list — a lobby card and a sub-collection card —
through `npm run start:proxy`:

1. Lobby: console shows `Total components to register:` one more than before
   this feature (5 at the time of writing) and
   `[CollectionDiscoveryFilter] pass complete; 1 card(s) hidden`;
   `document.querySelector('nde-collection-discovery-gallery-top-from-remote-0').closest('nde-collection-discovery-gallery')`
   is non-null — NDE mounts the slot as `nde-collection-discovery-gallery-top-from-remote-0`
   inside an `<ng-component>` wrapper, so the component's own selector
   `tau-collection-discovery-filter` never appears in the DOM; the card is
   gone, the other 13 are unchanged.
2. Archives (`collectionId=81358236510004146`): six sub-collection cards in the
   DOM, one marked hidden and invisible.
3. Switch language in-app with the language selector (the HE/EN select) in
   the header: still hidden, a new `pass complete` line.
4. Breadcrumbs back to the lobby: still hidden.
5. Look at the lobby and a collection page with your eyes: the grid must look
   exactly as before apart from the missing cards. The host wraps the slot
   element in an `<ng-component>` we do not style; the DOM checks above cannot
   see a stray gap.

Unit tests: `npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/custom1-module/collection-discovery-filter/*.spec.ts'`.

## Known limitations

- **Stale count.** Collection pages print "Showing N of N results" from the
  host's own data; after hiding, fewer cards show than the line says.
  Accepted in the design (D1); patching host text is fragile.
- **Direct links still work.** A hidden collection is hidden, not
  access-controlled. Removing it from search and facets is an Alma-side change.
- **Host markup can change.** The three host selectors (`CARD_SELECTOR`,
  `CARD_LINK_SELECTOR` in `collection-filter.ts`; `GALLERY_SELECTOR` in the
  component) are constants; upstream sync flags the folder
  (`.upstream-sync/owned-files.json`, category `collection-discovery-filter`).

## Turning it off

Remove the map entry in `src/app/custom1-module/customComponentMappings.ts`,
or empty `HIDDEN_COLLECTION_IDS` — with an empty list the component mounts and
attaches no observer.
