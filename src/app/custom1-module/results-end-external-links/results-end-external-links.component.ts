import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchQueryService } from '../filter-assist-panel/services/search-query.service';
import { SearchTarget, SearchQuery } from '../filter-assist-panel/models/search-target.model';
import { EXTERNAL_SEARCH_SOURCES } from '../filter-assist-panel/config/external-sources.config';
import { AutoAssetSrcDirective } from '../../services/auto-asset-src.directive';
import { readUiLanguage, UiLanguage, watchUiLanguage } from '../../services/ui-language';

/**
 * Results-End External Links Component
 * "Didn't find what you were looking for?" plus the external sources, carrying
 * the current query, after the last result on every results page (option 3 of
 * the staff page on the external-search button).
 *
 * Mounted via 'nde-search-results-pagination-before', which puts it between
 * the last result and the pagination. Slot verified live through the dev proxy
 * against NDE_TEST on 2026-10-12.
 *
 * The host navigates with pushState and the slot can outlive a search, so the
 * links are rebuilt from the URL whenever the pointer or focus reaches them,
 * which is always before a click.
 */
@Component({
  selector: 'tau-results-end-external-links',
  standalone: true,
  imports: [CommonModule, AutoAssetSrcDirective],
  templateUrl: './results-end-external-links.component.html',
  styleUrls: ['./results-end-external-links.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsEndExternalLinksComponent implements OnInit, OnDestroy {
  externalSources: SearchTarget[] = EXTERNAL_SEARCH_SOURCES;

  currentLanguage: UiLanguage = 'en';

  searchData: SearchQuery = { queries: [], filters: [], searchTerm: '' };

  private langObserver?: MutationObserver;

  get textDirection(): 'ltr' | 'rtl' {
    return this.currentLanguage === 'he' ? 'rtl' : 'ltr';
  }

  get title(): string {
    return this.currentLanguage === 'he'
      ? 'לא מצאתם את מה שחיפשתם?'
      : "Didn't find what you were looking for?";
  }

  get subtitle(): string {
    return this.currentLanguage === 'he'
      ? 'נסו את אותו החיפוש במקורות חיצוניים:'
      : 'Try the same search in external sources:';
  }

  constructor(
    private searchQueryService: SearchQueryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentLanguage = readUiLanguage();
    this.searchData = this.searchQueryService.getSearchData();
    this.langObserver = watchUiLanguage(
      () => this.currentLanguage,
      (language) => {
        this.currentLanguage = language;
        this.cdr.markForCheck();
      }
    );
  }

  ngOnDestroy(): void {
    this.langObserver?.disconnect();
  }

  hasSearchQuery(): boolean {
    return this.searchData.queries.length > 0 || this.searchData.searchTerm.length > 0;
  }

  refresh(): void {
    this.searchData = this.searchQueryService.getSearchData();
    this.cdr.markForCheck();
  }

  buildExternalUrl(source: SearchTarget): string {
    try {
      return `${source.url}${source.mapping(this.searchData.queries, this.searchData.filters)}`;
    } catch (e) {
      console.error(`Error building URL for ${source.name}:`, e);
      return `${source.url}${encodeURIComponent(this.searchData.searchTerm)}`;
    }
  }

  getSourceName(source: SearchTarget): string {
    return this.currentLanguage === 'he' ? source.nameHe : source.name;
  }

  getLinkLabel(source: SearchTarget): string {
    return this.currentLanguage === 'he'
      ? `חיפוש ב-${source.nameHe} (נפתח בחלון חדש)`
      : `Search in ${source.name} (opens in a new window)`;
  }
}
