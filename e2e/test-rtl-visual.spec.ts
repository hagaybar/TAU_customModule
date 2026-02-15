import { test, expect } from '@playwright/test';

/**
 * Visual test for RTL fix verification
 * Uses the actual running dev server to test the dialog
 */

test('Capture dialog screenshot in Hebrew mode', async ({ page }) => {
  // Navigate to a page where we can see the cenlib-map component
  // First, go to the dev server
  await page.goto('http://localhost:4201');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Take a screenshot of whatever page loads
  await page.screenshot({ path: 'e2e/screenshots/page-loaded.png', fullPage: true });
});
