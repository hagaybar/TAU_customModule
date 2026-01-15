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
 */
export const LOCATION_FILTER_CONFIG: LocationFilterConfig = {
  enabled: true,
  allowedLocations: [
    'Reading room 1 A - 1st floor;',
    'Reading room 1 B - 1st floor;',
  ],
  matchType: 'exact',
};
