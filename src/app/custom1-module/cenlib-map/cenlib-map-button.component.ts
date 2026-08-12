import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { CenlibMapDialogComponent } from './cenlib-map-dialog/cenlib-map-dialog.component';
import { ShelfMappingService } from './services/shelf-mapping.service';
import {
  findLibraryConfig,
  findLocationConfig,
  LibraryConfig,
  LocationConfig,
} from './config/library.config';
import { dlog } from '../../services/debug.util';
import { readUiLanguage, UiLanguage, watchUiLanguage } from '../../services/ui-language';

/**
 * Attribute set on the <nde-location> element to record which button instance
 * currently owns that location's shelf-map slot. Because NDE creates several
 * component instances for the same location, ownership has to live on a shared
 * DOM node rather than on the component, so all instances can see it.
 */
const SHELF_MAP_OWNER_ATTR = 'data-tau-shelf-map-owner';

/**
 * CenLib Map Button Component
 * Displays a button at the LOCATION level that opens a shelf map dialog
 *
 * MDM (Multi-Dimensional Mapping): Supports multiple libraries and locations.
 * Button visibility is determined by:
 * 1. Library name exists in LIBRARY_CONFIG
 * 2. Location name exists in that library's locations
 * 3. A mapping exists for the library+location+call number combination
 *
 * The call number is extracted from the location summary (first item's call number).
 */
