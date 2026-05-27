/**
 * Data Source Configuration
 * URLs and settings for fetching shelf mappings and map assets
 *
 * Source: AWS CloudFront CDN (shelf-mapping CSV + floor-plan SVGs)
 */

/** AWS CloudFront CDN base URL */
export const AWS_CDN_BASE_URL = 'https://d3h8i7y9p8lyw7.cloudfront.net';

export const DATA_SOURCE_CONFIG = {
  /**
   * AWS CloudFront CDN — shelf-mapping CSV.
   * CORS configured for tau.primo.exlibrisgroup.com and localhost.
   */
  shelfMappingsUrl: `${AWS_CDN_BASE_URL}/data/mapping.csv`,

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
