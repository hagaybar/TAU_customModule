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
import { DATA_SOURCE_CONFIG } from '../config/data-source.config';
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
 * Data source: AWS CloudFront CDN (CSV)
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
   * Load mappings from AWS CDN or cache
   * Returns cached data if still valid, otherwise fetches fresh data
   * Builds the mapping index after loading for efficient MDM lookup
   *
   * @returns Observable of shelf mappings array
   */
  loadMappings(): Observable<ShelfMapping[]> {
    // Check if cache is still valid
    const now = Date.now();
    const cacheAge = now - this.cacheTimestamp;

    if (this.cachedMappings && cacheAge < DATA_SOURCE_CONFIG.cacheDurationMs) {
      console.log('[ShelfMappingService] Using cached mappings');
      return of(this.cachedMappings);
    }

    // Check if URL is configured
    if (
      !DATA_SOURCE_CONFIG.shelfMappingsUrl ||
      DATA_SOURCE_CONFIG.shelfMappingsUrl === 'YOUR_PUBLISHED_CSV_URL_HERE'
    ) {
      console.log(
        '[ShelfMappingService] Data source URL not configured, no mappings available'
      );
      // For MDM, we cannot use legacy mappings as they don't have libraryName/locationName
      // Return empty array - button will be hidden for all items
      this.cachedMappings = [];
      this.buildMappingIndex();
      this.cacheTimestamp = now;
      this.initialized = true;
      return of([]);
    }

    // Fetch from AWS CDN
    this.loadingSubject.next(true);
    console.log('[ShelfMappingService] Fetching mappings from AWS CDN');

    return this.http
      .get(DATA_SOURCE_CONFIG.shelfMappingsUrl, { responseType: 'text' })
      .pipe(
        map((csv) => this.parseCsv(csv)),
        tap((mappings) => {
          this.cachedMappings = mappings;
          this.buildMappingIndex();
          this.cacheTimestamp = Date.now();
          this.initialized = true;
          this.loadingSubject.next(false);
          console.log(
            `[ShelfMappingService] Loaded ${mappings.length} mappings from AWS CDN`
          );
        }),
        catchError((error) => {
          console.error(
            '[ShelfMappingService] Failed to fetch from AWS CDN:',
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
   * Canonicalize a call number to the form the comparison expects.
   *
   * Dewey magnitude is only correct under string comparison when the integer
   * (main class) part is exactly 3 digits — e.g. "099.5" sorts before "100",
   * but "99.5" would not. The producer's data is authored in this canonical
   * 3-digit form, but a call number arriving from the Alma/Primo DOM may not
   * be, so we zero-pad a short leading integer to 3 digits here.
   *
   * Alpha-prefixed call numbers (ML/MT and any other letter-led value) are
   * left untouched: ML/MT are ordered by the natural number after the prefix
   * (handled in compareDeweyNumbers), not by zero-padded string magnitude.
   *
   * @param value Raw call number (or range bound)
   * @returns Canonicalized value
   *
   * @example
   * canonicalizeCallNumber("99.5")        → "099.5"
   * canonicalizeCallNumber("9")           → "009"
   * canonicalizeCallNumber("296.5")       → "296.5"   (already 3 digits)
   * canonicalizeCallNumber("301.153(42)") → "301.153(42)"
   * canonicalizeCallNumber("ML5")         → "ML5"     (alpha prefix, untouched)
   */
  private canonicalizeCallNumber(value: string): string {
    const s = (value ?? '').toString().trim();
    if (!s) return s;
    // Alpha-prefixed (ML/MT, QA, …) — never zero-padded.
    if (/^[A-Za-z]/.test(s)) return s;
    // Dewey: zero-pad the leading integer (main class) to at least 3 digits.
    const match = s.match(/^(\d+)(.*)$/);
    if (!match) return s;
    const intPart = match[1];
    const rest = match[2];
    const padded = intPart.length < 3 ? intPart.padStart(3, '0') : intPart;
    return padded + rest;
  }

  /**
   * Compare two call numbers using the canonical ordering shared with the
   * Primo Maps producer (NDE_MAPS_MANGER, issue #100). This MUST stay
   * behaviorally identical to `compareCallNumbers` in that repo
   * (lambda/range-validation.mjs, admin/utils/range-filter.js,
   * admin/services/data-model.js) so the consumer's in-range decision matches
   * the producer's exactly.
   *
   * Rule:
   *  - DEFAULT: plain string comparison of the (canonicalized) value. Dewey
   *    integer parts are zero-padded to 3 digits so magnitude is correct;
   *    '(' sorts before '.' so a parenthetical sub-classification sorts right
   *    after the base and before any decimal; leading zeros stay significant.
   *  - EXCEPTION: prefixes ML / MT are NOT zero-padded — compare the prefix,
   *    then the number after it as a NATURAL number (ML5 < ML113).
   *
   * (TAU addition over the producer: inputs are canonicalized to 3-digit
   * leading integers first, since DOM call numbers may not arrive padded.)
   *
   * @param a First call number
   * @param b Second call number
   * @returns -1 if a < b, 0 if equal, 1 if a > b
   *
   * @example
   * compareDeweyNumbers("099.5", "100")        → -1
   * compareDeweyNumbers("396(44)", "396.04")   → -1  ('(' < '.')
   * compareDeweyNumbers("320(044)", "320(44)") → -1  (leading zeros significant)
   * compareDeweyNumbers("ML5", "ML113")        → -1  (natural number)
   * compareDeweyNumbers("471.7", "471.7")      →  0
   */
  compareDeweyNumbers(a: string, b: string): number {
    const sa = this.canonicalizeCallNumber(a);
    const sb = this.canonicalizeCallNumber(b);
    const pa = (sa.match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
    const pb = (sb.match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
    if (pa === pb && (pa === 'ML' || pa === 'MT')) {
      const na = parseFloat(sa.slice(pa.length));
      const nb = parseFloat(sb.slice(pb.length));
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na < nb ? -1 : 1;
    }
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }

  /**
   * Check if a call number is within a call-number range (inclusive).
   * Mirrors the producer's `isCallNumberInRange` (range-filter.js): a point is
   * in range when it is >= rangeStart AND <= rangeEnd under compareDeweyNumbers.
   *
   * @param callNumber The call number to check
   * @param rangeStart Start of the range (inclusive)
   * @param rangeEnd End of the range (inclusive)
   * @returns True if callNumber is within [rangeStart, rangeEnd]
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
   * Force refresh mappings from AWS CDN
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
