import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
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
 * Displays a button in the get-it location row that opens a shelf map dialog
 *
 * MDM (Multi-Dimensional Mapping): Supports multiple libraries and locations.
 * Button visibility is determined by:
 * 1. Library name exists in LIBRARY_CONFIG
 * 2. Location name exists in that library's locations
 * 3. A mapping exists for the library+location+call number combination
 */
@Component({
  selector: 'tau-cenlib-map-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './cenlib-map-button.component.html',
  styleUrls: ['./cenlib-map-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenlibMapButtonComponent implements AfterViewInit {
  private elementRef = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  private shelfMappingService = inject(ShelfMappingService);

  /** Current UI language */
  currentLanguage: 'en' | 'he' = 'en';

  /** Extracted call number from parent location item (after cutter removal) */
  private callNumber: string = '';

  /** Raw call number from DOM (before cutter removal, for display) */
  private rawCallNumber: string = '';

  /** Whether to show the button (based on MDM lookup) */
  shouldShow: boolean = false;

  /** Library name in Hebrew (from DOM via .getit-library-title) */
  private libraryName: string = '';

  /** Location/sublocation name in Hebrew (from DOM via [data-qa="location-sub-location"]) */
  private locationName: string = '';

  /** Resolved library config (if found) */
  private libraryConfig: LibraryConfig | undefined = undefined;

  /** Resolved location config (if found) */
  private locationConfig: LocationConfig | undefined = undefined;

  constructor(private dialog: MatDialog) {
    this.detectLanguage();
  }

  ngAfterViewInit(): void {
    this.extractLocationData();
    this.checkShouldShow();
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
   * Extract location data (library name, location name, call number) from parent element
   *
   * DOM structure:
   * - Library name: .getit-library-title (within nde-location parent)
   * - Location name: [data-qa="location-sub-location"] (within nde-location parent)
   * - Call number: [data-qa="location-call-number"] (within nde-location-item)
   */
  private extractLocationData(): void {
    // Find the nde-location parent (contains library header)
    const ndeLocation = this.elementRef.nativeElement.closest('nde-location');
    if (ndeLocation) {
      this.extractLibraryName(ndeLocation);
      this.extractSubLocationName(ndeLocation);
    }

    // Find the nde-location-item parent (contains call number)
    const locationItem = this.elementRef.nativeElement.closest('nde-location-item');
    if (locationItem) {
      this.extractCallNumber(locationItem);
    }
  }

  /**
   * Extract library name from nde-location element
   * Uses .getit-library-title selector as discovered in DOM investigation
   */
  private extractLibraryName(ndeLocation: Element): void {
    const libraryTitleEl = ndeLocation.querySelector('.getit-library-title');
    if (libraryTitleEl) {
      this.libraryName = libraryTitleEl.textContent?.trim() || '';
      return;
    }

    // Fallback: Try button with library-like text
    const buttons = ndeLocation.querySelectorAll('button');
    for (const btn of Array.from(buttons)) {
      const text = btn.textContent?.trim() || '';
      // Look for Hebrew library indicators
      if (text.includes('ספרי') || text.includes('Library')) {
        this.libraryName = text;
        return;
      }
    }
  }

  /**
   * Extract sublocation name from nde-location element
   * Uses [data-qa="location-sub-location"] selector as discovered in DOM investigation
   */
  private extractSubLocationName(ndeLocation: Element): void {
    const subLocationEl = ndeLocation.querySelector(
      '[data-qa="location-sub-location"]'
    );
    if (subLocationEl) {
      // Remove trailing semicolon if present
      let text = subLocationEl.textContent?.trim() || '';
      if (text.endsWith(';')) {
        text = text.slice(0, -1).trim();
      }
      this.locationName = text;
    }
  }

  /**
   * Extract call number from location item element
   * Tries multiple selectors to handle both expanded and brief views
   * Also removes the cutter string for range matching
   */
  private extractCallNumber(locationItem: Element): void {
    let rawValue = '';

    // Try the data-qa selector first (expanded view)
    const callNumberEl = locationItem.querySelector(
      '[data-qa="location-call-number"]'
    );
    if (callNumberEl) {
      rawValue = callNumberEl.textContent?.trim() || '';
    } else {
      // Fallback: brief property view (3rd column)
      const briefCallNumber = locationItem.querySelector(
        '.getit-items-brief-property:nth-child(3) span[ndetooltipifoverflow]'
      );
      if (briefCallNumber) {
        rawValue = briefCallNumber.textContent?.trim() || '';
      }
    }

    // Store both raw and processed versions
    this.rawCallNumber = rawValue;
    this.callNumber = this.shelfMappingService.removeCutter(rawValue);
  }

  /**
   * Check if button should be shown based on MDM lookup
   * The button is shown only if:
   * 1. Library name is found in LIBRARY_CONFIG
   * 2. Location name is found in that library's locations
   * 3. A mapping exists for library+location+call number combination
   */
  private checkShouldShow(): void {
    // Step 1: Check if library is configured
    this.libraryConfig = findLibraryConfig(this.libraryName);
    if (!this.libraryConfig) {
      console.log(
        `[CenlibMapButton] Library not configured: "${this.libraryName}"`
      );
      this.shouldShow = false;
      this.cdr.detectChanges();
      return;
    }

    // Step 2: Check if location is configured for this library
    this.locationConfig = findLocationConfig(
      this.libraryConfig,
      this.locationName
    );
    if (!this.locationConfig) {
      console.log(
        `[CenlibMapButton] Location not configured: "${this.locationName}" in library "${this.libraryName}"`
      );
      this.shouldShow = false;
      this.cdr.detectChanges();
      return;
    }

    // Step 3: Check if mapping exists in Google Sheets data
    this.shelfMappingService
      .hasMappingAsync(this.libraryName, this.locationName, this.callNumber)
      .subscribe({
        next: (hasMapping) => {
          this.shouldShow = hasMapping;
          if (!hasMapping) {
            console.log(
              `[CenlibMapButton] No mapping for: ${this.libraryName} / ${this.locationName} / ${this.callNumber}`
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
      width: '500px',
      maxWidth: '90vw',
      panelClass: 'cenlib-map-dialog-panel',
      data: {
        callNumber: this.callNumber,
        rawCallNumber: this.rawCallNumber,
        libraryName: this.libraryName,
        locationName: this.locationName,
        libraryNameEn: this.libraryConfig?.name,
        locationNameEn: this.locationConfig?.name,
        svgPath: this.libraryConfig?.svgPath,
      },
    });
  }
}
