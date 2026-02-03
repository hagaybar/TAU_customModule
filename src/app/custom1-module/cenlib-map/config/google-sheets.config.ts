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

  // take csv from github 
  shelfMappingsUrl: "https://raw.githubusercontent.com/hagaybar/TAU_customModule/feature/cenlib_map_multi_locations/data/shelfMappings.csv",

  // take csv directly from google sheets (not reliable)
  // shelfMappingsUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRfvZXxEogOfYQFuW8MfyvYx3usy3KRQjQz4e3IEBp0tPjtF940XGxomhhw7Q1-Qtcn6dj-XjcGEthE/pub?output=csv',

  /** Cache duration in milliseconds (5 minutes default) */
  cacheDurationMs: 5 * 60 * 1000,
};
