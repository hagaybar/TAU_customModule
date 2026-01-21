import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ShelfMappingService } from '../services/shelf-mapping.service';
import { ShelfMapping } from '../config/shelf-mapping.config';
import { ShelfMapSvgComponent } from '../shelf-map-svg/shelf-map-svg.component';

/** Dialog data interface */
export interface CenlibMapDialogData {
  callNumber: string;
}

/**
 * CenLib Map Dialog Component
 * Displays a modal dialog with shelf location information
 *
 * Supports async loading of shelf mappings from Google Sheets
 */
@Component({
  selector: 'tau-cenlib-map-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    ShelfMapSvgComponent
  ],
  templateUrl: './cenlib-map-dialog.component.html',
  styleUrls: ['./cenlib-map-dialog.component.scss'],
})
export class CenlibMapDialogComponent implements OnInit {
  /** Current UI language */
  currentLanguage: 'en' | 'he' = 'en';

  /** Shelf mapping result */
  mapping: ShelfMapping | null = null;

  /** Loading state */
  isLoading = true;

  /** Error state */
  hasError = false;

  constructor(
    public dialogRef: MatDialogRef<CenlibMapDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CenlibMapDialogData,
    private shelfMappingService: ShelfMappingService
  ) {
    this.detectLanguage();
  }

  ngOnInit(): void {
    this.loadMappingData();
  }

  /** Load mapping data asynchronously */
  private loadMappingData(): void {
    if (!this.data?.callNumber) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.hasError = false;

    this.shelfMappingService.findMappingAsync(this.data.callNumber).subscribe({
      next: (mapping) => {
        this.mapping = mapping;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('[CenlibMapDialog] Error loading mapping:', error);
        this.hasError = true;
        this.isLoading = false;
        // Try synchronous fallback
        this.mapping = this.shelfMappingService.findMapping(this.data.callNumber);
      }
    });
  }

  /** Dialog title based on language */
  get dialogTitle(): string {
    return this.currentLanguage === 'he' ? 'מפת מיקום המדף' : 'Shelf Location Map';
  }

  /** Close button label based on language */
  get closeLabel(): string {
    return this.currentLanguage === 'he' ? 'סגור' : 'Close';
  }

  /** Call number label based on language */
  get callNumberLabel(): string {
    return this.currentLanguage === 'he' ? 'מספר קריאה:' : 'Call Number:';
  }

  /** SVG code label based on language */
  get svgCodeLabel(): string {
    return this.currentLanguage === 'he' ? 'קוד מיקום:' : 'SVG Code:';
  }

  /** Section label based on language */
  get sectionLabel(): string {
    return this.currentLanguage === 'he' ? 'מדור:' : 'Section:';
  }

  /** Floor label based on language */
  get floorLabel(): string {
    return this.currentLanguage === 'he' ? 'קומה:' : 'Floor:';
  }

  /** Not available message based on language */
  get notAvailableMessage(): string {
    return this.currentLanguage === 'he' ? 'לא זמין' : 'Not available';
  }

  /** No mapping found message based on language */
  get noMappingMessage(): string {
    return this.currentLanguage === 'he'
      ? 'לא נמצא מיקום מדף עבור מספר קריאה זה.'
      : 'Shelf location not found for this call number.';
  }

  /** Loading message based on language */
  get loadingMessage(): string {
    return this.currentLanguage === 'he' ? 'טוען...' : 'Loading...';
  }

  /** Get section description based on language */
  getSectionDescription(): string {
    if (!this.mapping) return '';
    return this.currentLanguage === 'he'
      ? (this.mapping.descriptionHe || this.mapping.description)
      : this.mapping.description;
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
}
