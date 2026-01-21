/**
 * Location Filter Configuration
 * Defines which locations should display the CenLib Map button
 *
 * Phase 3: Location filtering - show button only for specific locations
 */

export interface LocationFilterConfig {
  /** Whether location filtering is enabled */
  enabled: boolean;
  /** List of allowed location names (button shows only for these) */
  allowedLocations: string[];
  /** Match type: 'exact' requires full match, 'contains' checks if location includes the value */
  matchType: 'exact' | 'contains';
}

/**
 * Current location filter configuration
 * Set enabled: false to show button for all locations
 *
 * Note: The filter matches against the library name (e.g., "Sourasky Central Library")
 * not the sub-location (e.g., "Reading room 1 B - 1st floor")
 */
export const LOCATION_FILTER_CONFIG: LocationFilterConfig = {
  enabled: true,
  allowedLocations: [
    'Sourasky Central Library',
  ],
  matchType: 'contains',
};
