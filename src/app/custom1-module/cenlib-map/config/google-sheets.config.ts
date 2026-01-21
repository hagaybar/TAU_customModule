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
  shelfMappingsUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSc5SfVr7h5iBLW96URF6ZgTr_xpmlda11wUYj_LRNVgADyifOD-gBPTyinaYdGe8nahQ4Z4PrnPq3t/pub?output=csv',

  /** Cache duration in milliseconds (5 minutes default) */
  cacheDurationMs: 5 * 60 * 1000,
};
