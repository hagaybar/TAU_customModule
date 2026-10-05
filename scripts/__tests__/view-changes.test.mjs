import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { classify, classifyAll, familyPaths, SHARED_PATHS } from '../view-changes.mjs';
import { VIEW_FAMILY, CrossFamilyEditsError } from '../select-view.mjs';

const FAMILIES = Object.values(VIEW_FAMILY);

describe('familyPaths', () => {
  test('a family owns its asset folder and its component folder', () => {
    assert.deepEqual(familyPaths('tma'), ['src/assets/views/tma/', 'src/app/views/tma/']);
  });
});

describe('classify', () => {
  test('files in the declared family are current work', () => {
    assert.equal(classify('src/assets/views/tma/css/custom.css', 'tma', FAMILIES), 'current');
    assert.equal(classify('src/app/views/tma/component-map.ts', 'tma', FAMILIES), 'current');
  });

  test('files in any other family are the case this exists to catch', () => {
    assert.equal(classify('src/assets/views/nde/css/custom.css', 'tma', FAMILIES), 'other');
    assert.equal(classify('src/app/views/nde/component-map.ts', 'tma', FAMILIES), 'other');
    assert.equal(classify('src/assets/views/tma/css/custom.css', 'nde', FAMILIES), 'other');
  });

  test('shared code is called shared, not foreign — it changes every view at once', () => {
    for (const f of ['src/app/custom1-module/cenlib-map/x.ts', 'src/styles.scss',
                     'src/assets/images/library-logo.png', 'angular.json', 'postbuild.js']) {
      assert.equal(classify(f, 'tma', FAMILIES), 'shared', f);
    }
  });

  test('everything else is unrelated', () => {
    assert.equal(classify('README.md', 'tma', FAMILIES), 'unrelated');
    assert.equal(classify('docs/assets/TMA/README.md', 'tma', FAMILIES), 'unrelated');
  });

  test('every shared path is a prefix, so a file directly inside it matches', () => {
    for (const p of SHARED_PATHS) {
      const probe = p.endsWith('/') ? `${p}file.txt` : p;
      assert.equal(classify(probe, 'nde', FAMILIES), 'shared', probe);
    }
  });
});

describe('classifyAll', () => {
  test('buckets a mixed changeset', () => {
    const out = classifyAll([
      'src/assets/views/tma/css/custom.css',
      'src/assets/views/nde/css/custom.css',
      'src/styles.scss',
      'README.md',
    ], 'tma', FAMILIES);
    assert.deepEqual(out.current, ['src/assets/views/tma/css/custom.css']);
    assert.deepEqual(out.other, ['src/assets/views/nde/css/custom.css']);
    assert.deepEqual(out.shared, ['src/styles.scss']);
    assert.deepEqual(out.unrelated, ['README.md']);
  });

  test('two views in one family are not "other" to each other', () => {
    // NDE and NDE_TEST both map to nde, so work for one is work for the other.
    assert.equal(VIEW_FAMILY.NDE, VIEW_FAMILY.NDE_TEST);
    const out = classifyAll(['src/assets/views/nde/css/custom.css'], 'nde', FAMILIES);
    assert.deepEqual(out.other, []);
    assert.equal(out.current.length, 1);
  });
});

describe('CrossFamilyEditsError', () => {
  test('names the files and both ways out', () => {
    const err = new CrossFamilyEditsError('tma', ['src/assets/views/nde/css/custom.css']);
    assert.match(err.message, /directed at the "tma" family/);
    assert.match(err.message, /src\/assets\/views\/nde\/css\/custom\.css/);
    assert.match(err.message, /npm run view:use/);
    assert.match(err.message, /TAU_ALLOW_CROSS_FAMILY=1/);
  });
});
