import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchQueryService } from '../filter-assist-panel/services/search-query.service';
import { SearchTarget, SearchQuery } from '../filter-assist-panel/models/search-target.model';
import { EXTERNAL_SEARCH_SOURCES } from '../filter-assist-panel/config/external-sources.config';
import { AutoAssetSrcDirective } from '../../services/auto-asset-src.directive';

/**
 * No Results External Links Component
 * Mounted via the 'nde-search-no-results-bottom' extension slot, so it
 * appears as the last child of <nde-search-no-results>, alongside the
 * default ExLibris content (icon, heading, expand-options, suggestions).
 * Renders only the external-search-sources box; visual treatment matches
 * the sibling ExLibris .we-suggest-container box.
 */
@Component({
  selector: 'tau-no-results-external-links',
  standalone: true,
  imports: [CommonModule, AutoAssetSrcDirective],
  templateUrl: './no-results-external-links.component.html',
  styleUrls: ['./no-results-external-links.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoResultsExternalLinksComponent implements OnInit, AfterViewInit, OnDestroy {
  externalSources: SearchTarget[] = EXTERNAL_SEARCH_SOURCES;

  currentLanguage: 'en' | 'he' = 'en';

  searchData: SearchQuery = {
    queries: [],
    filters: [],
    searchTerm: ''
  };

  private resizeObserver?: ResizeObserver;

  get textDirection(): 'ltr' | 'rtl' {
    return this.currentLanguage === 'he' ? 'rtl' : 'ltr';
  }

  get externalLinksTitle(): string {
    return this.currentLanguage === 'he'
      ? 'נסו לחפש במקורות חיצוניים:'
      : 'Try searching in external sources:';
  }

  constructor(
    private searchQueryService: SearchQueryService,
    private elementRef: ElementRef<HTMLElement>,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.currentLanguage = this.searchQueryService.getCurrentLanguage();
    this.searchData = this.searchQueryService.getSearchData();
  }

  ngAfterViewInit(): void {
    this.matchExLibrisBoxWidth();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  /**
   * Mirrors the width of ExLibris's sibling .we-suggest-container box so
   * the two stacked boxes always align, regardless of language or viewport.
   * Falls back silently to the SCSS `width: fit-content` when the ExLibris
   * box is absent (e.g., when expand_results_toggles_visible is off).
   */
  private matchExLibrisBoxWidth(retriesLeft = 5): void {
    const exlBox = document.querySelector<HTMLElement>('.we-suggest-container');
    if (!exlBox) {
      if (retriesLeft > 0) {
        setTimeout(() => this.matchExLibrisBoxWidth(retriesLeft - 1), 100);
      } else {
        console.warn('[NoResultsExternalLinks] .we-suggest-container not found; using fit-content fallback');
      }
      return;
    }

    const target = this.elementRef.nativeElement.querySelector<HTMLElement>('.tau-external-search');
    if (!target) return;

    const apply = () => {
      const w = exlBox.offsetWidth;
      if (w > 0) target.style.width = `${w}px`;
    };
    apply();

    this.ngZone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(apply);
      this.resizeObserver.observe(exlBox);
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
