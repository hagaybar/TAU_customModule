import { FilterAssistPanelComponent } from './filter-assist-panel/filter-assist-panel.component';
import { NoResultsExternalLinksComponent } from './no-results-external-links/no-results-external-links.component';
// BACKUP: Old test component (keep until new one is verified)
// import { ResearchAssistantTestComponent } from './research-assistant-test/research-assistant-test.component';
// NEW: Production-ready component with proper naming
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
  // BACKUP (if new component fails, uncomment line below and comment line above):
  // ['nde-research-assistant-after', ResearchAssistantTestComponent],

  // NOTE: Research Assistant customization service is permanently disabled (using component approach)
]);
