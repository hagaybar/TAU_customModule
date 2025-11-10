import { FilterAssistPanelComponent } from './filter-assist-panel/filter-assist-panel.component';

// Define the map of custom element selectors -> Angular components
// Using NDE official selector with -before suffix to insert before filter groups
export const selectorComponentMap = new Map<string, any>([
  ['nde-filters-group-before', FilterAssistPanelComponent],
]);
