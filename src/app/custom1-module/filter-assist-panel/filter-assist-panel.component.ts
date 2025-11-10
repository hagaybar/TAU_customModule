import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchQueryService } from './services/search-query.service';
import { SearchTarget, SearchQuery } from './models/search-target.model';
import { EXTERNAL_SEARCH_SOURCES } from './config/external-sources.config';
import { AutoAssetSrcDirective } from '../../services/auto-asset-src.directive';

/**
 * Filter Assist Panel Component
 * Displays external search links in the NDE filter side navigation
 * Allows users to search the current query in external sources (ULI, WorldCat, Google Scholar)
 */
@Component({
  selector: 'tau-filter-assist-panel',
  standalone: true,
  imports: [CommonModule, AutoAssetSrcDirective],
  templateUrl: './filter-assist-panel.component.html',
  styleUrls: ['./filter-assist-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterAssistPanelComponent implements OnInit {
  /**
   * Static flag to track if this is the first instance
   * Since NDE may insert this component multiple times (before each filter group),
   * we only want to render the first instance
   */
  private static isFirstInstance = true;

  /**
   * Controls whether this specific instance should render
   * Only the first instance will have this set to true
   */
  public shouldRender = false;

  /** List of external search sources to display */
  externalSources: SearchTarget[] = EXTERNAL_SEARCH_SOURCES;

  /** Current UI language */
  currentLanguage: 'en' | 'he' = 'en';

  /** Parsed search data from URL */
  searchData: SearchQuery = {
    queries: [],
    filters: [],
    searchTerm: ''
  };

  /** Text direction based on language */
  get textDirection(): 'ltr' | 'rtl' {
    return this.currentLanguage === 'he' ? 'rtl' : 'ltr';
  }

  /** Panel title based on language */
  get panelTitle(): string {
    return this.currentLanguage === 'he'
      ? 'לחפש במנועי חיפוש נוספים'
      : 'Search also in';
  }

  constructor(private searchQueryService: SearchQueryService) {}

  ngOnInit(): void {
    // Only the first instance should render content
    if (FilterAssistPanelComponent.isFirstInstance) {
      FilterAssistPanelComponent.isFirstInstance = false;
      this.shouldRender = true;

      // Detect current language from URL
      this.currentLanguage = this.searchQueryService.getCurrentLanguage();

      // Extract search data from URL
      this.searchData = this.searchQueryService.getSearchData();

      console.log('FilterAssistPanel initialized (first instance):', {
        language: this.currentLanguage,
        searchData: this.searchData
      });
    } else {
      console.log('FilterAssistPanel skipped (duplicate instance)');
    }
  }

  /**
   * Build complete URL for external search source
   * Combines base URL with mapped query parameters
   * @param source External search target
   * @returns Complete URL with encoded search query
   */
  buildExternalUrl(source: SearchTarget): string {
    try {
      // Use the source's mapping function to format the query
      const mappedQuery = source.mapping(
        this.searchData.queries,
        this.searchData.filters
      );

      // Combine base URL with mapped query
      return `${source.url}${mappedQuery}`;
    } catch (e) {
      console.error(`Error building URL for ${source.name}:`, e);
      // Fallback: use simple search term
      return `${source.url}${encodeURIComponent(this.searchData.searchTerm)}`;
    }
  }

  /**
   * Get source name in current language
   * @param source External search target
   * @returns Localized source name
   */
  getSourceName(source: SearchTarget): string {
    return this.currentLanguage === 'he' ? source.nameHe : source.name;
  }

  /**
   * Check if we have a valid search query to display links
   * @returns True if search data is available
   */
  hasSearchQuery(): boolean {
    return this.searchData.queries.length > 0 || this.searchData.searchTerm.length > 0;
  }
}
