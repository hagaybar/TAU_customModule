import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  comparePackages,
  isHostFetched,
  UntrustworthyComparison,
  MIN_PLAUSIBLE_FILES,
} from '../compare-packages.mjs';

/**
 * A package that looks like a real one: enough files to pass the plausibility check, and
 * a realistic spread of host-fetched assets, per-family sources and bundle chunks.
 */
function fakePackage(overrides = {}) {
  const files = new Map();
  const put = (rel, body) => files.set(rel, Buffer.from(body));

  put('index.html', '<html>base</html>');
  put('remoteEntry.js', 'remote-entry');
  put('main.aaaa.js', 'main-bundle');
  put('896.bbbb.js', 'lazy-chunk');
  put('assets/css/custom.css', 'body { color: nde; }');
  put('assets/css/custom.js', 'placeholder');
  put('assets/js/custom.js', '// nde');
  put('assets/header-footer/footer_en.html', '<!-- en -->');
  put('assets/header-footer/footer_he.html', '<!-- he -->');
  put('assets/homepage/homepage_en.html', '<!-- home en -->');
  put('assets/homepage/homepage_he.html', '<!-- home he -->');
  put('assets/views/nde/css/custom.css', 'body { color: nde; }');
  put('assets/views/tma/css/custom.css', 'body { color: tma; }');
  for (let i = 0; i < 12; i++) put(`assets/images/img-${i}.png`, `png-${i}`);

  for (const [rel, body] of Object.entries(overrides)) {
    if (body === null) files.delete(rel);
    else put(rel, body);
  }
  return files;
}

describe('isHostFetched', () => {
  test('is derived from location, so a file nobody listed is still covered', () => {
    assert.equal(isHostFetched('assets/css/custom.css'), true);
    assert.equal(isHostFetched('assets/header-footer/footer_he.html'), true);
    assert.equal(isHostFetched('assets/some/file/nobody/thought/of.json'), true);
  });

  test('excludes per-family sources, which ship in every package by design', () => {
    assert.equal(isHostFetched('assets/views/tma/css/custom.css'), false);
    assert.equal(isHostFetched('assets/views/README.md'), false);
  });

  test('excludes the compiled bundle', () => {
    assert.equal(isHostFetched('main.aaaa.js'), false);
    assert.equal(isHostFetched('index.html'), false);
  });
});

describe('comparePackages — it must notice', () => {
  // These are the four ways the per-view build can go wrong. If the checker cannot see
  // a planted example of each, it is decoration.

  test('a host-fetched file whose content changed', () => {
    const result = comparePackages(fakePackage(), fakePackage({ 'assets/css/custom.css': 'body { color: tma; }' }));
    assert.deepEqual(
      result.blocking.map((d) => [d.kind, d.path]),
      [['changed', 'assets/css/custom.css']],
    );
  });

  test('a host-fetched file that went missing', () => {
    const result = comparePackages(fakePackage(), fakePackage({ 'assets/header-footer/footer_he.html': null }));
    assert.deepEqual(
      result.blocking.map((d) => [d.kind, d.path]),
      [['removed', 'assets/header-footer/footer_he.html']],
    );
  });

  test('a stale host-fetched file that should not be there', () => {
    const result = comparePackages(fakePackage(), fakePackage({ 'assets/header-footer/footer_ar.html': '<!-- ar -->' }));
    assert.deepEqual(
      result.blocking.map((d) => [d.kind, d.path]),
      [['added', 'assets/header-footer/footer_ar.html']],
    );
  });

  test('a one-byte change, not just a big one', () => {
    const result = comparePackages(fakePackage(), fakePackage({ 'assets/js/custom.js': '// ndE' }));
    assert.equal(result.blocking.length, 1);
    assert.equal(result.blocking[0].path, 'assets/js/custom.js');
  });
});

describe('comparePackages — it must not cry wolf', () => {
  test('identical packages have nothing blocking and nothing informational', () => {
    const result = comparePackages(fakePackage(), fakePackage());
    assert.deepEqual(result.blocking, []);
    assert.deepEqual(result.informational, []);
  });

  test('a renamed bundle chunk is reported but does not block', () => {
    const candidate = fakePackage({ '896.bbbb.js': null, '29.cccc.js': 'lazy-chunk' });
    const result = comparePackages(fakePackage(), candidate);
    assert.deepEqual(result.blocking, []);
    assert.deepEqual(
      result.informational.map((d) => [d.kind, d.path]).sort(),
      [['added', '29.cccc.js'], ['removed', '896.bbbb.js']],
    );
  });

  test('per-family sources differing does not block — every package carries both', () => {
    const result = comparePackages(fakePackage(), fakePackage({ 'assets/views/tma/css/custom.css': 'body { color: teal; }' }));
    assert.deepEqual(result.blocking, []);
    assert.equal(result.informational.length, 1);
  });
});

describe('comparePackages — it must refuse to compare nothing', () => {
  // The real danger is not a wrong answer. It is a confident "no differences" from a
  // comparison that checked nothing: the first draft of this script got the path prefix
  // wrong, found none of the eight files it was looking for, and still passed.

  test('an empty package aborts instead of reporting no differences', () => {
    assert.throws(() => comparePackages(new Map(), fakePackage()), UntrustworthyComparison);
    assert.throws(() => comparePackages(fakePackage(), new Map()), UntrustworthyComparison);
  });

  test('two empty packages abort rather than agreeing with each other', () => {
    assert.throws(() => comparePackages(new Map(), new Map()), UntrustworthyComparison);
  });

  test('a package with no host-fetched files aborts even when it has plenty of files', () => {
    const bundleOnly = new Map();
    for (let i = 0; i < MIN_PLAUSIBLE_FILES + 5; i++) bundleOnly.set(`chunk-${i}.js`, Buffer.from(`c${i}`));
    assert.throws(() => comparePackages(bundleOnly, bundleOnly), /no files under assets\//);
  });

  test('the plausibility floor is on file count, and a near-empty package trips it', () => {
    const tiny = new Map([['assets/css/custom.css', Buffer.from('x')]]);
    assert.throws(() => comparePackages(tiny, tiny), /only 1 file/);
  });
});

describe('comparePackages — the report says what was actually checked', () => {
  test('reports how many host-fetched files it looked at, so "0 differences" is auditable', () => {
    const result = comparePackages(fakePackage(), fakePackage());
    assert.equal(result.hostFetchedChecked, 19);
    assert.equal(result.filesCompared, 25);
  });
});
