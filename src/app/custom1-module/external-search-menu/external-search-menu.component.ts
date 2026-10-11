import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchQueryService } from '../filter-assist-panel/services/search-query.service';
import { SearchTarget, SearchQuery } from '../filter-assist-panel/models/search-target.model';
import { EXTERNAL_SEARCH_SOURCES } from '../filter-assist-panel/config/external-sources.config';
import { AutoAssetSrcDirective } from '../../services/auto-asset-src.directive';
import { readUiLanguage, UiLanguage, watchUiLanguage } from '../../services/ui-language';

/**
 * External Search Menu Component
 * A globe button in the results toolbar, just before the "All Filters" button,
 * that opens a menu of external search sources (ULI, WorldCat, Google Scholar)
 * carrying the current query. Modelled on ULiège's NDE view.
 *
 * Mounted via 'nde-search-bar-filters-before'. It renders only when the URL
 * holds a search query, and it re-reads the URL every time the menu opens,
 * because the host navigates with pushState and the slot can outlive a search.
 *
 * The menu is position: fixed and placed from the button's rect, so the
 * toolbar's horizontal-scroll container cannot clip it.
 */
@Component({
  selector: 'tau-external-search-menu',
  standalone: true,
  imports: [CommonModule, AutoAssetSrcDirective],
  templateUrl: './external-search-menu.component.html',
  styleUrls: ['./external-search-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExternalSearchMenuComponent implements OnInit, OnDestroy {
  externalSources: SearchTarget[] = EXTERNAL_SEARCH_SOURCES;

  currentLanguage: UiLanguage = 'en';

  searchData: SearchQuery = { queries: [], filters: [], searchTerm: '' };

  isOpen = false;

  /** Fixed-position coordinates of the open menu */
  menuTop = 0;
  menuInlineStart = 0;

  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('menu') private menu?: ElementRef<HTMLElement>;

  private langObserver?: MutationObserver;

  get textDirection(): 'ltr' | 'rtl' {
    return this.currentLanguage === 'he' ? 'rtl' : 'ltr';
  }

  get buttonLabel(): string {
    return this.currentLanguage === 'he'
      ? 'חיפוש במקורות חיצוניים'
      : 'Search in external sources';
  }

  constructor(
    private searchQueryService: SearchQueryService,
    private elementRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentLanguage = readUiLanguage();
    this.searchData = this.searchQueryService.getSearchData();
    this.langObserver = watchUiLanguage(
      () => this.currentLanguage,
      (language) => {
        this.currentLanguage = language;
        this.close();
        this.cdr.markForCheck();
      }
    );
  }

  ngOnDestroy(): void {
    this.langObserver?.disconnect();
    document.removeEventListener('scroll', this.onAnyScroll, true);
  }

  hasSearchQuery(): boolean {
    return this.searchData.queries.length > 0 || this.searchData.searchTerm.length > 0;
  }

  toggle(): void {
    this.isOpen ? this.close(true) : this.open();
  }

  open(): void {
    // The slot can outlive a search, so never trust the query read at init.
    this.searchData = this.searchQueryService.getSearchData();
    if (!this.hasSearchQuery() || !this.trigger) {
      this.cdr.markForCheck();
      return;
    }
    this.placeMenu(this.trigger.nativeElement.getBoundingClientRect());
    this.isOpen = true;
    document.addEventListener('scroll', this.onAnyScroll, true);
    this.cdr.markForCheck();
    setTimeout(() => this.focusItem(0));
  }

  close(returnFocus = false): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    document.removeEventListener('scroll', this.onAnyScroll, true);
    this.cdr.markForCheck();
    if (returnFocus) this.trigger?.nativeElement.focus();
  }

  /**
   * Opens below the button, aligned to its inline-start edge: left in English,
   * right in Hebrew, so the menu always grows away from the page edge.
   */
  private placeMenu(rect: DOMRect): void {
    this.menuTop = rect.bottom + 4;
    this.menuInlineStart = this.textDirection === 'rtl'
      ? window.innerWidth - rect.right
      : rect.left;
  }

  onMenuKeydown(event: KeyboardEvent): void {
    const items = this.menuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusItem((index + 1) % items.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusItem((index - 1 + items.length) % items.length);
        break;
      case 'Home':
        event.preventDefault();
        this.focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusItem(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        this.close(true);
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  private menuItems(): HTMLElement[] {
    return Array.from(
      this.menu?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
  }

  private focusItem(index: number): void {
    this.menuItems()[index]?.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  // A fixed menu would detach from its button on resize, or on a scroll of
  // any container (the results list scrolls inside one, not the window).
  @HostListener('window:resize')
  onViewportChange(): void {
    this.close();
  }

  private readonly onAnyScroll = (): void => this.close();

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
