/**
 * Shelf Mapping Configuration
 * Maps library + location + call number ranges to SVG shelf codes
 *
 * MDM (Multi-Dimensional Mapping): Supports multiple libraries and locations
 * Data is loaded from Google Sheets CSV - the SHELF_MAPPINGS array below is
 * legacy/fallback data and will be replaced by CSV data at runtime.
 */

/** Interface for shelf mapping entries (MDM format) */
export interface ShelfMapping {
  /** Library display name in Hebrew (must match Primo DOM exactly) */
  libraryName: string;
  /** Collection/sublocation display name in English (must match Primo DOM when UI is English) */
  collectionName: string;
  /** Collection/sublocation display name in Hebrew (must match Primo DOM when UI is Hebrew) */
  collectionNameHe?: string;
  /** Start of call number range (string to preserve decimals like "892.4") */
  rangeStart: string;
  /** End of call number range (string to preserve decimals) */
  rangeEnd: string;
  /** SVG element identifier for the shelf location */
  svgCode: string;
  /** Human-readable description of the section (English) */
  description: string;
  /** Hebrew description */
  descriptionHe?: string;
  /** Floor number where this section is located */
  floor?: string;
  /** Physical shelf label (e.g., "A-3", "Row 12") */
  shelfLabel?: string;
  /** Physical shelf label in Hebrew */
  shelfLabelHe?: string;
  /** Librarian notes/special instructions */
  notes?: string;
  /** Librarian notes/special instructions in Hebrew */
  notesHe?: string;
}

/**
 * Legacy interface for backward compatibility during transition
 * @deprecated Use ShelfMapping with libraryName/locationName instead
 */
export interface LegacyShelfMapping {
  rangeStart: number;
  rangeEnd: number;
  svgCode: string;
  description: string;
  descriptionHe?: string;
  floor?: string;
}

/**
 * Legacy shelf mappings - 30 shelves covering call numbers 001-999
 * @deprecated This is legacy data for backward compatibility during transition.
 * Production data should come from Google Sheets CSV with libraryName/locationName.
 *
 * Each shelf covers approximately 33 call numbers
 * Distributed across 4 floors (8+8+7+7 shelves)
 */
