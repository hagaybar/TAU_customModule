/**
 * Google Sheets Configuration
 * URL and settings for fetching shelf mappings from Google Sheets
 */
export const GOOGLE_SHEETS_CONFIG = {
  /**
   * Published CSV URL for shelf mappings
   * To get this URL:
   * 1. Open the Google Sheet
   * 2. Go to File → Share → Publish to web
   * 3. Select the sheet tab and change format to "Comma-separated values (.csv)"
   * 4. Click Publish and copy the generated URL
   */

  // take csv directly from google sheets (bypasses GitHub sync delay)
  shelfMappingsUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTE9A3GC_l4_kjAjy2c6Cc_woDgJCEctZSo0dY2zN-UMgziokuWLqZwSznQtaAHa5v7g7K_tkjMVhXY/pub?gid=1782446313&single=true&output=csv',
  
  // Alternative: take csv from github (synced from Google Sheets via GitHub Actions)
  // shelfMappingsUrl: "https://raw.githubusercontent.com/hagaybar/TAU_customModule/feature/cenlib_map_multi_locations/data/shelfMappings.csv",

  /** Cache duration in milliseconds (5 minutes default) */
  cacheDurationMs: 5 * 60 * 1000,
};
