import { Injectable } from '@angular/core';
import { SHELF_MAPPINGS, ShelfMapping } from '../config/shelf-mapping.config';

/**
 * Shelf Mapping Service
 * Provides methods to map call numbers to shelf locations
 *
 * Phase 2: Range-based mapping using Dewey Decimal classification
 */
@Injectable({ providedIn: 'root' })
export class ShelfMappingService {

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
   * Find the shelf mapping for a given call number
   * Matches the numeric portion against configured ranges
   *
   * @param callNumber The full call number string
   * @returns The matching ShelfMapping, or null if no match found
   */
  findMapping(callNumber: string): ShelfMapping | null {
    const numValue = this.extractNumericValue(callNumber);
    if (numValue === null) return null;

    // Find the first mapping where numValue falls within the range
    const mapping = SHELF_MAPPINGS.find(
      m => numValue >= m.rangeStart && numValue <= m.rangeEnd
    );

    return mapping || null;
  }

  /**
   * Get all available shelf mappings
   * Useful for debugging or displaying all possible locations
   *
   * @returns Array of all configured shelf mappings
   */
  getAllMappings(): ShelfMapping[] {
    return [...SHELF_MAPPINGS];
  }
}
