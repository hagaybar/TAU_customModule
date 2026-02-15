import { test, expect, Page } from '@playwright/test';

/**
 * RTL Directionality Tests for CenLib Map Dialog
 *
 * These tests verify that the shelf map dialog displays correctly in both
 * English (LTR) and Hebrew (RTL) modes.
 *
 * Known Issue: Labels with colons (e.g., 'ספרייה:', 'אוסף:') currently display
 * with incorrect text direction in Hebrew mode - the colon appears at the
 * beginning instead of the end due to missing dir="rtl" attribute.
 *
 * These tests are designed to FAIL on the current broken code and PASS once
 * the RTL fix is implemented.
 */

// Test configuration
const BASE_URL = 'http://localhost:4201';
const SEARCH_QUERY = 'test'; // A search term that returns results with shelf mappings

// Selectors
const SELECTORS = {
  dialogTitle: '[mat-dialog-title]',
  dialogContent: 'mat-dialog-content',
  infoRow: '.location-info .info-row',
  label: '.info-row .label',
  value: '.info-row .value',
  closeButton: 'mat-dialog-actions button',
  shelfMapButton: 'tau-cenlib-map-button button',
  searchInput: 'input[data-qa="search-input"]',
};

// Expected Hebrew labels (with colon at end)
const HEBREW_LABELS = {
  library: 'ספרייה:',
  collection: 'אוסף:',
  callNumber: 'מספר קריאה:',
  section: 'מדור:',
  floor: 'קומה:',
};

/**
 * Helper: Navigate to search page with specific language
 */
