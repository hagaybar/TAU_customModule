import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { CenlibMapDialogComponent } from './cenlib-map-dialog/cenlib-map-dialog.component';
import { LOCATION_FILTER_CONFIG } from './config/location-filter.config';

/**
 * CenLib Map Button Component
 * Displays a button in the get-it location row that opens a shelf map dialog
 *
 * Phase 0: Simple POC - button opens modal dialog with placeholder content
 * Phase 1: Extracts call number from parent location item and passes to dialog
 * Phase 3: Location filtering - only show button for configured locations
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

  /** Current UI language */
  currentLanguage: 'en' | 'he' = 'en';

  /** Extracted call number from parent location item */
  private callNumber: string = '';

  /** Whether to show the button (based on location filter) */
  shouldShow: boolean = false;

  /** Extracted location name from parent location item */
  private locationName: string = '';

  constructor(private dialog: MatDialog) {
    this.detectLanguage();
  }

  ngAfterViewInit(): void {
    this.extractLocationData();
    this.checkLocationFilter();
    this.cdr.detectChanges();
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
   * Extract location data (call number and location name) from parent element
   */
  private extractLocationData(): void {
    // Traverse up to find the nde-location-item parent
    const locationItem = this.elementRef.nativeElement.closest('nde-location-item');
    if (locationItem) {
      // Extract call number
      this.extractCallNumber(locationItem);
      // Extract location name
      this.extractLocationName(locationItem);
    }
  }

  /**
   * Extract call number from location item element
   * Tries multiple selectors to handle both expanded and brief views
   */
  private extractCallNumber(locationItem: Element): void {
    // Try the data-qa selector first (expanded view)
    const callNumberEl = locationItem.querySelector('[data-qa="location-call-number"]');
    if (callNumberEl) {
      this.callNumber = callNumberEl.textContent?.trim() || '';
      return;
    }
    // Fallback: brief property view (3rd column)
    const briefCallNumber = locationItem.querySelector(
      '.getit-items-brief-property:nth-child(3) span[ndetooltipifoverflow]'
    );
    if (briefCallNumber) {
      this.callNumber = briefCallNumber.textContent?.trim() || '';
    }
  }

  /**
   * Extract location name from location item element
   * Searches parent structure to find the library name header
   *
   * DOM structure:
   * nde-location-item < mat-accordion < div < nde-location-items-container < div < div < nde-location < ...
   *
   * The library name is in a button element within nde-location (e.g., "Sourasky Central Library")
   */
  private extractLocationName(locationItem: Element): void {
    // Look for nde-location parent (contains the library header)
    const ndeLocation = locationItem.closest('nde-location');
    if (!ndeLocation) {
      return;
    }

    // Strategy 1: Try to find library name with data-qa selectors
    const possibleSelectors = [
      '[data-qa="location-title"]',
      '[data-qa="location-name"]',
      '[data-qa="location-items-location"]',
      '[data-qa="library-name"]',
    ];

    for (const selector of possibleSelectors) {
      const el = ndeLocation.querySelector(selector);
      if (el) {
        this.locationName = el.textContent?.trim() || '';
        return;
      }
    }

    // Strategy 2: Look for button containing "Library" or Hebrew library text
    const buttons = ndeLocation.querySelectorAll('button');
    for (const btn of Array.from(buttons)) {
      const text = btn.textContent?.trim() || '';
      if (text.includes('Library') || text.includes('ספרי')) {
        this.locationName = text;
        return;
      }
    }
  }

  /**
   * Check if current location passes the filter
   * Sets shouldShow based on location filter configuration
   */
  private checkLocationFilter(): void {
    const { enabled, allowedLocations, matchType } = LOCATION_FILTER_CONFIG;

    // If filtering is disabled, always show
    if (!enabled) {
      this.shouldShow = true;
      return;
    }

    // If no location found, don't show
    if (!this.locationName) {
      this.shouldShow = false;
      return;
    }

    // Check if location matches any allowed location
    if (matchType === 'exact') {
      this.shouldShow = allowedLocations.some(
        allowed => this.locationName === allowed
      );
    } else {
      // 'contains' match type
      this.shouldShow = allowedLocations.some(
        allowed => this.locationName.includes(allowed)
      );
    }
  }

  /** Open the shelf map dialog with call number data */
  openMapDialog(): void {
    this.dialog.open(CenlibMapDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      panelClass: 'cenlib-map-dialog-panel',
      data: { callNumber: this.callNumber },
    });
  }
}