@Component({
  selector: 'tau-cenlib-map-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './cenlib-map-button.component.html',
  styleUrls: ['./cenlib-map-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenlibMapButtonComponent implements AfterViewInit, OnDestroy {
  private elementRef = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  private shelfMappingService = inject(ShelfMappingService);

  /** Current UI language */
  currentLanguage: UiLanguage = 'en';

  /** Watches <html lang>/<dir> so the label follows in-app language switches */
  private langObserver: MutationObserver | null = null;

  /** Whether to show the button (based on MDM lookup) */
  shouldShow: boolean = false;

  /** Library name (from DOM via .getit-library-title) */
  private libraryName: string = '';

  /** Collection/sublocation name (from DOM via [data-qa="location-sub-location"]) */
  private collectionName: string = '';

  /** Call number (from summary, without cutter) */
  private callNumber: string = '';

  /** Raw call number (from summary, for display) */
  private rawCallNumber: string = '';

  /** Resolved library config (if found) */
  private libraryConfig: LibraryConfig | undefined = undefined;

  /** Resolved location config (if found) */
  private locationConfig: LocationConfig | undefined = undefined;

  /** MutationObserver for watching DOM changes */
  private observer: MutationObserver | null = null;

  /** Whether initialization is complete */
  private initialized = false;

  /** Reference to the hidden Locate button for cleanup */
  private hiddenLocateButton: HTMLElement | null = null;

  /** Original parent of our component (for cleanup) */
  private originalParent: HTMLElement | null = null;

  /** Original next sibling of our component (for cleanup) */
  private originalNextSibling: Node | null = null;

  /** Monotonic counter used to give every instance a unique id */
  private static instanceCounter = 0;

  /** Unique id for this instance, used to claim a location's shelf-map slot */
  private readonly instanceId = `cenlib-map-${++CenlibMapButtonComponent.instanceCounter}`;

  /** The <nde-location> this instance has claimed (null until/unless it owns one) */
  private ownedLocation: HTMLElement | null = null;

  constructor(private dialog: MatDialog) {
    this.currentLanguage = this.resolveLanguage();
    this.watchLanguage();
  }

  ngAfterViewInit(): void {
    // Try to extract data immediately
    const success = this.tryExtractAndCheck();

    if (!success) {
      // If data not ready, set up observer to wait for it
      this.setupObserver();
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.langObserver?.disconnect();
    this.langObserver = null;
    // Release our claim on this location and restore the Locate button only if
    // nothing replaces us (see releaseLocation).
    this.releaseLocation();
  }

  /** Button label based on language */
  get buttonLabel(): string {
    return this.currentLanguage === 'he' ? 'מפת מדף' : 'Shelf Map';
  }

  /**
   * Resolves the UI language. Exposed (not private) so it can be tested against
   * the <html lang> / URL / dir precedence chain directly.
   */
  resolveLanguage(): UiLanguage {
    return readUiLanguage();
  }

  /**
   * Keeps the label in step with an in-app language switch.
   *
   * This button does not get destroyed on a switch. It relocates itself into the
   * native Locate button's slot inside the Get It panel, and the host does not
   * tear that subtree down when the language changes — verified on NDE_TEST on
   * 2026-08-12 by stamping the button node, switching language, and finding the
   * same stamped node still in place. So reading the language once at
   * construction froze the label in whatever language the page first loaded in,
   * while the host's own controls beside it switched correctly.
   */
  private watchLanguage(): void {
    this.langObserver = watchUiLanguage(
      () => this.currentLanguage,
      language => {
        this.currentLanguage = language;
        // OnPush: assigning the field is not enough to repaint, and the mutation
        // originates outside this component's change-detection path.
        this.cdr.markForCheck();
      }
    );
  }

  /**
   * Try to extract location data and check for mapping
   * @returns true if data extraction was successful
   */
  private tryExtractAndCheck(): boolean {
    if (this.initialized) return true;

    const ndeLocation = this.elementRef.nativeElement.closest('nde-location');
    if (!ndeLocation) {
      dlog('[CenlibMapButton] Could not find nde-location parent');
      return false;
    }

    // Extract library name
    const libraryTitleEl = ndeLocation.querySelector('.getit-library-title');
    if (libraryTitleEl) {
      this.libraryName = libraryTitleEl.textContent?.trim() || '';
    }

    // Extract collection name from summary
    const subLocationEl = ndeLocation.querySelector('[data-qa="location-sub-location"]');
    if (subLocationEl) {
      let text = subLocationEl.textContent?.trim() || '';
      if (text.endsWith(';')) {
        text = text.slice(0, -1).trim();
      }
      this.collectionName = text;
    }

    // Extract call number from summary (this shows the first item's call number)
    const callNumberEl = ndeLocation.querySelector('[data-qa="location-call-number"]');
    if (callNumberEl) {
      this.rawCallNumber = callNumberEl.textContent?.trim() || '';
      this.callNumber = this.shelfMappingService.removeCutter(this.rawCallNumber);
    }

    // Check if we have all required data
    if (!this.libraryName || !this.collectionName || !this.callNumber) {
      dlog('[CenlibMapButton] Missing data:', {
        libraryName: this.libraryName,
        collectionName: this.collectionName,
        callNumber: this.callNumber,
      });
      return false;
    }

    this.initialized = true;
    this.checkShouldShow();
    return true;
  }

  /**
   * Set up MutationObserver to watch for DOM changes
   * This handles cases where the location data is rendered after our component
   */
  private setupObserver(): void {
    const ndeLocation = this.elementRef.nativeElement.closest('nde-location');
    if (!ndeLocation) return;

    this.observer = new MutationObserver(() => {
      if (this.tryExtractAndCheck()) {
        // Data found, disconnect observer
        this.observer?.disconnect();
        this.observer = null;
      }
    });

    this.observer.observe(ndeLocation, {
      childList: true,
      subtree: true,
    });

    // Also try after a short delay as fallback
    setTimeout(() => {
      if (!this.initialized) {
        this.tryExtractAndCheck();
      }
    }, 500);
  }

  /**
   * Check if button should be shown based on MDM lookup
   */
  private checkShouldShow(): void {
    // Step 1: Check if library is configured
    this.libraryConfig = findLibraryConfig(this.libraryName);
    if (!this.libraryConfig) {
      dlog(`[CenlibMapButton] Library not configured: "${this.libraryName}"`);
      this.shouldShow = false;
      this.cdr.detectChanges();
      return;
    }

    // Step 2: Check if collection is configured for this library
    this.locationConfig = findLocationConfig(this.libraryConfig, this.collectionName);
    if (!this.locationConfig) {
      dlog(
        `[CenlibMapButton] Collection not configured: "${this.collectionName}" in library "${this.libraryName}"`
      );
      this.shouldShow = false;
      this.cdr.detectChanges();
      return;
    }

    // Step 3: Check if mapping exists in the CDN mapping data
    this.shelfMappingService
      .hasMappingAsync(this.libraryName, this.collectionName, this.callNumber)
      .subscribe({
        next: (hasMapping) => {
          if (hasMapping) {
            dlog(
              `[CenlibMapButton] Found valid mapping for: ${this.libraryName} / ${this.collectionName} / ${this.callNumber}`
            );
            // Only one instance per location may show the button and hide the
            // Locate button. Extra instances NDE creates for the same location
            // defer here and render nothing. This is what stops the
            // create/destroy churn from leaving the Locate button hidden with
            // no Shelf Map button in its place.
            this.shouldShow = this.claimLocation();
            if (!this.shouldShow) {
              dlog(
                '[CenlibMapButton] Another instance already owns this location; deferring'
              );
            }
          } else {
            this.shouldShow = false;
            dlog(
              `[CenlibMapButton] No mapping for: ${this.libraryName} / ${this.collectionName} / ${this.callNumber}`
            );
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('[CenlibMapButton] Error checking mapping:', err);
          this.shouldShow = false;
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * Claim ownership of this component's <nde-location> shelf-map slot.
   *
   * @returns true if THIS instance should render its button (it became the
   * owner); false if a live sibling instance already owns the slot, in which
   * case this instance renders nothing.
   *
   * Ownership is recorded on the <nde-location> element (see
   * SHELF_MAP_OWNER_ATTR) so it is visible to every instance NDE creates for
   * the same location.
   */
  private claimLocation(): boolean {
    const ndeLocation = this.elementRef.nativeElement.closest(
      'nde-location'
    ) as HTMLElement | null;
    if (!ndeLocation) {
      // No location context (shouldn't happen) - degrade by showing in place.
      return true;
    }

    const currentOwner = ndeLocation.getAttribute(SHELF_MAP_OWNER_ATTR);
    if (currentOwner && currentOwner !== this.instanceId) {
      // Another instance claims it - defer only if its button is actually live.
      const liveButton = ndeLocation.querySelector('button.cenlib-map-button');
      if (liveButton && liveButton.isConnected) {
        return false;
      }
      // Stale owner (its button is gone) - fall through and take over.
    }

    ndeLocation.setAttribute(SHELF_MAP_OWNER_ATTR, this.instanceId);
    this.ownedLocation = ndeLocation;
    this.hideLocateButton(ndeLocation);
    return true;
  }

  /**
   * Move our component next to the native Locate button and hide that button.
   * Idempotent: safe to call when already positioned and/or already hidden.
   */
  private hideLocateButton(ndeLocation: HTMLElement): void {
    const locateButton = ndeLocation.querySelector(
      'button.getit-locate-button'
    ) as HTMLElement | null;
    if (!locateButton) return;

    const hostElement = this.elementRef.nativeElement as HTMLElement;
    const locateButtonParent = locateButton.parentElement;

    // Move our component into the Locate button's container (only once).
    if (locateButtonParent && hostElement.parentElement !== locateButtonParent) {
      if (!this.originalParent) {
        this.originalParent = hostElement.parentElement;
        this.originalNextSibling = hostElement.nextSibling;
      }
      locateButtonParent.insertBefore(hostElement, locateButton);
      dlog('[CenlibMapButton] Moved to Locate button position');
    }

    if (locateButton.style.display !== 'none') {
      this.hiddenLocateButton = locateButton;
      locateButton.style.display = 'none';
      dlog('[CenlibMapButton] Hidden original Locate button');
    }
  }

  /**
   * Release this instance's claim on its location (called from ngOnDestroy).
   *
   * The Locate button is restored ONLY when no other Shelf Map button remains
   * in the location and the Locate button itself is still on the page. This
   * guarantees a location can never be left with the Locate button hidden and
   * no Shelf Map button visible - which was the failure mode of the previous
   * unconditional restore-on-destroy.
   */
  private releaseLocation(): void {
    const ndeLocation = this.ownedLocation;

    // Restore our host to its original slot if we moved it and it's still live.
    const hostElement = this.elementRef.nativeElement as HTMLElement;
    if (this.originalParent && this.originalParent.isConnected) {
      if (
        this.originalNextSibling &&
        this.originalNextSibling.parentNode === this.originalParent
      ) {
        this.originalParent.insertBefore(hostElement, this.originalNextSibling);
      } else {
        this.originalParent.appendChild(hostElement);
      }
    }
    this.originalParent = null;
    this.originalNextSibling = null;

    if (ndeLocation) {
      if (ndeLocation.getAttribute(SHELF_MAP_OWNER_ATTR) === this.instanceId) {
        ndeLocation.removeAttribute(SHELF_MAP_OWNER_ATTR);
      }

      // Any other (sibling) shelf-map button still live in this location,
      // ignoring our own about-to-be-removed button?
      const otherButton = Array.from(
        ndeLocation.querySelectorAll('button.cenlib-map-button')
      ).find((b) => !hostElement.contains(b) && (b as HTMLElement).isConnected);

      const locate = this.hiddenLocateButton;
      if (locate && locate.isConnected && !otherButton) {
        locate.style.display = '';
        dlog(
          '[CenlibMapButton] Restored original Locate button (no shelf-map button remains)'
        );
      }
    }

    this.hiddenLocateButton = null;
    this.ownedLocation = null;
  }

  /** Open the shelf map dialog with full location context */
  openMapDialog(): void {
    this.dialog.open(CenlibMapDialogComponent, {
      width: 'auto',
      maxWidth: '1200px',
      maxHeight: '95vh',
      panelClass: 'cenlib-map-dialog-panel',
      data: {
        callNumber: this.callNumber,
        rawCallNumber: this.rawCallNumber,
        libraryName: this.libraryName,
        collectionName: this.collectionName,
        libraryNameEn: this.libraryConfig?.name,
        collectionNameEn: this.locationConfig?.name,
        svgPath: this.libraryConfig?.svgPath,
      },
    });
  }
}
