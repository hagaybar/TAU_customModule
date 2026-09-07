# Collection Discovery hidden-collections filter — design

**Status:** accepted 2026-09-07; implemented and deployed the same day — see docs/superpowers/plans/2026-09-07-collection-discovery-filter.md and docs/features/collection-discovery-filter.md.
**Request:** hide chosen digital collections from
`/nde/collectionDiscovery`, keyed on the collection ID that appears in each
card's `href`, at every nesting level, in every UI language, as a standalone
component of the custom module.

## 1. Context

Everything below was verified live on 2026-09-07 against the production
view (`972TAU_INST:NDE`), in both Hebrew and English.

**What the page is.** The lobby lists the top-level digital collections as
cards. Clicking a card opens that collection's own page, which lists its
sub-collections as cards of the same kind, plus the collection's items.
Sub-collections nest to arbitrary depth. The lobby currently shows 14 cards;
the whole tree holds about 269 collections.

**How a card is built.** Every card, at every level, is one
`<nde-collection-discovery-gallery-collection>` element. It wraps two anchors
(thumbnail and title) whose `href` is

```
/nde/collectionDiscovery?collectionId=<id>&lang=<he|en>&vid=972TAU_INST%3ANDE
```

The `collectionId` value is the same in both languages; only `lang` differs.
Lobby cards carry the class `collection-grid-card`, sub-collection cards add
`sub-collection`. All of them sit under one `<nde-collection-discovery-gallery>`
element, which is present on the lobby and on every collection page.

**Where the data comes from.** The lobby loads a private REST call
(`myaccount/collection?name=get_collections`); collection pages load a `pnxs`
search with `q=cdparentid,exact,<id>&isCDSearch=true`. Neither call can be
intercepted cleanly from the custom module, and the host store slice
`collectionDiscovery` is read-only for us, so the DOM is the right layer.

**Where we can mount.** The host applies its custom-slot directive (the one
that renders `<selector>-before/-after/-top/-bottom`) to
`nde-collection-discovery-gallery`, `nde-collection-discovery-grid` and
`nde-collection-discovery-lobby-header`; this is visible in the host's
bootstrap bundle. As with `nde-header-before`, the slot is confirmed to render
only through the dev proxy, which is the first implementation task.

## 2. Goals

- Hide the cards of a configured list of collection IDs on the collection
  discovery page, at any depth (lobby, collection page, sub-sub-collection…).
- Work identically in Hebrew and English, including an in-app language
  switch and in-app navigation between levels, with no reload.
- One list of IDs, kept in the repo next to the component.
- A standalone component in its own folder, laid out like the other
  add-ons, with unit tests.

## 3. Non-goals

- Blocking direct navigation to a hidden collection's URL. A hidden
  collection is hidden, not access-controlled.
- Removing a collection from search results or facets. That is an
  Alma-side change (unpublishing), not a display filter.
- Correcting the host's "Showing N of N results" line on collection pages
  (see §7 and decision D1).
- Automatically hiding descendants of a hidden collection. Descendants only
  appear on their parent's own page, which the UI no longer links to; listing
  a descendant ID hides it wherever it appears.

## 4. Design

### 4.1 Mount point

```ts
['nde-collection-discovery-gallery-top', CollectionDiscoveryFilterComponent]
```

The component renders nothing (`:host { display: none }`), so it has no
layout effect. Its host element is only an anchor: the component walks up with
`closest('nde-collection-discovery-gallery')` and treats that element as the
root it filters. If the proxy shows the `-top` slot does not render here, the
fallbacks are `nde-collection-discovery-grid-top`, then `-before` on either.

### 4.2 Matching

A card is any `nde-collection-discovery-gallery-collection` under the root.
Its ID is read from the first descendant `a[href*="collectionId="]`:

```ts
new URL(anchor.getAttribute('href')!, location.origin)
  .searchParams.get('collectionId')
```

Parsing the query string rather than pattern-matching the text makes the
match independent of parameter order, encoding and the `lang` value.

### 4.3 Hiding

A matching card gets `style.setProperty('display', 'none', 'important')` and a
marker attribute `data-tau-hidden-collection="<id>"`. Every pass re-evaluates
every card under the root: matches are hidden, cards that carry the marker but
no longer match are restored. That makes the pass idempotent and safe against
the host reusing a DOM node for a different collection.

### 4.4 Keeping up with the host

