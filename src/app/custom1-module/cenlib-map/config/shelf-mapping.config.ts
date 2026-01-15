/**
 * Shelf Mapping Configuration
 * Maps call number ranges to SVG shelf codes
 *
 * Phase 2: Test mappings based on Dewey Decimal classification ranges
 */

/** Interface for shelf mapping entries */
export interface ShelfMapping {
  /** Start of numeric range (inclusive) */
  rangeStart: number;
  /** End of numeric range (inclusive) */
  rangeEnd: number;
  /** SVG element identifier for the shelf location */
  svgCode: string;
  /** Human-readable description of the section */
  description: string;
  /** Hebrew description */
  descriptionHe?: string;
  /** Floor number where this section is located */
  floor?: string;
}

/**
 * Test shelf mappings based on Dewey Decimal classification
 * These are placeholder mappings for POC testing
 * In production, this would be replaced with actual library floor/shelf mappings
 */
export const SHELF_MAPPINGS: ShelfMapping[] = [
  {
    rangeStart: 0,
    rangeEnd: 99,
    svgCode: 'SHELF-GEN-01',
    description: 'General Works',
    descriptionHe: 'כללי',
    floor: '1'
  },
  {
    rangeStart: 100,
    rangeEnd: 199,
    svgCode: 'SHELF-PHI-02',
    description: 'Philosophy & Psychology',
    descriptionHe: 'פילוסופיה ופסיכולוגיה',
    floor: '1'
  },
  {
    rangeStart: 200,
    rangeEnd: 299,
    svgCode: 'SHELF-REL-03',
    description: 'Religion',
    descriptionHe: 'דת',
    floor: '1'
  },
  {
    rangeStart: 300,
    rangeEnd: 399,
    svgCode: 'SHELF-SOC-04',
    description: 'Social Sciences',
    descriptionHe: 'מדעי החברה',
    floor: '2'
  },
  {
    rangeStart: 400,
    rangeEnd: 499,
    svgCode: 'SHELF-LNG-05',
    description: 'Language',
    descriptionHe: 'שפה',
    floor: '2'
  },
  {
    rangeStart: 500,
    rangeEnd: 599,
    svgCode: 'SHELF-SCI-06',
    description: 'Science',
    descriptionHe: 'מדעים',
    floor: '2'
  },
  {
    rangeStart: 600,
    rangeEnd: 699,
    svgCode: 'SHELF-TEC-07',
    description: 'Technology',
    descriptionHe: 'טכנולוגיה',
    floor: '3'
  },
  {
    rangeStart: 700,
    rangeEnd: 799,
    svgCode: 'SHELF-ART-08',
    description: 'Arts & Recreation',
    descriptionHe: 'אמנות ובידור',
    floor: '3'
  },
  {
    rangeStart: 800,
    rangeEnd: 899,
    svgCode: 'SHELF-LIT-09',
    description: 'Literature',
    descriptionHe: 'ספרות',
    floor: '3'
  },
  {
    rangeStart: 900,
    rangeEnd: 999,
    svgCode: 'SHELF-HIS-10',
    description: 'History & Geography',
    descriptionHe: 'היסטוריה וגאוגרפיה',
    floor: '4'
  },
];
