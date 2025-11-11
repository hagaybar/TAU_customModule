import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchQueryService } from '../filter-assist-panel/services/search-query.service';
import { SearchTarget, SearchQuery } from '../filter-assist-panel/models/search-target.model';
import { EXTERNAL_SEARCH_SOURCES } from '../filter-assist-panel/config/external-sources.config';
import { AutoAssetSrcDirective } from '../../services/auto-asset-src.directive';

/**
 * No Results External Links Component
 * REPLACES the entire NDE no-results component
 *
 * Recreates the original no-results UI (icon, message, suggestions)
 * and adds external search links below for alternative search options.
 *
 * This component completely replaces nde-search-no-results to provide
 * a seamless integration of external search sources.
 */
@Component({
  selector: 'tau-no-results-external-links',
  standalone: true,
  imports: [CommonModule, AutoAssetSrcDirective],
  templateUrl: './no-results-external-links.component.html',
  styleUrls: ['./no-results-external-links.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoResultsExternalLinksComponent implements OnInit {
  /** Host component instance - provides access to original NDE component data */
  @Input() private hostComponent?: any;

  /** List of external search sources from shared config */
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

  /** Heading: "No matching records found" */
  get noResultsHeading(): string {
    return this.currentLanguage === 'he'
      ? 'לא נמצאו רשומות תואמות'
      : 'No matching records found';
  }

  /** Subtext: "There are no results matching your search..." */
  get noResultsMessage(): string {
    const term = this.searchData.searchTerm || '';
    return this.currentLanguage === 'he'
      ? `אין תוצאות התואמות את החיפוש שלך "${term}".`
      : `There are no results matching your search "${term}".`;
  }

  /** Suggestions title */
  get suggestionsTitle(): string {
    return this.currentLanguage === 'he'
      ? 'הצעות:'
      : 'Suggestions:';
  }

  /** Suggestions list */
  get suggestionsList(): string[] {
    return this.currentLanguage === 'he'
      ? [
          'ודא שכל המילים מאויתות נכון.',
          'נסה היקף חיפוש אחר.',
          'נסה מילות מפתח שונות.',
          'נסה מילות מפתח כלליות יותר.',
          'נסה פחות מילות מפתח.'
        ]
      : [
          'Make sure that all words are spelled correctly.',
          'Try a different search scope.',
          'Try different keywords.',
          'Try more general keywords.',
          'Try fewer keywords.'
        ];
  }

  /** External links section title */
  get externalLinksTitle(): string {
    return this.currentLanguage === 'he'
      ? 'נסה לחפש במקורות חיצוניים:'
      : 'Try searching in external sources:';
  }

  constructor(private searchQueryService: SearchQueryService) {}

  ngOnInit(): void {
    // Detect current language from URL
    this.currentLanguage = this.searchQueryService.getCurrentLanguage();

    // Extract search data from URL
    this.searchData = this.searchQueryService.getSearchData();

    console.log('NoResultsExternalLinks initialized:', {
      language: this.currentLanguage,
      searchData: this.searchData
    });
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
