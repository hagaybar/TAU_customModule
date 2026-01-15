import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { CenlibMapDialogComponent } from './cenlib-map-dialog/cenlib-map-dialog.component';

/**
 * CenLib Map Button Component
 * Displays a button in the get-it location row that opens a shelf map dialog
 *
 * Phase 0: Simple POC - button opens modal dialog with placeholder content
 * Phase 1: Extracts call number from parent location item and passes to dialog
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

  /** Current UI language */
  currentLanguage: 'en' | 'he' = 'en';

  /** Extracted call number from parent location item */
  private callNumber: string = '';

  constructor(private dialog: MatDialog) {
    this.detectLanguage();
  }

  ngAfterViewInit(): void {
    this.extractCallNumber();
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
   * Extract call number from parent nde-location-item element
   * Tries multiple selectors to handle both expanded and brief views
   */
  private extractCallNumber(): void {
    // Traverse up to find the nde-location-item parent
    const locationItem = this.elementRef.nativeElement.closest('nde-location-item');
    if (locationItem) {
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
