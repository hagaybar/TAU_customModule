import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ShelfMappingService } from '../services/shelf-mapping.service';
import { ShelfMapping } from '../config/shelf-mapping.config';
import { ShelfMapSvgComponent } from '../shelf-map-svg/shelf-map-svg.component';

/**
 * Dialog data interface (MDM format)
 * Contains full location context passed from button component
 */
export interface CenlibMapDialogData {
  /** Call number without cutter (used for range matching) */
  callNumber: string;
  /** Raw call number from DOM (for display) */
  rawCallNumber: string;
  /** Library name in Hebrew (from DOM) */
  libraryName: string;
  /** Location name in Hebrew (from DOM) */
  locationName: string;
  /** Library name in English (from config) */
  libraryNameEn?: string;
  /** Location name in English (from config) */
  locationNameEn?: string;
  /** Path to library's SVG floor plan */
  svgPath?: string;
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

  /** All matching shelf mappings (MDM supports overlapping ranges) */
  mappings: ShelfMapping[] = [];

  /** Cached SVG codes array (prevents new array creation on each change detection) */
  svgCodes: string[] = [];

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

  /** Load mapping data asynchronously using MDM lookup */
  private loadMappingData(): void {
    if (!this.data?.callNumber || !this.data?.libraryName || !this.data?.locationName) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.hasError = false;

    // Use MDM lookup with full location context
    this.shelfMappingService
      .findAllMappingsAsync({
        callNumber: this.data.callNumber,
        rawCallNumber: this.data.rawCallNumber,
        libraryName: this.data.libraryName,
        locationName: this.data.locationName,
      })
      .subscribe({
        next: (mappings) => {
          this.mappings = mappings;
          // Cache SVG codes to prevent new array creation on each change detection
          this.svgCodes = mappings.map((m) => m.svgCode);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('[CenlibMapDialog] Error loading mappings:', error);
          this.hasError = true;
          this.isLoading = false;
        },
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

  /** Library label based on language */
  get libraryLabel(): string {
    return this.currentLanguage === 'he' ? 'ספרייה:' : 'Library:';
  }

  /** Location label based on language */
  get locationLabel(): string {
    return this.currentLanguage === 'he' ? 'מיקום:' : 'Location:';
  }

  /** Get library name for display based on language */
  getLibraryName(): string {
    return this.currentLanguage === 'he'
      ? this.data.libraryName
      : (this.data.libraryNameEn || this.data.libraryName);
  }

  /** Get location name for display based on language */
  getLocationName(): string {
    return this.currentLanguage === 'he'
      ? this.data.locationName
      : (this.data.locationNameEn || this.data.locationName);
  }

  /** Get the primary mapping (first match) */
  get primaryMapping(): ShelfMapping | null {
    return this.mappings.length > 0 ? this.mappings[0] : null;
  }

  /** Get all SVG codes for highlighting (supports multiple shelves) */
  get allSvgCodes(): string[] {
    return this.svgCodes;  // Use cached array to prevent infinite change detection
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

  /** Get section description based on language (from primary mapping) */
  getSectionDescription(): string {
    if (!this.primaryMapping) return '';
    return this.currentLanguage === 'he'
      ? (this.primaryMapping.descriptionHe || this.primaryMapping.description)
      : this.primaryMapping.description;
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
