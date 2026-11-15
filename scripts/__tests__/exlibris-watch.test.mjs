import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractArticle,
  guidanceLinks,
  lineDiff,
  parseState,
  encodeState,
  buildReport,
  hash,
} from '../exlibris-watch.mjs';

const page = (body) => `<html><head><script>var x = "Angular";</script><style>.a{}</style></head><body>
<nav><ul><li>Changes That May Impact Customizations</li><li>Upgrade to Angular 20</li></ul></nav>
<div class="article">
<h2>Changes That May Impact Customizations</h2>
<h3>August 2026 Release</h3><p>Main Menu Layout Changes</p>
<h3>February&nbsp;2027 Release</h3><p>Upgrade to Angular 20 &amp; more</p>
${body}
<p>View article in the Exlibris Knowledge Center</p>
</div><footer>© Copyright 2026</footer></body></html>`;

const upstream = { main: 'a'.repeat(40), branches: { 'Angular-20-experimental': 'b'.repeat(40) } };
const now = new Date('2026-11-22T06:00:00Z');

describe('extractArticle', () => {
  test('keeps the article, drops scripts, the table of contents and the footer', () => {
    const lines = extractArticle(page('<p>Guidance comes in November.</p>'));
    assert.equal(lines[0], 'Changes That May Impact Customizations');
    assert.ok(lines.includes('February 2027 Release'));
    assert.ok(lines.includes('Upgrade to Angular 20 & more'));
    assert.ok(lines.includes('Guidance comes in November.'));
    assert.ok(!lines.some((l) => l.includes('Copyright') || l.includes('var x')));
    assert.equal(lines.filter((l) => l === 'Changes That May Impact Customizations').length, 1);
  });

  test('fails loudly when the page layout changes instead of reporting "no change"', () => {
    assert.throws(() => extractArticle('<html><body>Sign in</body></html>'), /layout changed/);
  });
});

test('guidanceLinks finds Angular and test-environment links only', () => {
  const html =
    '<a href="#Upgrade_to_Angular_20">Upgrade to Angular 20</a><a href="/a">Angular 20 guidance</a>' +
    '<a href="/b">Privacy</a><a href="/c">Test environment access</a>';
  assert.deepEqual(guidanceLinks(html), ['/a', '/c']);
});

test('lineDiff reports added and removed lines', () => {
  assert.deepEqual(lineDiff(['a', 'b'], ['b', 'c']), { added: ['c'], removed: ['a'] });
});

test('state round-trips through the hidden marker', () => {
  const s = { pageHash: 'x', branches: { y: 'z' } };
  assert.deepEqual(parseState(`report\n${encodeState(s)}`), s);
  assert.equal(parseState('a plain comment'), null);
});

describe('buildReport', () => {
  const lines = ['Changes That May Impact Customizations', 'Old text'];
  const p1 = { lines, hash: hash(lines.join('\n')), guidanceLinks: [] };
  const first = buildReport({ now, prev: null, page: p1, upstream });

  test('first run records a baseline', () => {
    assert.match(first.body, /22\.11\.26: baseline recorded/);
    assert.equal(first.changed, false);
  });

  test('an identical second run reports no change', () => {
    const r = buildReport({ now, prev: parseState(first.body), page: p1, upstream });
    assert.match(r.body, /: no change/);
    assert.equal(r.changed, false);
  });

  test('a page edit and a new upstream branch are reported with a diff', () => {
    const l2 = ['Changes That May Impact Customizations', 'New guidance published'];
    const p2 = { lines: l2, hash: hash(l2.join('\n')), guidanceLinks: ['/guide'] };
    const up2 = { main: 'c'.repeat(40), branches: { ...upstream.branches, 'Angular-20': 'd'.repeat(40) } };
    const r = buildReport({ now, prev: parseState(first.body), page: p2, upstream: up2 });
    assert.equal(r.changed, true);
    assert.match(r.body, /\*\*CHANGED\*\* \(Ex Libris page, upstream `main`, upstream Angular branches\)/);
    assert.match(r.body, /\+ New guidance published/);
    assert.match(r.body, /- Old text/);
    assert.match(r.body, /`Angular-20` `ddddddd` \*\*new\*\*/);
    assert.match(r.body, /<\/guide>/);
  });
});
