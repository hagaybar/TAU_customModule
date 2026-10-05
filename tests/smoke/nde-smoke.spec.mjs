// NDE smoke test — does every mapped component still mount on a deployed view, and do the
// key custom.css selectors still match the host's markup? Written for issue #75 (Primo NDE
// moves to Angular 20 in the February 2027 release); useful after any host release.
//
// Read-only against the target: page loads and one dialog open. Mixpanel is blocked, so the
// Shelf Map click is never counted as a patron's.
//
// What each check depends on is inventoried in docs/reference/nde-dependency-surface.md.
// Run: npm run test:smoke   (guide: tests/smoke/README.md)
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const VID = process.env.SMOKE_VID || '972TAU_INST:NDE';
const PACKAGE = VID.replace(':', '-'); // what the boot banner names, e.g. 972TAU_INST-NDE
// A Sourasky Central Library book whose call number is in the Shelf Map's mapping.csv.
// If it is withdrawn or moved, pick any Central Library print book that shows the button.
const SHELF_DOCID = process.env.SMOKE_SHELF_DOCID || 'alma990020446760204146';

const HIDDEN_COLLECTIONS = [
  ...readFileSync(
    new URL('../../src/app/custom1-module/collection-discovery-filter/hidden-collections.config.ts', import.meta.url),
    'utf8',
  ).matchAll(/'(\d{10,})'/g),
].map((m) => m[1]);

const q = (path, params = {}) =>
  `${path}?${new URLSearchParams({ vid: VID, lang: 'en', ...params })}`;
// The tab and scope must be ones the view defines. An unknown tab still returns results, but
// the host then renders the filter side panel empty (console: "reading 'facetview'"), and the
// filter-assist panel has nowhere to mount — a broken URL that looks like a broken host.
const TAB = process.env.SMOKE_TAB || 'TAU';
const SCOPE = process.env.SMOKE_SCOPE || 'TAU';
const SEARCH = q('/nde/search', { query: 'any,contains,history', tab: TAB, search_scope: SCOPE });
const NO_RESULTS = q('/nde/search', { query: 'any,contains,qzxwvkjq plmnbt', tab: TAB, search_scope: SCOPE });
const FULL_RECORD = q('/nde/fulldisplay', { docid: SHELF_DOCID, context: 'L', tab: TAB, search_scope: SCOPE });
const COLLECTIONS = q('/nde/collectionDiscovery');
const HOME = q('/nde/home');

// The host defines each slot as '<slot>-from-remote-<n>', never the bare slot name.
const slot = (page, name) =>
  page.locator([0, 1, 2, 3].map((n) => `${name}-from-remote-${n}`).join(', '));

// Errors whose source is our package. The host logs plenty of its own; those are not ours to fail on.
const OURS = /\/nde\/custom\/|localhost:4201/;
// Files the host probes for under our package path whether or not a package ships them; their
// 404 is the host's normal "not customised" answer, not a missing file of ours.
const HOST_PROBES = /\/CENTRAL_CODE\.txt$/;

test.beforeEach(async ({ page }, testInfo) => {
  await page.route(/mixpanel\.com/, (r) => r.abort());
  // Show the announcement banner even if a previous run dismissed it.
  await page.addInitScript(() => {
    try { localStorage.removeItem('tauAnnouncementDismissed:v2'); } catch {}
  });
  const ours = [];
  page.on('pageerror', (e) => { if (OURS.test(e.stack || '')) ours.push(`pageerror: ${e.message}`); });
  page.on('console', (m) => {
    const url = m.location().url || '';
    if (m.type() === 'error' && (OURS.test(url) || OURS.test(m.text())) && !HOST_PROBES.test(url))
      ours.push(`console.error: ${m.text().slice(0, 300)} @ ${m.location().url}`);
  });
  testInfo.ourErrors = ours;
});

test.afterEach(async ({}, testInfo) => {
  expect(testInfo.ourErrors, 'errors raised by the custom module').toEqual([]);
});

