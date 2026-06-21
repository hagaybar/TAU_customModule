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
  /** Library name (from DOM) */
  libraryName: string;
  /** Collection name (from DOM, English or Hebrew depending on UI language) */
  collectionName: string;
  /** Library name in English (from config) */
  libraryNameEn?: string;
  /** Collection name in English (from config) */
  collectionNameEn?: string;
  /** Path to library's SVG floor plan */
  svgPath?: string;
}

/**
 * CenLib Map Dialog Component
 * Displays a modal dialog with shelf location information
 *
 * Supports async loading of shelf mappings from AWS CDN
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
    if (!this.data?.callNumber || !this.data?.libraryName || !this.data?.collectionName) {
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
        collectionName: this.data.collectionName,
      })
      .subscribe({
        next: (mappings) => {
          // A single call-number range must never span floors. If matches land
          // on multiple floors, that's a mapping-data error — scope to the
          // displayed (primary) floor instead of silently passing off-floor
          // codes to a floor SVG that can't show them. See issue #12.
          this.mappings = this.scopeToPrimaryFloor(mappings);
          // Cache SVG codes to prevent new array creation on each change detection
          this.svgCodes = this.mappings.map((m) => m.svgCode);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('[CenlibMapDialog] Error loading mappings:', error);
          this.hasError = true;
          this.isLoading = false;
        },
      });
  }

  /**
   * Scope matched mappings to the primary (first) mapping's floor.
   *
   * A Dewey call-number range must never span floors, so all mappings matched
   * for a single call number are expected to share one floor. If they don't,
   * the mapping data is wrong: only one floor's SVG is displayed, and off-floor
   * codes would otherwise be pushed to the SVG where they can never be found
   * (silently failing to highlight — issue #12). Instead we drop the off-floor
   * matches, keep the result coherent with the displayed floor, and log a loud,
   * actionable error so library staff can fix the mapping CSV.
   *
   * Valid single-floor data passes through unchanged.
   *
   * @param mappings All mappings returned by the MDM lookup
   * @returns Mappings restricted to the primary floor
   */
  scopeToPrimaryFloor(mappings: ShelfMapping[]): ShelfMapping[] {
    if (mappings.length === 0) return mappings;

    const distinctFloors = new Set(
      mappings.map((m) => (m.floor || '').trim()).filter((f) => f !== '')
    );
    // 0 or 1 distinct floors → valid (or no floor data to scope by)
    if (distinctFloors.size <= 1) return mappings;

    const primaryFloor = (mappings[0].floor || '').trim();
    const onFloor = mappings.filter((m) => (m.floor || '').trim() === primaryFloor);
    const offFloor = mappings.filter((m) => (m.floor || '').trim() !== primaryFloor);

    console.error(
      '[CenlibMapDialog] Mapping data error: a single call number matched shelves ' +
        `on multiple floors [${Array.from(distinctFloors).join(', ')}] — a range ` +
        `must not span floors. Showing floor "${primaryFloor}"; ignoring off-floor ` +
        'matches (please fix the mapping data):',
      offFloor.map((m) => ({ svgCode: m.svgCode, floor: m.floor }))
    );

    return onFloor;
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

  /** Collection label based on language */
  get collectionLabel(): string {
    return this.currentLanguage === 'he' ? 'אוסף:' : 'Collection:';
  }

  /** Get library name for display based on language */
  getLibraryName(): string {
    return this.currentLanguage === 'he'
      ? this.data.libraryName
      : (this.data.libraryNameEn || this.data.libraryName);
  }

  /** Get collection name for display based on language */
  getCollectionName(): string {
    return this.currentLanguage === 'he'
      ? this.data.collectionName
      : (this.data.collectionNameEn || this.data.collectionName);
  }

  /** Get the primary mapping (first match) */
  get primaryMapping(): ShelfMapping | null {
    return this.mappings.length > 0 ? this.mappings[0] : null;
  }

  /**
   * Get the SVG path based on the floor from the mapping
   * Uses floor-specific SVG files from AWS CloudFront (e.g., floor_0.svg, floor_1.svg, floor_2.svg)
   */
  get svgPath(): string {
    if (!this.data.svgPath) return '';

    // Get floor from primary mapping, default to '2' for backward compatibility
    const floor = this.primaryMapping?.floor || '2';

    // Replace floor number in the SVG path
    const basePath = this.data.svgPath;

    // Check if path contains AWS CloudFront URL pattern (floor_X.svg with underscore)
    const awsFloorPattern = /floor_\d+\.svg$/i;
    if (awsFloorPattern.test(basePath)) {
      return basePath.replace(/floor_\d+\.svg$/i, `floor_${floor}.svg`);
    }

    // Legacy pattern support: local assets (floor-X.svg with hyphen)
    const legacyFloorPattern = /floor-\d+\.svg$/i;
    if (legacyFloorPattern.test(basePath)) {
      return basePath.replace(/floor-\d+\.svg$/i, `floor-${floor}.svg`);
    }

    // If no floor pattern found, return original path
    return basePath;
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

  /** Shelf label based on language */
  get shelfLabelLabel(): string {
    return this.currentLanguage === 'he' ? 'מדף:' : 'Shelf Label:';
  }

  /** Notes label based on language */
  get notesLabel(): string {
    return this.currentLanguage === 'he' ? 'הערה:' : 'Notes:';
  }

  /** Get shelf label based on language (from primary mapping) */
  getShelfLabel(): string {
    if (!this.primaryMapping) return '';
    return this.currentLanguage === 'he'
      ? (this.primaryMapping.shelfLabelHe || this.primaryMapping.shelfLabel || '')
      : (this.primaryMapping.shelfLabel || '');
  }

  /** Get notes based on language (from primary mapping) */
  getNotes(): string {
    if (!this.primaryMapping) return '';
    return this.currentLanguage === 'he'
      ? (this.primaryMapping.notesHe || this.primaryMapping.notes || '')
      : (this.primaryMapping.notes || '');
  }

  /** Check if there are multiple mappings */
  get hasMultipleMappings(): boolean {
    return this.mappings.length > 1;
  }

  /** Intro text for multiple shelf locations based on language */
  get multiShelfIntroText(): string {
    return this.currentLanguage === 'he'
      ? 'הפריט נמצא באחד מהמדפים הללו:'
      : 'The item should be in one of these shelves:';
  }

  /** Get comma-separated unique shelf labels for multiple mappings */
  getMultipleShelfLabels(): string {
    if (this.mappings.length === 0) return '';

    const labels = this.mappings
      .map(m => this.currentLanguage === 'he'
        ? (m.shelfLabelHe || m.shelfLabel || '')
        : (m.shelfLabel || ''))
      .map(label => label.trim())  // Trim whitespace
      .filter(label => label !== '');

    // De-duplicate using Set (after trimming)
    const uniqueLabels = Array.from(new Set(labels));
    return uniqueLabels.join(', ');
  }

  /** Get comma-separated unique floors for multiple mappings */
  getMultipleFloors(): string {
    if (this.mappings.length === 0) return '';

    const floors = this.mappings
      .map(m => m.floor || '')
      .map(floor => floor.trim())  // Trim whitespace
      .filter(floor => floor !== '');

    // De-duplicate using Set (after trimming)
    const uniqueFloors = Array.from(new Set(floors));
    return uniqueFloors.join(', ');
  }

  /** Get comma-separated unique section descriptions for multiple mappings */
  getMultipleSectionDescriptions(): string {
    if (this.mappings.length === 0) return '';

    const descriptions = this.mappings
      .map(m => this.currentLanguage === 'he'
        ? (m.descriptionHe || m.description)
        : m.description)
      .map(desc => desc.trim())  // Trim whitespace
      .filter(desc => desc !== '');

    // De-duplicate using Set (after trimming)
    const uniqueDescriptions = Array.from(new Set(descriptions));
    return uniqueDescriptions.join(', ');
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
