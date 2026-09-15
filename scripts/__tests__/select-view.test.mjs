import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  VIEW_FAMILY,
  readViewId,
  familyFor,
  managedAssetPaths,
  selectView,
  UnknownViewError,
} from '../select-view.mjs';

/**
 * A throwaway repo root with the two-family asset layout select-view.mjs expects.
 * `nde` deliberately owns a file `tma` does not, because the stale-file case is the
 * one that ships the wrong view's content and the one worth a test.
 */
function makeRoot(viewId) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'select-view-'));
  const write = (rel, body) => {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };

  write('build-settings.env', `# a comment\nINST_ID=972TAU_INST\nVIEW_ID=${viewId}\nASSET_BASE_URL=/x\n`);
  write('.gitignore', [
    '/node_modules',
    'src/assets/css/custom.css',
    'src/assets/js/custom.js',
    'src/assets/header-footer/footer_en.html',
  ].join('\n') + '\n');
  write('src/app/state/.keep', '');
  write('src/assets/views/nde/css/custom.css', 'body { color: nde; }\n');
  write('src/assets/views/nde/js/custom.js', '// nde\n');
  write('src/assets/views/nde/header-footer/footer_en.html', '<!-- nde en -->\n');
  write('src/assets/views/tma/css/custom.css', 'body { color: tma; }\n');
  write('src/assets/views/tma/js/custom.js', '// tma\n');
  return root;
}

let root;
afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('readViewId', () => {
  test('reads VIEW_ID and ignores comments and surrounding whitespace', () => {
    assert.equal(readViewId('# VIEW_ID=WRONG\nINST_ID=x\nVIEW_ID=  NDE_TEST  \n'), 'NDE_TEST');
  });

  test('returns null when VIEW_ID is absent', () => {
    assert.equal(readViewId('INST_ID=972TAU_INST\n'), null);
  });

  test('does not match a key that merely ends in VIEW_ID', () => {
    assert.equal(readViewId('PARENT_VIEW_ID=NDE\n'), null);
  });
});

describe('familyFor', () => {
  test('maps every declared view id', () => {
    assert.equal(familyFor('NDE'), 'nde');
    assert.equal(familyFor('NDE_TEST'), 'nde');
    assert.equal(familyFor('TMA_NDE'), 'tma');
    assert.equal(familyFor('TMA'), 'tma');
  });

  test('declares TMA alongside TMA_NDE so cutover is an env change only', () => {
    assert.equal(VIEW_FAMILY.TMA, VIEW_FAMILY.TMA_NDE);
  });

  test('throws on an undeclared view id rather than guessing a family', () => {
    assert.throws(() => familyFor('TMA2'), UnknownViewError);
    assert.throws(() => familyFor('TMA2'), /Known: NDE, NDE_TEST, TMA_NDE, TMA/);
  });

  test('throws on a missing view id', () => {
    assert.throws(() => familyFor(null), UnknownViewError);
  });
});

describe('managedAssetPaths', () => {
  test('is the union across families, not just the selected one', () => {
    root = makeRoot('TMA_NDE');
    assert.deepEqual(managedAssetPaths(root), [
      'css/custom.css',
      'header-footer/footer_en.html',
      'js/custom.js',
    ]);
  });
});

describe('selectView', () => {
  test('generates a re-export pointing at the selected family', () => {
    root = makeRoot('TMA_NDE');
    selectView({ root, log: () => {} });
    const generated = fs.readFileSync(path.join(root, 'src/app/state/view.generated.ts'), 'utf8');
    assert.match(generated, /export \{ map as selectorComponentMap \} from '\.\.\/views\/tma\/component-map';/);
    assert.doesNotMatch(generated, /views\/nde/);
  });

  test('copies the selected family over the fixed paths, byte for byte', () => {
    root = makeRoot('NDE');
    selectView({ root, log: () => {} });
    assert.equal(fs.readFileSync(path.join(root, 'src/assets/css/custom.css'), 'utf8'), 'body { color: nde; }\n');
    assert.equal(fs.readFileSync(path.join(root, 'src/assets/js/custom.js'), 'utf8'), '// nde\n');
  });

  test('leaves the generated copies read-only', () => {
    // Being gitignored keeps a stray edit out of the repo but says nothing at the moment
    // someone opens the file. The read-only bit is what makes the editor object then.
    root = makeRoot('NDE');
    selectView({ root, log: () => {} });
    const mode = fs.statSync(path.join(root, 'src/assets/css/custom.css')).mode & 0o777;
    assert.equal(mode & 0o222, 0, `expected no write bits, got ${mode.toString(8)}`);
  });

  test('re-runs over its own read-only output', () => {
    root = makeRoot('NDE');
    selectView({ root, log: () => {} });
    assert.doesNotThrow(() => selectView({ root, log: () => {} }));
  });

  test('removes a fixed-path file the selected family does not provide', () => {
    // The failure this prevents: build NDE, then build TMA, and TMA's package ships
    // NDE's footer because nothing cleared it.
    root = makeRoot('NDE');
    selectView({ root, log: () => {} });
    assert.ok(fs.existsSync(path.join(root, 'src/assets/header-footer/footer_en.html')));

    fs.writeFileSync(
      path.join(root, 'build-settings.env'),
      'INST_ID=972TAU_INST\nVIEW_ID=TMA_NDE\n',
    );
    selectView({ root, log: () => {} });
    assert.equal(fs.existsSync(path.join(root, 'src/assets/header-footer/footer_en.html')), false);
    assert.equal(fs.readFileSync(path.join(root, 'src/assets/css/custom.css'), 'utf8'), 'body { color: tma; }\n');
  });

  test('an undeclared view id changes nothing on disk', () => {
    root = makeRoot('NDE');
    selectView({ root, log: () => {} });
    const before = fs.readFileSync(path.join(root, 'src/app/state/view.generated.ts'), 'utf8');

    fs.writeFileSync(path.join(root, 'build-settings.env'), 'VIEW_ID=TMA2\n');
    assert.throws(() => selectView({ root, log: () => {} }), UnknownViewError);

    assert.equal(fs.readFileSync(path.join(root, 'src/app/state/view.generated.ts'), 'utf8'), before);
    assert.equal(fs.readFileSync(path.join(root, 'src/assets/css/custom.css'), 'utf8'), 'body { color: nde; }\n');
  });

  test('a managed path missing from .gitignore fails with the line to add', () => {
    // Without this, a new per-view asset lands as an untracked file, postbuild counts it,
    // and every package builds -dirty — loudly, but only after an attempted deploy.
    root = makeRoot('NDE');
    fs.writeFileSync(path.join(root, '.gitignore'), '/node_modules\n');
    assert.throws(() => selectView({ root, log: () => {} }), /src\/assets\/css\/custom\.css/);
  });

  test('skips the .gitignore check when there is no .gitignore', () => {
    root = makeRoot('NDE');
    fs.rmSync(path.join(root, '.gitignore'));
    assert.doesNotThrow(() => selectView({ root, log: () => {} }));
  });

  test('a declared family with no asset directory fails instead of shipping empty', () => {
    root = makeRoot('NDE');
    fs.rmSync(path.join(root, 'src/assets/views/nde'), { recursive: true });
    assert.throws(() => selectView({ root, log: () => {} }), /src\/assets\/views\/nde/);
  });
});
