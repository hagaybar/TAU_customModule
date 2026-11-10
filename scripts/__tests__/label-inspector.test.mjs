// The Label Inspector bookmarklet (issue #54) is generated from its source; keep them in step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildBookmarklet, SOURCE, OUTPUT } from '../../tools/label-inspector/build.mjs';

test('bookmarklet.txt matches label-inspector.js (run node tools/label-inspector/build.mjs)', () => {
  assert.equal(readFileSync(OUTPUT, 'utf8'), buildBookmarklet(readFileSync(SOURCE, 'utf8')));
});

test('the built bookmarklet is valid JavaScript', () => {
  const built = readFileSync(OUTPUT, 'utf8').trim();
  assert.ok(built.startsWith('javascript:'));
  assert.doesNotThrow(() => new vm.Script(decodeURIComponent(built.slice('javascript:'.length))));
});

test('build strips whole-line comments but keeps code lines', () => {
  const out = decodeURIComponent(buildBookmarklet('// gone\n  var a = 1; // kept\n\nvar b = 2;\n').slice(11));
  assert.equal(out.trim(), 'var a = 1; // kept\nvar b = 2;');
});
