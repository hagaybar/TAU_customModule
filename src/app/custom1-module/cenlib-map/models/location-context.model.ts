/**
 * Location Context Model
 * Represents the full context for a library item's physical location
 *
 * Used to pass location information from DOM extraction to mapping lookup
 */

/**
 * Context information extracted from Primo DOM for shelf mapping lookup
 */
export interface LocationContext {
  /** Call number WITHOUT cutter string (used for range matching) */
  callNumber: string;

  /** Raw call number from DOM (before cutter removal, for display) */
  rawCallNumber: string;

  /** Library display name in Hebrew (from DOM via .getit-library-title) */
  libraryName: string;

  /** Collection/sublocation display name from DOM (via [data-qa="location-sub-location"]) */
  collectionName: string;

  /** Library display name in English (from config lookup, for UI) */
  libraryNameEn?: string;

  /** Collection display name in English (from config lookup, for UI) */
  collectionNameEn?: string;
}

/**
 * Result of a shelf mapping lookup - includes context plus matching shelf info
 */
export interface MappingResult {
  /** The original location context */
  context: LocationContext;

  /** SVG codes of all matching shelves (may be multiple for overlapping ranges) */
  shelfCodes: string[];

  /** Floor where the item is located */
  floor?: string;

  /** Path to the library's SVG floor plan */
  svgPath?: string;

  /** Human-readable shelf labels */
  shelfLabels?: string[];

  /** Description of the location */
  description?: string;

  /** Hebrew description */
  descriptionHe?: string;
}
