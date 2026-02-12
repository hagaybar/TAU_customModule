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
  currentLanguage: 'en' | 'he' = 'en';

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

  constructor(private dialog: MatDialog) {
    this.detectLanguage();
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
  }

  /** Button label based on language */
  get buttonLabel(): string {
    return this.currentLanguage === 'he' ? 'מפת מדף' : 'Shelf Map';
  }

  /** Detect current language from URL */
  private detectLanguage(): void {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang');
    if (lang === 'he' || lang === 'he_IL') {
      this.currentLanguage = 'he';
    } else {
      this.currentLanguage = 'en';
    }
  }

  /**
   * Try to extract location data and check for mapping
   * @returns true if data extraction was successful
   */
  private tryExtractAndCheck(): boolean {
    if (this.initialized) return true;

    const ndeLocation = this.elementRef.nativeElement.closest('nde-location');
    if (!ndeLocation) {
      console.log('[CenlibMapButton] Could not find nde-location parent');
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
      console.log('[CenlibMapButton] Missing data:', {
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
      console.log(`[CenlibMapButton] Library not configured: "${this.libraryName}"`);
      this.shouldShow = false;
      this.cdr.detectChanges();
      return;
    }

    // Step 2: Check if collection is configured for this library
    this.locationConfig = findLocationConfig(this.libraryConfig, this.collectionName);
    if (!this.locationConfig) {
      console.log(
        `[CenlibMapButton] Collection not configured: "${this.collectionName}" in library "${this.libraryName}"`
      );
      this.shouldShow = false;
      this.cdr.detectChanges();
      return;
    }

    // Step 3: Check if mapping exists in Google Sheets data
    this.shelfMappingService
      .hasMappingAsync(this.libraryName, this.collectionName, this.callNumber)
      .subscribe({
        next: (hasMapping) => {
          this.shouldShow = hasMapping;
          if (hasMapping) {
            console.log(
              `[CenlibMapButton] Found valid mapping for: ${this.libraryName} / ${this.collectionName} / ${this.callNumber}`
            );
          } else {
            console.log(
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

  /** Open the shelf map dialog with full location context */
  openMapDialog(): void {
    this.dialog.open(CenlibMapDialogComponent, {
      width: 'auto',
      maxWidth: '900px',
      maxHeight: '85vh',
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
