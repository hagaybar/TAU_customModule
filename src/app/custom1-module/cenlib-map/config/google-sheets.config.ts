/**
 * Data Source Configuration
 * URLs and settings for fetching shelf mappings and map assets
 *
 * Primary source: AWS CloudFront CDN
 * Backup source: Google Sheets (for CSV data only)
 */

/** AWS CloudFront CDN base URL */
export const AWS_CDN_BASE_URL = 'https://d3h8i7y9p8lyw7.cloudfront.net';

export const DATA_SOURCE_CONFIG = {
  /**
   * Primary: AWS CloudFront CDN (CORS configured for tau.primo.exlibrisgroup.com and localhost)
   */
  shelfMappingsUrl: `${AWS_CDN_BASE_URL}/data/mapping.csv`,

  /**
   * Backup: Google Sheets (has CORS enabled)
   * Uncomment if AWS CloudFront has issues
   */
  // shelfMappingsUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTE9A3GC_l4_kjAjy2c6Cc_woDgJCEctZSo0dY2zN-UMgziokuWLqZwSznQtaAHa5v7g7K_tkjMVhXY/pub?gid=1782446313&single=true&output=csv',

  /** Cache duration in milliseconds (5 minutes default) */
  cacheDurationMs: 5 * 60 * 1000,
};

/**
 * Map SVG Configuration
 * Floor plan SVG files hosted on AWS CloudFront
 */
export const MAP_CONFIG = {
  /** Base URL for map SVG files */
  baseUrl: `${AWS_CDN_BASE_URL}/maps`,

  /**
   * Get the URL for a specific floor's SVG map
   * @param floor Floor number (0, 1, or 2)
   * @returns Full URL to the floor's SVG file
   */
  getFloorMapUrl: (floor: string | number): string => {
    return `${AWS_CDN_BASE_URL}/maps/floor_${floor}.svg`;
  },
};

/** @deprecated Use DATA_SOURCE_CONFIG instead */
export const GOOGLE_SHEETS_CONFIG = DATA_SOURCE_CONFIG;