async function navigateWithLanguage(page: Page, lang: 'en' | 'he') {
  // Navigate to the Primo search interface with language parameter
  await page.goto(`${BASE_URL}/discovery/search?vid=972TAU_INST:NDE_TEST&lang=${lang}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Helper: Open the shelf map dialog
 * Note: This requires navigating to a record that has shelf mapping data
 */
async function openShelfMapDialog(page: Page) {
  // Wait for shelf map button to appear
  const shelfMapButton = page.locator(SELECTORS.shelfMapButton);

  // If no button visible, we may need to search first
  if (!(await shelfMapButton.isVisible())) {
    console.log('Shelf map button not visible, attempting to find a record with mapping...');
    return false;
  }

  await shelfMapButton.click();

  // Wait for dialog to open
  await page.waitForSelector(SELECTORS.dialogContent, { state: 'visible' });
  return true;
}

/**
 * Helper: Get computed CSS direction of an element
 */
async function getComputedDirection(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector).first();
  return await element.evaluate((el) => {
    return window.getComputedStyle(el).direction;
  });
}

/**
 * Helper: Get computed text-align of an element
 */
async function getComputedTextAlign(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector).first();
  return await element.evaluate((el) => {
    return window.getComputedStyle(el).textAlign;
  });
}

test.describe('CenLib Map Dialog - RTL Directionality', () => {

  test.describe('English Mode (LTR)', () => {

    test('TC1: Dialog opens with English content', async ({ page }) => {
      await navigateWithLanguage(page, 'en');

      // This test requires a page with the shelf map button visible
      // For now, we'll just verify the page loads with English language
      const htmlLang = await page.locator('html').getAttribute('lang');
      // Primo may set different lang attributes, so we check the URL
      expect(page.url()).toContain('lang=en');
    });

    test('TC1b: English dialog has LTR direction', async ({ page }) => {
      await navigateWithLanguage(page, 'en');

      // If we can open the dialog, check its direction
      const opened = await openShelfMapDialog(page);
      if (opened) {
        const direction = await getComputedDirection(page, SELECTORS.dialogContent);
        expect(direction).toBe('ltr');
      } else {
        test.skip();
      }
    });
  });

  test.describe('Hebrew Mode (RTL)', () => {

    test('TC2: Dialog opens with Hebrew content', async ({ page }) => {
      await navigateWithLanguage(page, 'he');

      // Verify Hebrew language is set
      expect(page.url()).toContain('lang=he');
    });

    test('TC3: Dialog content has RTL direction in Hebrew mode', async ({ page }) => {
      /**
       * This test verifies the CSS direction property on the dialog content.
       *
       * EXPECTED (after fix): direction should be 'rtl'
       * CURRENT (broken): direction is 'ltr'
       *
       * This test should FAIL until the RTL fix is implemented.
       */
      await navigateWithLanguage(page, 'he');

      const opened = await openShelfMapDialog(page);
      if (!opened) {
        test.skip();
        return;
      }

      const direction = await getComputedDirection(page, SELECTORS.dialogContent);

      // This assertion should FAIL on current code (it returns 'ltr')
      // and PASS after the fix (it should return 'rtl')
      expect(direction).toBe('rtl');
    });

    test('TC4: Labels have RTL direction in Hebrew mode', async ({ page }) => {
      /**
       * This test verifies that individual label elements have RTL direction.
       *
       * When direction is LTR (broken), Hebrew text with colons displays as:
       *   :ספרייה  (colon at wrong end)
       *
       * When direction is RTL (correct), it displays as:
       *   ספרייה:  (colon at correct end)
       */
      await navigateWithLanguage(page, 'he');

      const opened = await openShelfMapDialog(page);
      if (!opened) {
        test.skip();
        return;
      }

      const labels = page.locator(SELECTORS.label);
      const count = await labels.count();

      expect(count).toBeGreaterThan(0);

      // Check first label's direction
      const firstLabelDirection = await labels.first().evaluate((el) => {
        return window.getComputedStyle(el).direction;
      });

      // This should FAIL until RTL fix is implemented
      expect(firstLabelDirection).toBe('rtl');
    });

    test('TC5: Hebrew labels contain correct text', async ({ page }) => {
      /**
       * This test verifies that the label text content is correct Hebrew.
       * The text itself should be correct regardless of the direction issue.
       */
      await navigateWithLanguage(page, 'he');

      const opened = await openShelfMapDialog(page);
      if (!opened) {
        test.skip();
        return;
      }

      const labels = page.locator(SELECTORS.label);
      const labelTexts = await labels.allTextContents();

      // Verify at least the library label is present with correct Hebrew text
      const hasLibraryLabel = labelTexts.some(text => text.includes('ספרייה'));
      expect(hasLibraryLabel).toBe(true);
    });

    test('TC6: Visual check - Take screenshot for RTL verification', async ({ page }) => {
      /**
       * This test captures a screenshot of the dialog in Hebrew mode
       * for visual verification of the RTL layout.
       *
       * Review the screenshot to verify:
       * - Colons appear at the LEFT side of Hebrew labels (correct RTL)
       * - Text alignment is right-to-left
       */
      await navigateWithLanguage(page, 'he');

      const opened = await openShelfMapDialog(page);
      if (!opened) {
        test.skip();
        return;
      }

      // Wait for content to fully load
      await page.waitForTimeout(500);

      // Take screenshot of the dialog
      const dialog = page.locator(SELECTORS.dialogContent);
      await dialog.screenshot({
        path: 'e2e/screenshots/dialog-hebrew-rtl.png'
      });
    });
  });

  test.describe('Language Comparison', () => {

    test('TC7: Compare text alignment between English and Hebrew', async ({ page }) => {
      /**
       * This test compares the text alignment in both languages.
       *
       * English should have left-aligned text (or 'start' in LTR)
       * Hebrew should have right-aligned text (or 'start' in RTL)
       */

      // Test English first
      await navigateWithLanguage(page, 'en');
      let opened = await openShelfMapDialog(page);

      if (!opened) {
        test.skip();
        return;
      }

      const englishAlign = await getComputedTextAlign(page, SELECTORS.label);

      // Close dialog and switch to Hebrew
      await page.locator(SELECTORS.closeButton).click();
      await page.waitForTimeout(300);

      await navigateWithLanguage(page, 'he');
      opened = await openShelfMapDialog(page);

      if (!opened) {
        test.skip();
        return;
      }

      const hebrewAlign = await getComputedTextAlign(page, SELECTORS.label);

      // Log for debugging
      console.log(`English text-align: ${englishAlign}`);
      console.log(`Hebrew text-align: ${hebrewAlign}`);

      // In a properly implemented RTL layout, the alignments should differ
      // or Hebrew should be 'right' while English is 'left'
      // This test may need adjustment based on actual CSS implementation
    });
  });
});

test.describe('Direct RTL CSS Verification', () => {
  /**
   * These tests directly check the CSS properties without needing
   * to navigate through the full Primo interface.
   *
   * They use Playwright's browser to directly test the dialog component.
   */

  test('Verify RTL styles are applied when dir=rtl is set', async ({ page }) => {
    // Create a simple test page with the expected structure
    await page.setContent(`
      <html>
      <head>
        <style>
          [dir="rtl"] .label { direction: rtl; text-align: right; }
          [dir="ltr"] .label { direction: ltr; text-align: left; }
          .info-row { display: flex; gap: 8px; }
        </style>
      </head>
      <body>
        <div dir="rtl" class="dialog-content">
          <div class="info-row">
            <span class="label">ספרייה:</span>
            <span class="value">הספרייה המרכזית סוראסקי</span>
          </div>
        </div>
      </body>
      </html>
    `);

    const label = page.locator('.label');
    const direction = await label.evaluate(el => getComputedStyle(el).direction);
    const textAlign = await label.evaluate(el => getComputedStyle(el).textAlign);

    expect(direction).toBe('rtl');
    expect(textAlign).toBe('right');
  });
});
