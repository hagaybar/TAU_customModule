import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import * as Papa from 'papaparse';
import {
  LEGACY_SHELF_MAPPINGS,
  LegacyShelfMapping,
  ShelfMapping,
} from '../config/shelf-mapping.config';
import { GOOGLE_SHEETS_CONFIG } from '../config/google-sheets.config';
import { LocationContext } from '../models/location-context.model';

/** Raw row from CSV parsing (MDM format with library/location names) */
interface CsvRow {
  libraryName: string;
  locationName: string;
  rangeStart: string;
  rangeEnd: string;
  svgCode: string;
  description: string;
  descriptionHe: string;
  floor: string;
  shelfLabel: string;
  notes: string;
}

/**
 * Shelf Mapping Service
 * Provides methods to map call numbers to shelf locations
 *
 * Supports fetching mappings from Google Sheets with caching and fallback
 */
@Injectable({ providedIn: 'root' })
export class ShelfMappingService {
  private http = inject(HttpClient);

  /** Cached mappings (flat array) */
  private cachedMappings: ShelfMapping[] | null = null;

  /**
   * Nested mapping index for O(1) lookup by library+location
   * Structure: libraryName (normalized) -> locationName (normalized) -> ShelfMapping[]
   */
  private mappingIndex: Map<string, Map<string, ShelfMapping[]>> | null = null;

  /** Timestamp of last cache update */
  private cacheTimestamp: number = 0;

  /** Loading state observable */
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  /** Whether mappings have been loaded at least once */
  private initialized = false;

  /**
   * Load mappings from Google Sheets or cache
   * Returns cached data if still valid, otherwise fetches fresh data
   * Builds the mapping index after loading for efficient MDM lookup
   *
   * @returns Observable of shelf mappings array
   */
  loadMappings(): Observable<ShelfMapping[]> {
    // Check if cache is still valid
    const now = Date.now();
    const cacheAge = now - this.cacheTimestamp;

    if (this.cachedMappings && cacheAge < GOOGLE_SHEETS_CONFIG.cacheDurationMs) {
      console.log('[ShelfMappingService] Using cached mappings');
      return of(this.cachedMappings);
    }

    // Check if URL is configured
    if (
      !GOOGLE_SHEETS_CONFIG.shelfMappingsUrl ||
      GOOGLE_SHEETS_CONFIG.shelfMappingsUrl === 'YOUR_PUBLISHED_CSV_URL_HERE'
    ) {
      console.log(
        '[ShelfMappingService] Google Sheets URL not configured, no mappings available'
      );
      // For MDM, we cannot use legacy mappings as they don't have libraryName/locationName
      // Return empty array - button will be hidden for all items
      this.cachedMappings = [];
      this.buildMappingIndex();
      this.cacheTimestamp = now;
      this.initialized = true;
      return of([]);
    }

    // Fetch from Google Sheets
    this.loadingSubject.next(true);
    console.log('[ShelfMappingService] Fetching mappings from Google Sheets');

    return this.http
      .get(GOOGLE_SHEETS_CONFIG.shelfMappingsUrl, { responseType: 'text' })
      .pipe(
        map((csv) => this.parseCsv(csv)),
        tap((mappings) => {
          this.cachedMappings = mappings;
          this.buildMappingIndex();
          this.cacheTimestamp = Date.now();
          this.initialized = true;
          this.loadingSubject.next(false);
          console.log(
            `[ShelfMappingService] Loaded ${mappings.length} mappings from Google Sheets`
          );
        }),
        catchError((error) => {
          console.error(
            '[ShelfMappingService] Failed to fetch from Google Sheets:',
            error
          );
          // Return empty array on error - button will be hidden
          this.cachedMappings = [];
          this.buildMappingIndex();
          this.cacheTimestamp = Date.now();
          this.initialized = true;
          this.loadingSubject.next(false);
          return of([]);
        })
      );
  }