export const LEGACY_SHELF_MAPPINGS: LegacyShelfMapping[] = [
  // ============ Floor 1: SHELF-01 to SHELF-08 (001-264) ============
  {
    rangeStart: 1,
    rangeEnd: 33,
    svgCode: 'SHELF-01',
    description: 'General Works A',
    descriptionHe: 'כללי א',
    floor: '1',
  },
  {
    rangeStart: 34,
    rangeEnd: 66,
    svgCode: 'SHELF-02',
    description: 'General Works B',
    descriptionHe: 'כללי ב',
    floor: '1',
  },
  {
    rangeStart: 67,
    rangeEnd: 99,
    svgCode: 'SHELF-03',
    description: 'General Works C',
    descriptionHe: 'כללי ג',
    floor: '1',
  },
  {
    rangeStart: 100,
    rangeEnd: 132,
    svgCode: 'SHELF-04',
    description: 'Philosophy A',
    descriptionHe: 'פילוסופיה א',
    floor: '1',
  },
  {
    rangeStart: 133,
    rangeEnd: 165,
    svgCode: 'SHELF-05',
    description: 'Philosophy B',
    descriptionHe: 'פילוסופיה ב',
    floor: '1',
  },
  {
    rangeStart: 166,
    rangeEnd: 198,
    svgCode: 'SHELF-06',
    description: 'Philosophy C',
    descriptionHe: 'פילוסופיה ג',
    floor: '1',
  },
  {
    rangeStart: 199,
    rangeEnd: 231,
    svgCode: 'SHELF-07',
    description: 'Religion A',
    descriptionHe: 'דת א',
    floor: '1',
  },
  {
    rangeStart: 232,
    rangeEnd: 264,
    svgCode: 'SHELF-08',
    description: 'Religion B',
    descriptionHe: 'דת ב',
    floor: '1',
  },

  // ============ Floor 2: SHELF-09 to SHELF-16 (265-528) ============
  {
    rangeStart: 265,
    rangeEnd: 297,
    svgCode: 'SHELF-09',
    description: 'Religion C',
    descriptionHe: 'דת ג',
    floor: '2',
  },
  {
    rangeStart: 298,
    rangeEnd: 330,
    svgCode: 'SHELF-10',
    description: 'Social Sciences A',
    descriptionHe: 'מדעי החברה א',
    floor: '2',
  },
  {
    rangeStart: 331,
    rangeEnd: 363,
    svgCode: 'SHELF-11',
    description: 'Social Sciences B',
    descriptionHe: 'מדעי החברה ב',
    floor: '2',
  },
  {
    rangeStart: 364,
    rangeEnd: 396,
    svgCode: 'SHELF-12',
    description: 'Social Sciences C',
    descriptionHe: 'מדעי החברה ג',
    floor: '2',
  },
  {
    rangeStart: 397,
    rangeEnd: 429,
    svgCode: 'SHELF-13',
    description: 'Language A',
    descriptionHe: 'שפה א',
    floor: '2',
  },
  {
    rangeStart: 430,
    rangeEnd: 462,
    svgCode: 'SHELF-14',
    description: 'Language B',
    descriptionHe: 'שפה ב',
    floor: '2',
  },
  {
    rangeStart: 463,
    rangeEnd: 495,
    svgCode: 'SHELF-15',
    description: 'Language C',
    descriptionHe: 'שפה ג',
    floor: '2',
  },
  {
    rangeStart: 496,
    rangeEnd: 528,
    svgCode: 'SHELF-16',
    description: 'Science A',
    descriptionHe: 'מדעים א',
    floor: '2',
  },

  // ============ Floor 3: SHELF-17 to SHELF-23 (529-759) ============
  {
    rangeStart: 529,
    rangeEnd: 561,
    svgCode: 'SHELF-17',
    description: 'Science B',
    descriptionHe: 'מדעים ב',
    floor: '3',
  },
  {
    rangeStart: 562,
    rangeEnd: 594,
    svgCode: 'SHELF-18',
    description: 'Science C',
    descriptionHe: 'מדעים ג',
    floor: '3',
  },
  {
    rangeStart: 595,
    rangeEnd: 627,
    svgCode: 'SHELF-19',
    description: 'Technology A',
    descriptionHe: 'טכנולוגיה א',
    floor: '3',
  },
  {
    rangeStart: 628,
    rangeEnd: 660,
    svgCode: 'SHELF-20',
    description: 'Technology B',
    descriptionHe: 'טכנולוגיה ב',
    floor: '3',
  },
  {
    rangeStart: 661,
    rangeEnd: 693,
    svgCode: 'SHELF-21',
    description: 'Technology C',
    descriptionHe: 'טכנולוגיה ג',
    floor: '3',
  },
  {
    rangeStart: 694,
    rangeEnd: 726,
    svgCode: 'SHELF-22',
    description: 'Arts A',
    descriptionHe: 'אמנות א',
    floor: '3',
  },
  {
    rangeStart: 727,
    rangeEnd: 759,
    svgCode: 'SHELF-23',
    description: 'Arts B',
    descriptionHe: 'אמנות ב',
    floor: '3',
  },

  // ============ Floor 4: SHELF-24 to SHELF-30 (760-999) ============
  {
    rangeStart: 760,
    rangeEnd: 792,
    svgCode: 'SHELF-24',
    description: 'Arts C',
    descriptionHe: 'אמנות ג',
    floor: '4',
  },
  {
    rangeStart: 793,
    rangeEnd: 825,
    svgCode: 'SHELF-25',
    description: 'Literature A',
    descriptionHe: 'ספרות א',
    floor: '4',
  },
  {
    rangeStart: 826,
    rangeEnd: 858,
    svgCode: 'SHELF-26',
    description: 'Literature B',
    descriptionHe: 'ספרות ב',
    floor: '4',
  },
  {
    rangeStart: 859,
    rangeEnd: 891,
    svgCode: 'SHELF-27',
    description: 'Literature C',
    descriptionHe: 'ספרות ג',
    floor: '4',
  },
  {
    rangeStart: 892,
    rangeEnd: 924,
    svgCode: 'SHELF-28',
    description: 'History A',
    descriptionHe: 'היסטוריה א',
    floor: '4',
  },
  {
    rangeStart: 925,
    rangeEnd: 957,
    svgCode: 'SHELF-29',
    description: 'History B',
    descriptionHe: 'היסטוריה ב',
    floor: '4',
  },
  {
    rangeStart: 958,
    rangeEnd: 999,
    svgCode: 'SHELF-30',
    description: 'History C',
    descriptionHe: 'היסטוריה ג',
    floor: '4',
  },
];
