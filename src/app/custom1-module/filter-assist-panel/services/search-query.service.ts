import { Injectable } from '@angular/core';
import { SearchQuery } from '../models/search-target.model';

/**
 * Service to extract and parse search parameters from the URL
 * Handles Primo NDE query format and converts to usable search data
 * Uses native browser location API to work in NDE micro-frontend context
 */
@Injectable({
  providedIn: 'root'
})
export class SearchQueryService {
  /**
   * Parse URL query parameters from window.location
   * @returns Object with query parameter key-value pairs
   */
  private getUrlParams(): URLSearchParams {
    return new URLSearchParams(window.location.search);
  }

  /**
   * Get all search query data from current URL
   * @returns SearchQuery object with queries, filters, and search term
   */
  getSearchData(): SearchQuery {
    const urlParams = this.getUrlParams();

    const queries = this.getSearchQueries(urlParams);
    const filters = this.getSearchFilters(urlParams);
    const searchTerm = this.getSearchTerm(queries);

    return {
      queries,
      filters,
      searchTerm
    };
  }

  /**
   * Extract query array from URL parameters
   * Handles both single query and array of queries
   * @param urlParams URLSearchParams from window.location
   * @returns Array of query strings
   */
  private getSearchQueries(urlParams: URLSearchParams): string[] {
    // URLSearchParams.getAll() returns array of all values for a key
    const queries = urlParams.getAll('query');

    if (queries.length === 0) {
      // Try single query parameter
      const singleQuery = urlParams.get('query');
      return singleQuery ? [singleQuery] : [];
    }

    return queries;
  }

  /**
   * Extract filter array from URL parameters
   * Handles both single filter and array of filters
   * @param urlParams URLSearchParams from window.location
   * @returns Array of filter strings
   */
  private getSearchFilters(urlParams: URLSearchParams): string[] {
    // URLSearchParams.getAll() returns array of all values for a key
    const filters = urlParams.getAll('pfilter');

    if (filters.length === 0) {
      // Try single filter parameter
      const singleFilter = urlParams.get('pfilter');
      return singleFilter ? [singleFilter] : [];
    }

    return filters;
  }

  /**
   * Extract simple search term from query array
   * Parses Primo query format to get the actual search text
   * Example: "any,contains,test search,AND" -> "test search"
   * @param queries Array of query strings
   * @returns Extracted search term or empty string
   */
  private getSearchTerm(queries: string[]): string {
    if (queries.length === 0) {
      return '';
    }

    try {
      // Take the first query and extract the search term
      // Primo format: "field,operator,searchTerm,boolean"
      const firstQuery = queries[0];
      const parts = firstQuery.split(',');

      if (parts.length >= 3) {
        // Get the search term (third element)
        let searchTerm = parts.slice(2).join(','); // In case term contains commas

        // Remove trailing boolean operator if present
        if (searchTerm.endsWith(',AND') || searchTerm.endsWith(',OR')) {
          const lastComma = searchTerm.lastIndexOf(',');
          searchTerm = searchTerm.slice(0, lastComma);
        }

        return searchTerm;
      }

      return firstQuery; // Fallback to full query if parsing fails
    } catch (e) {
      console.warn('Error parsing search term:', e);
      return '';
    }
  }

  /**
   * Get current UI language from URL or default to English
   * @returns Language code ('en' or 'he')
   */
  getCurrentLanguage(): 'en' | 'he' {
    const urlParams = this.getUrlParams();
    const lang = urlParams.get('lang');

    // Check if Hebrew is requested
    return lang === 'he' || lang === 'he_IL' ? 'he' : 'en';
  }
}
