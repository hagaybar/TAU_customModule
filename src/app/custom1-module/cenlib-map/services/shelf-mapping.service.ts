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

/** Raw row from CSV parsing (MDM format with library/collection names) */
interface CsvRow {
  libraryName: string;
  libraryNameHe: string;
  collectionName: string;
  collectionNameHe: string;
  rangeStart: string;
  rangeEnd: string;
  svgCode: string;
  description: string;
  descriptionHe: string;
  floor: string;
  shelfLabel: string;
  shelfLabelHe: string;
  notes: string;
  notesHe: string;
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
   * Nested mapping index for O(1) lookup by library+collection
   * Structure: libraryName (normalized) -> collectionName (normalized) -> ShelfMapping[]
   * Both English and Hebrew collection names are indexed as keys pointing to the same mappings
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
   * Expects columns: libraryName, collectionName, collectionNameHe, rangeStart, rangeEnd, svgCode, etc.
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
          row.collectionName &&
          row.rangeStart &&
          row.rangeEnd &&
          row.svgCode
      )
      .map((row) => ({
        libraryName: row.libraryName.trim(),
        libraryNameHe: row.libraryNameHe?.trim() || undefined,
        collectionName: row.collectionName.trim(),
        collectionNameHe: row.collectionNameHe?.trim() || undefined,
        rangeStart: row.rangeStart.trim(),
        rangeEnd: row.rangeEnd.trim(),
        svgCode: row.svgCode.trim(),
        description: row.description?.trim() || '',
        descriptionHe: row.descriptionHe?.trim() || undefined,
        floor: row.floor?.trim() || undefined,
        shelfLabel: row.shelfLabel?.trim() || undefined,
        shelfLabelHe: row.shelfLabelHe?.trim() || undefined,
        notes: row.notes?.trim() || undefined,
        notesHe: row.notesHe?.trim() || undefined,
      }));
  }

  /**
   * Parse a Dewey Decimal call number into its components
   * Handles formats like: "296.851", "QA76.73", "BF109", "100"
   *
   * @param callNumber The call number string (without cutter)
   * @returns Parsed components or null if invalid
   *
   * @example
   * parseCallNumber("296.851") → { prefix: "", mainClass: 296, decimal: "851" }
   * parseCallNumber("QA76.73") → { prefix: "QA", mainClass: 76, decimal: "73" }
   * parseCallNumber("BF109")   → { prefix: "BF", mainClass: 109, decimal: "" }
   * parseCallNumber("100")     → { prefix: "", mainClass: 100, decimal: "" }
   */
  private parseCallNumber(callNumber: string): { prefix: string; mainClass: number; decimal: string } | null {
    if (!callNumber) return null;

    // Trim and normalize
    const normalized = callNumber.trim();

    // Match: optional letter prefix + digits + optional decimal portion
    // Pattern: ^([A-Za-z]*)\s*(\d+)(?:\.(\d+))?
    const match = normalized.match(/^([A-Za-z]*)\s*(\d+)(?:\.(\d+))?/);
    if (!match) return null;

    const mainClass = parseInt(match[2], 10);
    if (isNaN(mainClass)) return null;

    return {
      prefix: match[1] || '',
      mainClass,
      decimal: match[3] || '',
    };
  }

  /**
   * Compare two Dewey Decimal call numbers
   * Follows library sorting rules:
   * 1. Compare letter prefix alphabetically
   * 2. Compare main class (before decimal) numerically
   * 3. Compare decimal portion digit-by-digit (string comparison)
   *
   * @param a First call number
   * @param b Second call number
   * @returns Negative if a < b, positive if a > b, 0 if equal
   *
   * @example
   * compareDeweyNumbers("296.81", "296.851")  → negative (296.81 < 296.851)
   * compareDeweyNumbers("296.851", "296.9")   → negative (296.851 < 296.9, because .8 < .9)
   * compareDeweyNumbers("QA76", "QB50")       → negative (QA < QB)
   * compareDeweyNumbers("10", "9")            → positive (10 > 9)
   */
  compareDeweyNumbers(a: string, b: string): number {
    const parsedA = this.parseCallNumber(a);
    const parsedB = this.parseCallNumber(b);

    // Handle null cases
    if (!parsedA && !parsedB) return 0;
    if (!parsedA) return -1;
    if (!parsedB) return 1;

    // 1. Compare prefix alphabetically (case-insensitive)
    const prefixCompare = parsedA.prefix.toLowerCase().localeCompare(parsedB.prefix.toLowerCase());
    if (prefixCompare !== 0) return prefixCompare;

    // 2. Compare main class numerically
    const mainClassCompare = parsedA.mainClass - parsedB.mainClass;
    if (mainClassCompare !== 0) return mainClassCompare;

    // 3. Compare decimal portion digit-by-digit (string comparison)
    // This correctly handles: "81" < "851" < "9" (because '8' < '9')
    return parsedA.decimal.localeCompare(parsedB.decimal);
  }

  /**
   * Check if a call number is within a Dewey Decimal range
   * Uses proper digit-by-digit comparison for decimal portions
   *
   * @param callNumber The call number to check
   * @param rangeStart Start of the range
   * @param rangeEnd End of the range
   * @returns True if callNumber >= rangeStart AND callNumber <= rangeEnd
   */
  isInDeweyRange(callNumber: string, rangeStart: string, rangeEnd: string): boolean {
    return this.compareDeweyNumbers(callNumber, rangeStart) >= 0 &&
           this.compareDeweyNumbers(callNumber, rangeEnd) <= 0;
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
    if (!callNumber || !this.parseCallNumber(callNumber)) return null;

    const mappings = this.cachedMappings || [];

    // Find the first mapping where callNumber falls within the range
    const mapping = mappings.find((m) =>
      this.isInDeweyRange(callNumber, m.rangeStart, m.rangeEnd)
    );

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
   *
   * Indexes by BOTH English (collectionName) and Hebrew (collectionNameHe) collection names
   * so lookups work regardless of UI language
   */
  private buildMappingIndex(): void {
    if (!this.cachedMappings) {
      this.mappingIndex = null;
      return;
    }

    this.mappingIndex = new Map();

    for (const mapping of this.cachedMappings) {
      // Index by BOTH English and Hebrew library names
      const libraryKeys: string[] = [];
      if (mapping.libraryName) {
        libraryKeys.push(this.normalize(mapping.libraryName));
      }
      if (mapping.libraryNameHe) {
        libraryKeys.push(this.normalize(mapping.libraryNameHe));
      }

      // Index by BOTH English and Hebrew collection names
      const collectionKeys: string[] = [];
      if (mapping.collectionName) {
        collectionKeys.push(this.normalize(mapping.collectionName));
      }
      if (mapping.collectionNameHe) {
        collectionKeys.push(this.normalize(mapping.collectionNameHe));
      }

      // Add mapping under EACH library name key (both English and Hebrew)
      for (const libKey of libraryKeys) {
        if (!this.mappingIndex.has(libKey)) {
          this.mappingIndex.set(libKey, new Map());
        }

        const libMap = this.mappingIndex.get(libKey)!;

        // Add mapping under EACH collection name key
        for (const colKey of collectionKeys) {
          if (!libMap.has(colKey)) {
            libMap.set(colKey, []);
          }
          libMap.get(colKey)!.push(mapping);
        }
      }
    }

    console.log(
      `[ShelfMappingService] Built mapping index with ${this.mappingIndex.size} libraries`
    );
  }

  /**
   * Check if a call number falls within a range
   * Uses Dewey Decimal digit-by-digit comparison for accurate matching
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
    return this.isInDeweyRange(callNumber, rangeStart, rangeEnd);
  }

  /**
   * Find ALL mappings for a given context (supports overlapping ranges)
   * This is the main MDM lookup method
   *
   * @param context Location context with library/collection names and call number
   * @returns Array of all matching ShelfMapping objects
   */
  findAllMappings(context: LocationContext): ShelfMapping[] {
    if (!this.mappingIndex) {
      console.warn('[ShelfMappingService] Mapping index not built yet');
      return [];
    }

    const libKey = this.normalize(context.libraryName);
    const colKey = this.normalize(context.collectionName);

    const libMap = this.mappingIndex.get(libKey);
    if (!libMap) {
      console.log(`[ShelfMappingService] No mappings for library: ${context.libraryName}`);
      return [];
    }

    const mappings = libMap.get(colKey);
    if (!mappings) {
      console.log(
        `[ShelfMappingService] No mappings for collection: ${context.collectionName} in library: ${context.libraryName}`
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
   * @param libraryName Library name (from DOM)
   * @param collectionName Collection name (from DOM, English or Hebrew)
   * @param callNumber Call number (without cutter)
   * @returns Observable<boolean> - true if at least one mapping exists
   */
  hasMappingAsync(
    libraryName: string,
    collectionName: string,
    callNumber: string
  ): Observable<boolean> {
    return this.loadMappings().pipe(
      map(() =>
        this.findAllMappings({
          callNumber,
          rawCallNumber: callNumber,
          libraryName,
          collectionName,
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
