/**
 * Library Configuration
 * Defines supported libraries and their locations for the CenLib Map feature
 *
 * MDM (Multi-Dimensional Mapping): Each library can have multiple locations,
 * and each library has its own SVG floor plan.
 *
 * IMPORTANT: The `nameHe` fields MUST exactly match the text displayed in Primo NDE DOM.
 * These are used as lookup keys for matching.
 */

/**
 * Configuration for a single location within a library
 */
export interface LocationConfig {
  /** Display name in Hebrew (MUST match Primo DOM exactly - this is the lookup key) */
  nameHe: string;

  /** Display name in English (for UI display) */
  name: string;
}

/**
 * Configuration for a library
 */
export interface LibraryConfig {
  /** Display name in Hebrew (MUST match Primo DOM exactly - this is the lookup key) */
  nameHe: string;

  /** Display name in English (for UI display) */
  name: string;

  /** Path to library's floor plan SVG (relative to assets) */
  svgPath: string;

  /** Supported locations for this library */
  locations: LocationConfig[];
}

/**
 * Configuration for all supported libraries
 *
 * To add a new library:
 * 1. Find the exact Hebrew name as displayed in Primo DOM (via .getit-library-title)
 * 2. Add a new entry with nameHe matching exactly
 * 3. Add the locations with their exact Hebrew names from [data-qa="location-sub-location"]
 * 4. Create an SVG floor plan and add its path
 * 5. Update the Google Sheet CSV with mapping data
 */
export const LIBRARY_CONFIG: LibraryConfig[] = [
  {
    nameHe: 'הספרייה המרכזית סוראסקי',
    name: 'Sourasky Central Library',
    svgPath: 'assets/maps/sourasky-floor-2.svg',
    locations: [
      { nameHe: "אולם קריאה א'1, קומה ראשונה", name: 'Reading room 1 A - 1st floor' },
      { nameHe: "אולם קריאה א'2, קומה ראשונה", name: 'Reading room 1 B - 1st floor' },
      { nameHe: "אולם קריאה ב'1, קומה שנייה", name: 'Reading room 2 A - 2nd floor' },
      { nameHe: "אולם קריאה ב'2, קומה שנייה", name: 'Reading room 2 B - 2nd floor' },
      // Add more locations as needed
    ],
  }  // Add more libraries as needed
];

/**
 * Helper function to find a library config by name (Hebrew or English)
 * Uses normalized comparison (trim, lowercase, collapse whitespace)
 * Checks both nameHe and name fields to support both languages in Primo
 */
export function findLibraryConfig(libraryName: string): LibraryConfig | undefined {
  const normalized = normalizeForComparison(libraryName);
  return LIBRARY_CONFIG.find(
    (lib) =>
      normalizeForComparison(lib.nameHe) === normalized ||
      normalizeForComparison(lib.name) === normalized
  );
}

/**
 * Helper function to find a location config within a library by name (Hebrew or English)
 * Uses normalized comparison (trim, lowercase, collapse whitespace)
 * Checks both nameHe and name fields to support both languages in Primo
 */
export function findLocationConfig(
  library: LibraryConfig,
  locationName: string
): LocationConfig | undefined {
  const normalized = normalizeForComparison(locationName);
  return library.locations.find(
    (loc) =>
      normalizeForComparison(loc.nameHe) === normalized ||
      normalizeForComparison(loc.name) === normalized
  );
}

/**
 * Normalize a string for comparison
 * - Trims whitespace
 * - Converts to lowercase
 * - Collapses multiple whitespace to single space
 */
export function normalizeForComparison(str: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}
