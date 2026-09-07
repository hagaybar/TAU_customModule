import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
} from '@angular/core';
import { dlog, dwarn } from '../../services/debug.util';
import { applyCollectionFilter } from './collection-filter';
import { HIDDEN_COLLECTION_IDS_TOKEN } from './hidden-collections.config';

/** The host element that wraps the card grid, on the lobby and on every collection page. */
export const GALLERY_SELECTOR = 'nde-collection-discovery-gallery';

/**
 * Collection Discovery filter.
 *
 * Hides the cards of the collections listed in `HIDDEN_COLLECTION_IDS` on
 * /nde/collectionDiscovery — the lobby and every sub-collection page — in
 * every UI language.
 *
 * Mounted at the `nde-collection-discovery-gallery-top` slot. It renders
 * nothing; its host element exists only so `closest(GALLERY_SELECTOR)` can
 * find the gallery this instance filters. The host re-renders the grid under
 * that same gallery when the user drills into a collection, searches within
 * the page, pages, or switches language, so a MutationObserver on the gallery
 * is what keeps the filter applied. Passes are coalesced through
 * requestAnimationFrame and run outside the Angular zone, so a burst of DOM
 * mutations costs one pass and triggers no change detection.
 *
 * Design: docs/superpowers/specs/2026-09-07-collection-discovery-filter-design.md
 */
@Component({
  selector: 'tau-collection-discovery-filter',
  standalone: true,
  template: '',
  styles: [':host { display: none; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionDiscoveryFilterComponent implements AfterViewInit, OnDestroy {
  private readonly hiddenIds: ReadonlySet<string> = new Set(inject(HIDDEN_COLLECTION_IDS_TOKEN));
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ngZone = inject(NgZone);

  private root: Element | null = null;
  private observer: MutationObserver | null = null;
  private pendingFrame: number | null = null;

  ngAfterViewInit(): void {
    this.root = this.elementRef.nativeElement.closest(GALLERY_SELECTOR);
    if (!this.root) {
      dwarn(`[CollectionDiscoveryFilter] no ${GALLERY_SELECTOR} ancestor; filter inactive`);
      return;
    }
    if (this.hiddenIds.size === 0) {
      dlog('[CollectionDiscoveryFilter] no collection IDs configured; filter inactive');
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.applyNow();
      // childList + subtree only: the pass itself changes attributes and
      // styles, and observing those would make every pass schedule another.
      this.observer = new MutationObserver(() => this.scheduleApply());
      this.observer.observe(this.root!, { childList: true, subtree: true });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.pendingFrame !== null) {
      cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
    }
    this.root = null;
  }

  /** Coalesces any number of mutations in one frame into a single pass. */
  private scheduleApply(): void {
    if (this.pendingFrame !== null) {
      return;
    }
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = null;
      this.applyNow();
    });
  }

  private applyNow(): void {
    if (!this.root) {
      return;
    }
    const hidden = applyCollectionFilter(this.root, this.hiddenIds);
    dlog(`[CollectionDiscoveryFilter] pass complete; ${hidden} card(s) hidden`);
  }
}
