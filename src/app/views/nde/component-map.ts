import { FilterAssistPanelComponent } from '../../custom1-module/filter-assist-panel/filter-assist-panel.component';
import { NoResultsExternalLinksComponent } from '../../custom1-module/no-results-external-links/no-results-external-links.component';
import { CenlibMapButtonComponent } from '../../custom1-module/cenlib-map/cenlib-map-button.component';
import { AnnouncementBannerComponent } from '../../custom1-module/announcement-banner/announcement-banner.component';
import { CollectionDiscoveryFilterComponent } from '../../custom1-module/collection-discovery-filter/collection-discovery-filter.component';
// import { IllPickupLibrarySorterComponent } from '../../custom1-module/ill-sorter/ill-pickup-library-sorter.component';

// The map of custom element selectors -> Angular components for the `nde` family
// (VIEW_ID=NDE and VIEW_ID=NDE_TEST). Using NDE official selectors with appropriate
// suffixes.
//
// Selected at build time by scripts/select-view.mjs, which re-exports this as
// `selectorComponentMap` from src/app/state/view.generated.ts. A family whose map is
// not selected is never imported, so its components never enter the bundle.
export const map = new Map<string, any>([
  // External search facet - displays in filter sidebar
  ['nde-filters-group-before', FilterAssistPanelComponent],

  // External-search panel renders as the LAST CHILD of <nde-search-no-results>.
  // Switched from full replacement ('nde-search-no-results') to the '-bottom'
  // extension slot per issue #4 — preserves ExLibris's default content
  // including the new <nde-expand-options> toggle.
  ['nde-search-no-results-bottom', NoResultsExternalLinksComponent],

  // CenLib Map button - displays at location level (next to Locate button area)
  ['nde-location-top', CenlibMapButtonComponent],

  // Announcement banner (issue #30) — full-width strip at the very top of the page.
  //
  // Slot verified live through the dev proxy on 2026-08-02. TAU's host exposes
  // all four header extension points; mounting the same component in each showed
  // they stack in this order above the visible <header class="top-bar">:
  //   nde-header-before  (y=0)   — outermost, sibling of <nde-header>   <- chosen
  //   nde-header-top     (y=44)  — inside <nde-header>
  //   nde-header-bottom  (y=89)  — inside <nde-header>
  //   nde-header-after   (y=133) — sibling of <nde-header>, still above the nav bar
  // 'nde-header-before' is the only one that sits above everything, which is the
  // EFSC-style placement this issue asks for.
  //
  // Note: NDE defines these as '<slot>-from-remote-<n>', not the bare slot name —
  // customElements.get('nde-header-before') is false at runtime by design.
  ['nde-header-before', AnnouncementBannerComponent],

  // Collection Discovery filter — hides configured collections by ID at every
  // level of /nde/collectionDiscovery, in every language. Renders nothing; it
  // uses the slot only to reach <nde-collection-discovery-gallery> and observe
  // it. Verified live through the dev proxy on 2026-09-07: NDE mounts it as
  // the gallery's first child, defined as
  // 'nde-collection-discovery-gallery-top-from-remote-<n>' inside an
  // 'ng-component' wrapper. Details in docs/features/collection-discovery-filter.md.
  ['nde-collection-discovery-gallery-top', CollectionDiscoveryFilterComponent],

  // Sort Pickup Library options in ILL form - DISABLED (not yet in production)
  // ['nde-ill-request-top', IllPickupLibrarySorterComponent],
]);
