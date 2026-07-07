import { FilterAssistPanelComponent } from './filter-assist-panel/filter-assist-panel.component';
import { NoResultsExternalLinksComponent } from './no-results-external-links/no-results-external-links.component';
import { CenlibMapButtonComponent } from './cenlib-map/cenlib-map-button.component';
// import { IllPickupLibrarySorterComponent } from './ill-sorter/ill-pickup-library-sorter.component';
// THROWAWAY diagnostic probe (issue #19) — remove with its mapping entries below once evaluated.
import { StoreProbeLocationComponent, StoreProbeFiltersComponent } from './store-probe/store-probe.component';

// Define the map of custom element selectors -> Angular components
// Using NDE official selectors with appropriate suffixes
export const selectorComponentMap = new Map<string, any>([
  // External search facet - displays in filter sidebar
  ['nde-filters-group-before', FilterAssistPanelComponent],

  // External-search panel renders as the LAST CHILD of <nde-search-no-results>.
  // Switched from full replacement ('nde-search-no-results') to the '-bottom'
  // extension slot per issue #4 — preserves ExLibris's default content
  // including the new <nde-expand-options> toggle.
  ['nde-search-no-results-bottom', NoResultsExternalLinksComponent],

  // CenLib Map button - displays at location level (next to Locate button area)
  ['nde-location-top', CenlibMapButtonComponent],

  // Sort Pickup Library options in ILL form - DISABLED (not yet in production)
  // ['nde-ill-request-top', IllPickupLibrarySorterComponent],

  // ── THROWAWAY host-store probe (issue #19) — REMOVE after evaluation ──────────
  // Diagnostic only: injects the host NgRx Store to test whether Path B (direct
  // inject(Store)) is viable on our Angular-18 build. Renders nothing; inert
  // unless the tauDebug flag is on. Mapped to two slots to hedge slot-name risk
  // and cover both page types (record Get-It page + search results).
  ['nde-location-bottom', StoreProbeLocationComponent],
  ['nde-filters-group-after', StoreProbeFiltersComponent],
]);
