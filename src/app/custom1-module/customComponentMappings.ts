import { FilterAssistPanelComponent } from './filter-assist-panel/filter-assist-panel.component';
import { NoResultsExternalLinksComponent } from './no-results-external-links/no-results-external-links.component';
import { ThemeToggleComponent } from './theme-toggle/theme-toggle.component';
// import { IllPickupLibrarySorterComponent } from './ill-sorter/ill-pickup-library-sorter.component';

// Define the map of custom element selectors -> Angular components
// Using NDE official selectors with appropriate suffixes
export const selectorComponentMap = new Map<string, any>([
  // External search facet - displays in filter sidebar
  ['nde-filters-group-before', FilterAssistPanelComponent],

  // REPLACES the entire no-results component (not -after, complete replacement)
  ['nde-search-no-results', NoResultsExternalLinksComponent],

  // Theme toggle - floating action button for dark/light mode
  ['custom-theme-toggle', ThemeToggleComponent],

  // Sort Pickup Library options in ILL form - DISABLED (not yet in production)
  // ['nde-ill-request-top', IllPickupLibrarySorterComponent],
]);
