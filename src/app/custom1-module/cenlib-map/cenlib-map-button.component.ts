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
   * Tries multiple search strategies to find the location element:
   * 1. Within locationItem
   * 2. Within parent nde-locations-container
   * 3. Within parent nde-brief-result
   */
  private extractLocationName(locationItem: Element): void {
    let locationEl: Element | null = null;

    // DEBUG: Log all elements with data-qa attributes within locationItem
    const allDataQa = locationItem.querySelectorAll('[data-qa]');
    console.log('[CenLib Debug] All data-qa elements in locationItem:',
      Array.from(allDataQa).map(el => ({
        dataQa: el.getAttribute('data-qa'),
        text: el.textContent?.trim()
      }))
    );

    // Strategy 1: Try within locationItem
    locationEl = locationItem.querySelector('[data-qa="location-sub-location"]');
    if (locationEl) {
      console.log('[CenLib Debug] Found location via Strategy 1 (within locationItem)');
    }

    // Strategy 2: Try parent nde-locations-container
    if (!locationEl) {
      const locationsContainer = this.elementRef.nativeElement.closest('nde-locations-container');
      if (locationsContainer) {
        locationEl = locationsContainer.querySelector('[data-qa="location-sub-location"]');
        if (locationEl) {
          console.log('[CenLib Debug] Found location via Strategy 2 (nde-locations-container)');
        }
      }
    }

    // Strategy 3: Try searching up to nde-brief-result
    if (!locationEl) {
      const briefResult = this.elementRef.nativeElement.closest('nde-brief-result');
      if (briefResult) {
        locationEl = briefResult.querySelector('[data-qa="location-sub-location"]');
        if (locationEl) {
          console.log('[CenLib Debug] Found location via Strategy 3 (nde-brief-result)');
        }
      }
    }

    // DEBUG: Log search results summary
    console.log('[CenLib Debug] Location element search results:', {
      withinLocationItem: locationItem.querySelector('[data-qa="location-sub-location"]') !== null,
      finalResult: locationEl ? 'found' : 'not found'
    });

    if (locationEl) {
      this.locationName = locationEl.textContent?.trim() || '';
      console.log('[CenLib Debug] Extracted location text:', `"${this.locationName}"`);
      console.log('[CenLib Debug] Location element outerHTML:', locationEl.outerHTML);
    } else {
      console.log('[CenLib Debug] No location element found with any strategy');
      // Additional debug: Log the locationItem structure to help identify correct selector
      console.log('[CenLib Debug] locationItem tagName:', locationItem.tagName);
      console.log('[CenLib Debug] locationItem classList:', Array.from(locationItem.classList));
    }
  }

  /**
   * Check if current location passes the filter
   * Sets shouldShow based on location filter configuration
   */
  private checkLocationFilter(): void {
    const { enabled, allowedLocations, matchType } = LOCATION_FILTER_CONFIG;

    // DEBUG: Log filter configuration and comparison
    console.log('[CenLib Debug] Filter config:', { enabled, allowedLocations, matchType });
    console.log('[CenLib Debug] Current location to compare:', `"${this.locationName}"`);
    console.log('[CenLib Debug] Allowed locations:', allowedLocations.map(loc => `"${loc}"`));

    // If filtering is disabled, always show
    if (!enabled) {
      console.log('[CenLib Debug] Filter disabled, showing button');
      this.shouldShow = true;
      return;
    }

    // If no location found, don't show
    if (!this.locationName) {
      console.log('[CenLib Debug] No location found, hiding button');
      this.shouldShow = false;
      return;
    }

    // Check if location matches any allowed location
    if (matchType === 'exact') {
      this.shouldShow = allowedLocations.some(
        allowed => this.locationName === allowed
      );
      console.log('[CenLib Debug] Exact match result:', this.shouldShow);
      allowedLocations.forEach(allowed => {
        console.log(`[CenLib Debug] Comparing: "${this.locationName}" === "${allowed}" => ${this.locationName === allowed}`);
      });
    } else {
      // 'contains' match type
      this.shouldShow = allowedLocations.some(
        allowed => this.locationName.includes(allowed)
      );
      console.log('[CenLib Debug] Contains match result:', this.shouldShow);
    }

    console.log('[CenLib Debug] Final shouldShow:', this.shouldShow);
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