  /**
   * Parse CSV string into ShelfMapping array (MDM format)
   * Expects columns: libraryName, locationName, rangeStart, rangeEnd, svgCode, etc.
   *
   * @param csv Raw CSV string
   * @returns Array of ShelfMapping objects
   */
  private parseCsv(csv: string): ShelfMapping[] {
    const result = Papa.parse<CsvRow>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    if (result.errors.length > 0) {
      console.warn('[ShelfMappingService] CSV parsing warnings:', result.errors);
    }

    return result.data
      .filter(
        (row) =>
          row.libraryName &&
          row.locationName &&
          row.rangeStart &&
          row.rangeEnd &&
          row.svgCode
      )
      .map((row) => ({
        libraryName: row.libraryName.trim(),
        locationName: row.locationName.trim(),
        rangeStart: row.rangeStart.trim(),
        rangeEnd: row.rangeEnd.trim(),
        svgCode: row.svgCode.trim(),
        description: row.description?.trim() || '',
        descriptionHe: row.descriptionHe?.trim() || undefined,
        floor: row.floor?.trim() || undefined,
        shelfLabel: row.shelfLabel?.trim() || undefined,
        notes: row.notes?.trim() || undefined,
      }));
  }

  /**
   * Extract the first numeric portion from a call number
   * Handles various call number formats including Dewey and LC
   *
   * @param callNumber The full call number string
   * @returns The first numeric value found, or null if none
   *
   * @example
   * extractNumericValue("892.413 מאו") → 892
   * extractNumericValue("QA76.73") → 76
   * extractNumericValue("100-200") → 100
   * extractNumericValue("ABC") → null
   */
  extractNumericValue(callNumber: string): number | null {
    if (!callNumber) return null;

    // Match the first sequence of digits in the string
    const match = callNumber.match(/(\d+)/);
    if (!match) return null;

    const num = parseInt(match[1], 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Find the shelf mapping for a given call number (synchronous)
   * @deprecated Use findAllMappings() with LocationContext for MDM support
   *
   * This method searches ALL mappings regardless of library/location.
   * For production use, prefer findAllMappings() which filters by library+location.
   *
   * @param callNumber The full call number string
   * @returns The first matching ShelfMapping, or null if no match found
   */
  findMapping(callNumber: string): ShelfMapping | null {
    const numValue = this.extractNumericValue(callNumber);
    if (numValue === null) return null;

    const mappings = this.cachedMappings || [];

    // Find the first mapping where numValue falls within the range
    const mapping = mappings.find((m) => {
      const startValue = this.extractNumericValue(m.rangeStart);
      const endValue = this.extractNumericValue(m.rangeEnd);
      if (startValue === null || endValue === null) return false;
      return numValue >= startValue && numValue <= endValue;
    });

    return mapping || null;
  }

  /**
   * Find the shelf mapping for a given call number (async version)
   * @deprecated Use findAllMappingsAsync() with LocationContext for MDM support
   *
   * @param callNumber The full call number string
   * @returns Observable of the matching ShelfMapping, or null if no match found
   */
  findMappingAsync(callNumber: string): Observable<ShelfMapping | null> {
    return this.loadMappings().pipe(map(() => this.findMapping(callNumber)));
  }

  /**
   * Get all available shelf mappings
   * Useful for debugging or displaying all possible locations
   *
   * @returns Array of all configured shelf mappings
   */
  getAllMappings(): ShelfMapping[] {
    return [...(this.cachedMappings || [])];
  }

  /**
   * Check if mappings have been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Force refresh mappings from Google Sheets
   * Clears cache and fetches fresh data
   */
  refreshMappings(): Observable<ShelfMapping[]> {
    this.cachedMappings = null;
    this.mappingIndex = null;
    this.cacheTimestamp = 0;
    return this.loadMappings();
  }

  // ============ MDM (Multi-Dimensional Mapping) Methods ============

  /**
   * Normalize a string for map key comparison
   * - Trims whitespace
   * - Converts to lowercase
   * - Collapses multiple whitespace to single space
   *
   * @param str String to normalize
   * @returns Normalized string
   */
  normalize(str: string): string {
    if (!str) return '';
    return str.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Remove cutter string from call number
   * Pattern: Everything after the last space that starts with letters (Hebrew or English)
   *
   * @param callNumber Raw call number from DOM
   * @returns Call number without cutter
   *
   * @example
   * removeCutter("892.413 מאו") → "892.413"
   * removeCutter("301.5 ABC") → "301.5"
   * removeCutter("QA76.73") → "QA76.73" (no cutter)
   * removeCutter("100") → "100" (no cutter)
   */
  removeCutter(callNumber: string): string {
    if (!callNumber) return '';
    return callNumber.replace(/\s+[A-Za-zא-ת].*$/, '').trim();
  }

  /**
   * Build the nested mapping index from flat array
   * Called after loading mappings from CSV
   */
  private buildMappingIndex(): void {
    if (!this.cachedMappings) {
      this.mappingIndex = null;
      return;
    }

    this.mappingIndex = new Map();

    for (const mapping of this.cachedMappings) {
      const libKey = this.normalize(mapping.libraryName);
      const locKey = this.normalize(mapping.locationName);

      if (!this.mappingIndex.has(libKey)) {
        this.mappingIndex.set(libKey, new Map());
      }

      const libMap = this.mappingIndex.get(libKey)!;
      if (!libMap.has(locKey)) {
        libMap.set(locKey, []);
      }

      libMap.get(locKey)!.push(mapping);
    }

    console.log(
      `[ShelfMappingService] Built mapping index with ${this.mappingIndex.size} libraries`
    );
  }

  /**
   * Check if a call number falls within a range
   * Extracts the first numeric portion and compares
   *
   * @param callNumber Call number to check (without cutter)
   * @param rangeStart Start of range (string)
   * @param rangeEnd End of range (string)
   * @returns True if call number is within range
   */
  private matchesRange(
    callNumber: string,
    rangeStart: string,
    rangeEnd: string
  ): boolean {
    const numValue = this.extractNumericValue(callNumber);
    const startValue = this.extractNumericValue(rangeStart);
    const endValue = this.extractNumericValue(rangeEnd);

    if (numValue === null || startValue === null || endValue === null) {
      return false;
    }

    return numValue >= startValue && numValue <= endValue;
  }

  /**
   * Find ALL mappings for a given context (supports overlapping ranges)
   * This is the main MDM lookup method
   *
   * @param context Location context with library/location names and call number
   * @returns Array of all matching ShelfMapping objects
   */
  findAllMappings(context: LocationContext): ShelfMapping[] {
    if (!this.mappingIndex) {
      console.warn('[ShelfMappingService] Mapping index not built yet');
      return [];
    }

    const libKey = this.normalize(context.libraryName);
    const locKey = this.normalize(context.locationName);

    const libMap = this.mappingIndex.get(libKey);
    if (!libMap) {
      console.log(`[ShelfMappingService] No mappings for library: ${context.libraryName}`);
      return [];
    }

    const mappings = libMap.get(locKey);
    if (!mappings) {
      console.log(
        `[ShelfMappingService] No mappings for location: ${context.locationName} in library: ${context.libraryName}`
      );
      return [];
    }

    // Return ALL mappings where call number is within range
    return mappings.filter((m) =>
      this.matchesRange(context.callNumber, m.rangeStart, m.rangeEnd)
    );
  }

  /**
   * Check if any mapping exists for a given context
   * Ensures mappings are loaded before checking
   *
   * @param libraryName Library name (Hebrew, from DOM)
   * @param locationName Location name (Hebrew, from DOM)
   * @param callNumber Call number (without cutter)
   * @returns Observable<boolean> - true if at least one mapping exists
   */
  hasMappingAsync(
    libraryName: string,
    locationName: string,
    callNumber: string
  ): Observable<boolean> {
    return this.loadMappings().pipe(
      map(() =>
        this.findAllMappings({
          callNumber,
          rawCallNumber: callNumber,
          libraryName,
          locationName,
        }).length > 0
      )
    );
  }

  /**
   * Find all mappings async - ensures mappings are loaded first
   *
   * @param context Location context
   * @returns Observable of matching ShelfMapping array
   */
  findAllMappingsAsync(context: LocationContext): Observable<ShelfMapping[]> {
    return this.loadMappings().pipe(map(() => this.findAllMappings(context)));
  }
}