- Initial pass in `ngAfterViewInit`.
- A `MutationObserver` on the root (`childList`, `subtree`), coalesced through
  `requestAnimationFrame`, run outside the Angular zone. This covers the first
  render, navigation lobby → collection → sub-collection (the grid re-renders
  under the same gallery), the page's own collection search, any "load more",
  and the re-render after a language switch.
- Disconnect in `ngOnDestroy`.

### 4.5 Why depth does not matter

Every level uses the same card component under the same gallery, and the pass
queries the whole subtree, so a card three levels down is handled by the same
code as a lobby card. There is no per-level logic to write.

### 4.6 Configuration

`src/app/custom1-module/collection-discovery-filter/hidden-collections.config.ts`:

```ts
/** Collection IDs (the `collectionId` value in a card's href) to hide. */
export const HIDDEN_COLLECTION_IDS: readonly string[] = [
  // '81429943170004146', // example — The Reconstructed Trademark Registry
];
```

Changing the list means edit, build, upload a package, the same as every
change in this module. A runtime JSON asset was considered and rejected: it
still ships inside the package, so it saves nothing, and adds a request and a
failure mode.

### 4.7 Logging

One `dlog` line per pass with the number of cards hidden. No `console.log`
(project rule).

### 4.8 Files

New:

- `src/app/custom1-module/collection-discovery-filter/collection-discovery-filter.component.ts`
- `src/app/custom1-module/collection-discovery-filter/collection-discovery-filter.component.spec.ts`
- `src/app/custom1-module/collection-discovery-filter/collection-filter.ts` — the pure DOM logic,
  split out of the component during planning.
- `src/app/custom1-module/collection-discovery-filter/collection-filter.spec.ts`
- `src/app/custom1-module/collection-discovery-filter/hidden-collections.config.ts`
- `docs/features/collection-discovery-filter.md`

Edited:

- `src/app/custom1-module/customComponentMappings.ts` — one entry.
- `README.md` — add-on #4 in the summary and the add-ons section.
- `.upstream-sync/owned-files.json` — new medium-risk category for the folder.

## 5. Error handling

- No gallery ancestor found: `dwarn` once, do nothing.
- A card without a `collectionId` anchor, or with an unparseable href: skipped.
- Empty ID list: the component mounts and skips attaching the observer.

## 6. Testing

Unit (Karma/Jasmine, `npm test`), against a hand-built DOM, on a pure
`applyFilter(root, ids)` function:

- hides cards whose ID is listed and leaves the others visible;
- restores a marked card whose href no longer matches;
- ignores cards with no `collectionId` anchor;
- matches regardless of parameter order and of `lang`.

Component test: mounts, finds the root via `closest`, and hides a card that is
appended after mount.

Live through `npm run start:proxy`, with one real ID in the list:

1. lobby: the card is gone, the others unchanged;
2. a collection page with sub-collections (Archives, `81358236510004146`,
   six sub-collections): a listed sub-collection is gone;
3. switch language he ↔ en in-app: still hidden;
4. breadcrumbs back to the lobby: still hidden;
5. boot banner: "components to register" is one higher than before.

## 7. Risks

- **The slot might not render at `-top` for this component.** Bundle evidence
  says it should; the proxy is the proof. Fallbacks in §4.1.
  **Resolved 2026-09-07:** it renders; NDE mounts it as
  `nde-collection-discovery-gallery-top-from-remote-<n>` inside an
  `ng-component` wrapper, first child of the gallery.
- **Host markup can change on an NDE release.** The card selector and the
  gallery selector are two constants at the top of the component; upstream
  sync will flag the folder.
- **Stale count on collection pages.** The host prints "Showing 6 of 6
  results" from its own data; after hiding, fewer cards show than the line
  says. Patching that text is fragile. Recommendation: accept it (D1).
- **CSS-only alternative.** `nde-collection-discovery-gallery-collection:has(a[href*="collectionId=<id>"]) { display: none }`
  in `custom.css` would work today with no code, but scatters IDs into CSS
  and was ruled out by the request for a component. Kept as a fallback if
  no slot renders.

## 8. Rollout

Land on `main`, build for `NDE_TEST`, verify with the live list, then build
for `NDE` and upload. Fill in the manifest `note` on upload.

## 9. Decisions for review

- **D1** — Accept the stale "Showing N of N results" line on collection pages
  after hiding? Recommended: yes. — accepted.
- **D2** — The list of collection IDs to hide. The feature can be built with
  the example ID and swapped for the real list before the `NDE` build.
  — resolved: two IDs, see the feature doc.
