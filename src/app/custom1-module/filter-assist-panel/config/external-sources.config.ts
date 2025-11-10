import { SearchTarget } from '../models/search-target.model';

/**
 * Helper function to extract and format search queries for external sources
 * Converts Primo query format to simple search terms
 * @param queries Array of Primo-formatted query strings
 * @returns URL-encoded search string
 */
function buildSearchQuery(queries: string[]): string {
  try {
    let fullSearchQuery = '';

    // Process each query element
    queries.forEach((queryElement) => {
      // Primo query format: "field,operator,searchTerm,boolean"
      // Example: "any,contains,test search,AND"

      const firstCommaIndex = queryElement.indexOf(',');
      const secondCommaIndex = queryElement.indexOf(',', firstCommaIndex + 1);
      let searchStr = queryElement.slice(secondCommaIndex + 1);

      // Remove trailing boolean operators (,AND or ,OR)
      if (searchStr.endsWith(',AND') || searchStr.endsWith(',OR')) {
        const finalComma = searchStr.lastIndexOf(',');
        searchStr = searchStr.slice(0, finalComma);
      }

      // Append to full query with space separator
      fullSearchQuery = fullSearchQuery.concat(searchStr + ' ');
    });

    // Trim and encode for URL
    return encodeURIComponent(fullSearchQuery.trim());
  } catch (e) {
    console.error('Error building search query:', e);
    return '';
  }
}

/**
 * Configuration array of external search sources
 * Each source can be clicked from the filter panel to search with current query
 */
export const EXTERNAL_SEARCH_SOURCES: SearchTarget[] = [
  {
    name: 'ULI',
    nameHe: 'הקטלוג המאוחד (ULI)',
    url: 'https://uli.nli.org.il/discovery/search?query=any,contains,',
    img: 'assets/images/external-sources/uli_logo_16_16.png',
    img_2: 'assets/images/external-sources/uli_logo_16_16.png',
    alt: 'ULI - Union List of Israel',
    mapping: (queries: string[], filters: string[]): string => {
      const searchQuery = buildSearchQuery(queries);
      return `${searchQuery}&tab=ULIC_slot&search_scope=ULIC&vid=972NNL_ULI_C:MAIN&offset=0`;
    }
  },
  {
    name: 'WorldCat',
    nameHe: 'WorldCat',
    url: 'https://www.worldcat.org/search?qt=worldcat_org_all&q=',
    img: 'assets/images/external-sources/worldcat-16.png',
    img_2: 'assets/images/external-sources/worldcat-16.png',
    alt: 'WorldCat',
    mapping: (queries: string[], filters: string[]): string => {
      return buildSearchQuery(queries);
    }
  },
  {
    name: 'Google Scholar',
    nameHe: 'גוגל סקולר',
    url: 'https://scholar.google.com/scholar?q=',
    img: 'assets/images/external-sources/scholar_logo_16_16.png',
    img_2: 'assets/images/external-sources/scholar_logo_16_16.png',
    alt: 'Google Scholar',
    mapping: (queries: string[], filters: string[]): string => {
      return buildSearchQuery(queries);
    }
  }
  // Crossref is commented out in the original - can be added later if needed
  /*
  {
    name: 'Crossref',
    nameHe: 'Crossref',
    url: 'https://search.crossref.org/?from_ui=yes&q=',
    img: 'assets/images/external-sources/crossref_logo_16_16.png',
    img_2: 'assets/images/external-sources/crossref_logo_16_16.png',
    alt: 'Crossref',
    mapping: (queries: string[], filters: string[]): string => {
      return buildSearchQuery(queries);
    }
  }
  */
];
