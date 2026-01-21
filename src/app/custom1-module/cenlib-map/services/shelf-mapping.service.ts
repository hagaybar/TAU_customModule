import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import * as Papa from 'papaparse';
import { SHELF_MAPPINGS, ShelfMapping } from '../config/shelf-mapping.config';
import { GOOGLE_SHEETS_CONFIG } from '../config/google-sheets.config';

/** Raw row from CSV parsing */
interface CsvRow {
  rangeStart: string;
  rangeEnd: string;
  svgCode: string;
  description: string;
  descriptionHe: string;
  floor: string;
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

  /** Cached mappings */
  private cachedMappings: ShelfMapping[] | null = null;

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
    if (!GOOGLE_SHEETS_CONFIG.shelfMappingsUrl ||
        GOOGLE_SHEETS_CONFIG.shelfMappingsUrl === 'YOUR_PUBLISHED_CSV_URL_HERE') {
      console.log('[ShelfMappingService] Google Sheets URL not configured, using fallback');
      this.cachedMappings = SHELF_MAPPINGS;
      this.cacheTimestamp = now;
      this.initialized = true;
      return of(SHELF_MAPPINGS);
    }

    // Fetch from Google Sheets
    this.loadingSubject.next(true);
    console.log('[ShelfMappingService] Fetching mappings from Google Sheets');

    return this.http.get(GOOGLE_SHEETS_CONFIG.shelfMappingsUrl, { responseType: 'text' }).pipe(
      map(csv => this.parseCsv(csv)),
      tap(mappings => {
        this.cachedMappings = mappings;
        this.cacheTimestamp = Date.now();
        this.initialized = true;
        this.loadingSubject.next(false);
        console.log(`[ShelfMappingService] Loaded ${mappings.length} mappings from Google Sheets`);
      }),
      catchError(error => {
        console.error('[ShelfMappingService] Failed to fetch from Google Sheets, using fallback:', error);
        this.cachedMappings = SHELF_MAPPINGS;
        this.cacheTimestamp = Date.now();
        this.initialized = true;
        this.loadingSubject.next(false);
        return of(SHELF_MAPPINGS);
      })
    );
  }

  /**
   * Parse CSV string into ShelfMapping array
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
      .filter(row => row.rangeStart && row.rangeEnd && row.svgCode)
      .map(row => ({
        rangeStart: parseInt(row.rangeStart, 10),
        rangeEnd: parseInt(row.rangeEnd, 10),
        svgCode: row.svgCode.trim(),
        description: row.description?.trim() || '',
        descriptionHe: row.descriptionHe?.trim() || undefined,
        floor: row.floor?.trim() || undefined,
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
   * Uses cached mappings - call loadMappings() first to ensure data is loaded
   *
   * @param callNumber The full call number string
   * @returns The matching ShelfMapping, or null if no match found
   */
  findMapping(callNumber: string): ShelfMapping | null {
    const numValue = this.extractNumericValue(callNumber);
    if (numValue === null) return null;

    // Use cached mappings if available, otherwise use fallback
    const mappings = this.cachedMappings || SHELF_MAPPINGS;

    // Find the first mapping where numValue falls within the range
    const mapping = mappings.find(
      m => numValue >= m.rangeStart && numValue <= m.rangeEnd
    );

    return mapping || null;
  }

  /**
   * Find the shelf mapping for a given call number (async version)
   * Ensures mappings are loaded before searching
   *
   * @param callNumber The full call number string
   * @returns Observable of the matching ShelfMapping, or null if no match found
   */
  findMappingAsync(callNumber: string): Observable<ShelfMapping | null> {
    return this.loadMappings().pipe(
      map(() => this.findMapping(callNumber))
    );
  }

  /**
   * Get all available shelf mappings
   * Useful for debugging or displaying all possible locations
   *
   * @returns Array of all configured shelf mappings
   */
  getAllMappings(): ShelfMapping[] {
    return [...(this.cachedMappings || SHELF_MAPPINGS)];
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
    this.cacheTimestamp = 0;
    return this.loadMappings();
  }
}