test('boot: module loads, names the expected package, mounts the header banner', async ({ page }, testInfo) => {
  const boot = page.waitForEvent('console', {
    predicate: (m) => m.text().startsWith('[TAU] custom module'),
    timeout: 45_000,
  });
  await page.goto(SEARCH);
  expect((await boot).text()).toContain(`[TAU] custom module · ${PACKAGE} ·`);

  const banner = slot(page, 'nde-header-before').locator('.tau-announcement');
  await expect(banner).toBeVisible();
  await expect(banner.locator('.tau-announcement__text')).not.toBeEmpty();

  // Which Angular rendered the host and which rendered our components. They differ today
  // (host 19.1.3, ours 18.2.x: the share scope falls back to our bundled copy — doc §1).
  // Recorded, not asserted: the point is to see it change when either side upgrades.
  const ours = await slot(page, 'nde-header-before').getAttribute('ng-version');
  const host = await page.locator('nde-app-root').getAttribute('ng-version');
  const line = `host ${host ?? 'absent'} · ours ${ours ?? 'absent'}`;
  testInfo.annotations.push({ type: 'ng-version', description: line });
  console.log(`ng-version: ${line}`);
});

test('no-results page: external search links', async ({ page }) => {
  await page.goto(NO_RESULTS);
  const panel = slot(page, 'nde-search-no-results-bottom').locator('section.tau-external-search');
  await expect(panel).toBeVisible();
  await expect(panel.locator('a.tau-external-search__link')).toHaveCount(3);
});

test('full record: Shelf Map button opens the map', async ({ page }) => {
  await page.goto(FULL_RECORD);
  const button = slot(page, 'nde-location-top').locator('button.cenlib-map-button');
  await expect(button).toBeVisible();
  await expect(button).toContainText('Shelf Map');
  await button.click();
  await expect(page.locator('.cdk-overlay-container .cenlib-map-dialog-panel')).toBeVisible();
});

test('collection discovery: configured collections are hidden', async ({ page }) => {
  expect(HIDDEN_COLLECTIONS.length, 'IDs parsed from hidden-collections.config.ts').toBeGreaterThan(0);
  await page.goto(COLLECTIONS);
  await expect(slot(page, 'nde-collection-discovery-gallery-top')).toBeAttached();
  const cards = page.locator('nde-collection-discovery-gallery-collection');
  await expect(cards.first()).toBeVisible();
  // The filter marks what it hides; at least one marked card proves it ran against real markup.
  await expect(page.locator('[data-tau-hidden-collection]').first()).toBeAttached();
  for (const id of HIDDEN_COLLECTIONS) {
    const card = cards.filter({ has: page.locator(`a[href*="collectionId=${id}"]`) });
    for (const c of await card.all()) await expect(c).toBeHidden();
  }
});

test('search results: filter-assist panel in the filter side panel', async ({ page }) => {
  await page.goto(SEARCH);
  const panel = slot(page, 'nde-filters-group-before').locator('section.external-search-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('a.external-search-panel__link')).toHaveCount(3);
});

// custom.css: one representative host selector per area, on the page where it applies.
// A zero count means the host markup changed and the rule silently stopped applying.
// Inventory of every selector: docs/reference/nde-dependency-surface.md §4.2.
const CSS_CHECKS = [
  // Not the `:has(nde-landing-page-config)` boot-flash rule: it matches only for the moment
  // before the host moves the top bar into the landing layout, so it cannot be checked after load.
  { page: HOME, selectors: [
    '.landing-search-background-image',
    '.landing-search-background-img',
    '.custom-search-bar-container nde-top-bar',
  ] },
  { page: SEARCH, selectors: [
    '.search-container:not(:has(nde-landing-page-config)) > nde-top-bar',
    '.advanced-search-button',
    'nde-record-type span.record-type',
  ] },
  { page: FULL_RECORD, selectors: [
    'nde-locations-container [data-qa="location-call-number"]',
    '.getit-library-title.mat-title-medium',
  ] },
];

for (const { page: url, selectors } of CSS_CHECKS) {
  test(`custom.css selectors match host markup: ${url.split('?')[0]}`, async ({ page }) => {
    await page.goto(url);
    await expect(slot(page, 'nde-header-before')).toBeAttached();
    // Our custom.css is loaded at all.
    await expect
      .poll(() => page.evaluate(() =>
        [...document.styleSheets].some((s) => /assets\/css\/custom\.css/.test(s.href || ''))))
      .toBe(true);
    for (const sel of selectors) {
      await expect(page.locator(sel).first(), sel).toBeAttached();
    }
  });
}
