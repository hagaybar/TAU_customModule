import { FilterAssistPanelComponent } from './filter-assist-panel/filter-assist-panel.component';

// Define the map of custom element selectors -> Angular components
// Using NDE official selector with -top suffix to insert at top of filter panel
export const selectorComponentMap = new Map<string, any>([
  ['nde-search-filters-side-nav-top', FilterAssistPanelComponent],
]);
