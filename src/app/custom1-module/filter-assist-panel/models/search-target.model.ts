/**
 * Interface for external search source configuration
 */
export interface SearchTarget {
  /** English name of the search source */
  name: string;

  /** Hebrew name of the search source */
  nameHe: string;

  /** Base URL for the search source */
  url: string;

  /** Path to the icon image (primary) */
  img: string;

  /** Path to the icon image (alternative) */
  img_2: string;

  /** Alt text for the icon */
  alt: string;

  /**
   * Mapping function to convert Primo query format to external source format
   * @param queries Array of query strings from Primo URL
   * @param filters Array of filter strings from Primo URL
   * @returns Formatted query string for the external source
   */
  mapping: (queries: string[], filters: string[]) => string;
}

/**
 * Interface for parsed search query data
 */
export interface SearchQuery {
  /** Array of query strings from URL (e.g., query parameter) */
  queries: string[];

  /** Array of filter strings from URL (e.g., pfilter parameter) */
  filters: string[];

  /** Simple search term extracted from query */
  searchTerm: string;
}
