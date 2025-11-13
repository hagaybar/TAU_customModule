import { FilterAssistPanelComponent } from './filter-assist-panel/filter-assist-panel.component';
import { NoResultsExternalLinksComponent } from './no-results-external-links/no-results-external-links.component';
import { ResearchAssistanceCustomTextComponent } from './research-assistance-custom-text/research-assistance-custom-text.component';

// Define the map of custom element selectors -> Angular components
// Using NDE official selectors with appropriate suffixes
export const selectorComponentMap = new Map<string, any>([
  // External search facet - displays in filter sidebar
  ['nde-filters-group-before', FilterAssistPanelComponent],

  // REPLACES the entire no-results component (not -after, complete replacement)
  ['nde-search-no-results', NoResultsExternalLinksComponent],

  // Research Assistant text customization - splits description into two styled parts
  ['nde-research-assistant-after', ResearchAssistanceCustomTextComponent],

]);
