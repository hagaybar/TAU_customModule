/**
 * Floor Layout Configuration
 * Defines the visual layout of shelves on each floor for the SVG map
 *
 * Phase 4: SVG Shelf Map Visualization
 */

export interface ShelfRect {
  /** Shelf identifier matching svgCode in shelf-mapping.config.ts */
  id: string;
  /** SVG x position */
  x: number;
  /** SVG y position */
  y: number;
  /** Call number range label for tooltip (e.g., '001-033') */
  rangeLabel: string;
}

export interface FloorData {
  /** Floor number */
  floor: string;
  /** Display label (English) */
  label: string;
  /** Display label (Hebrew) */
  labelHe: string;
  /** Shelves on this floor */
  shelves: ShelfRect[];
}

/**
 * Floor layout with 30 shelves across 4 floors
 * Each floor has a 2x4 grid layout (2 rows, 4 columns)
 * SVG viewBox is 300x150
 */
export const FLOOR_LAYOUT: FloorData[] = [
  // Floor 1: SHELF-01 to SHELF-08 (ranges 001-264)
  {
    floor: '1',
    label: 'Floor 1',
    labelHe: 'קומה 1',
    shelves: [
      // Row 1
      { id: 'SHELF-01', x: 10, y: 20, rangeLabel: '001-033' },
      { id: 'SHELF-02', x: 80, y: 20, rangeLabel: '034-066' },
      { id: 'SHELF-03', x: 150, y: 20, rangeLabel: '067-099' },
      { id: 'SHELF-04', x: 220, y: 20, rangeLabel: '100-132' },
      // Row 2
      { id: 'SHELF-05', x: 10, y: 80, rangeLabel: '133-165' },
      { id: 'SHELF-06', x: 80, y: 80, rangeLabel: '166-198' },
      { id: 'SHELF-07', x: 150, y: 80, rangeLabel: '199-231' },
      { id: 'SHELF-08', x: 220, y: 80, rangeLabel: '232-264' },
    ],
  },
  // Floor 2: SHELF-09 to SHELF-16 (ranges 265-528)
  {
    floor: '2',
    label: 'Floor 2',
    labelHe: 'קומה 2',
    shelves: [
      // Row 1
      { id: 'SHELF-09', x: 10, y: 20, rangeLabel: '265-297' },
      { id: 'SHELF-10', x: 80, y: 20, rangeLabel: '298-330' },
      { id: 'SHELF-11', x: 150, y: 20, rangeLabel: '331-363' },
      { id: 'SHELF-12', x: 220, y: 20, rangeLabel: '364-396' },
      // Row 2
      { id: 'SHELF-13', x: 10, y: 80, rangeLabel: '397-429' },
      { id: 'SHELF-14', x: 80, y: 80, rangeLabel: '430-462' },
      { id: 'SHELF-15', x: 150, y: 80, rangeLabel: '463-495' },
      { id: 'SHELF-16', x: 220, y: 80, rangeLabel: '496-528' },
    ],
  },
  // Floor 3: SHELF-17 to SHELF-23 (ranges 529-759)
  {
    floor: '3',
    label: 'Floor 3',
    labelHe: 'קומה 3',
    shelves: [
      // Row 1
      { id: 'SHELF-17', x: 10, y: 20, rangeLabel: '529-561' },
      { id: 'SHELF-18', x: 80, y: 20, rangeLabel: '562-594' },
      { id: 'SHELF-19', x: 150, y: 20, rangeLabel: '595-627' },
      { id: 'SHELF-20', x: 220, y: 20, rangeLabel: '628-660' },
      // Row 2 (3 shelves)
      { id: 'SHELF-21', x: 10, y: 80, rangeLabel: '661-693' },
      { id: 'SHELF-22', x: 80, y: 80, rangeLabel: '694-726' },
      { id: 'SHELF-23', x: 150, y: 80, rangeLabel: '727-759' },
    ],
  },
  // Floor 4: SHELF-24 to SHELF-30 (ranges 760-999)
  {
    floor: '4',
    label: 'Floor 4',
    labelHe: 'קומה 4',
    shelves: [
      // Row 1
      { id: 'SHELF-24', x: 10, y: 20, rangeLabel: '760-792' },
      { id: 'SHELF-25', x: 80, y: 20, rangeLabel: '793-825' },
      { id: 'SHELF-26', x: 150, y: 20, rangeLabel: '826-858' },
      { id: 'SHELF-27', x: 220, y: 20, rangeLabel: '859-891' },
      // Row 2 (3 shelves)
      { id: 'SHELF-28', x: 10, y: 80, rangeLabel: '892-924' },
      { id: 'SHELF-29', x: 80, y: 80, rangeLabel: '925-957' },
      { id: 'SHELF-30', x: 150, y: 80, rangeLabel: '958-999' },
    ],
  },
];
