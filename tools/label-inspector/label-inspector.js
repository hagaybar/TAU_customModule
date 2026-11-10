// TAU Label Inspector (issue #54): point at any text in Primo NDE and see the label code(s)
// that produce it, with the current value, without reloading or changing the page.
//
// Maintainer tool. It lives outside src/ and never ships in the custom package.
// Edit this file, then run `node tools/label-inspector/build.mjs` to regenerate bookmarklet.txt.
// Only whole-line `//` comments are allowed here: the build strips them.
//
// Toggle: run once to start, run again (or press Escape) to stop and remove everything.
// Console use while active: __tauLabelInspector.lookup(element) returns the ranked candidates.
(function () {
  'use strict';
  var KEY = '__tauLabelInspector';
  if (window[KEY]) { window[KEY].stop(); return; }

  var ATTRS = ['aria-label', 'title', 'placeholder', 'alt', 'mattooltip', 'ng-reflect-message'];
  var ANCESTOR_LEVELS = 4;
  // Explicit namespace hints: element inside <selector> ranks codes starting with <prefix> first.
  var HINTS = [
    ['ul.main-menu-list, nde-main-menu, [class*="main-menu"]', 'mainmenu.'],
    ['nde-landing-quick-links, [class*="quick-links"]', 'nde.landing.links.'],
    ['nde-search-bar, nde-search-box, [class*="search-bar"]', 'nui.search.'],
    ['nde-facets, [class*="facet"]', 'facets.'],
    ['nde-full-display, [class*="full-display"]', 'fulldisplay.']
  ];

  var params = new URLSearchParams(location.search);
  var vid = params.get('vid');
  var lang = params.get('lang') || document.documentElement.lang || 'he';

  var state = { index: null, patterns: [], payload: null, error: null, hovered: null };
  var host = document.createElement('div');
  host.setAttribute('data-tau-label-inspector', '');
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>' +
    '.box{position:fixed;pointer-events:none;outline:2px solid #e8590c;background:rgba(232,89,12,.08);}' +
    '.panel{position:fixed;bottom:12px;left:12px;width:440px;max-height:60vh;overflow:auto;pointer-events:auto;' +
    'background:#fff;color:#111;font:13px/1.4 system-ui,sans-serif;border:1px solid #888;border-radius:8px;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.25);padding:10px;direction:ltr;text-align:left;}' +
    '.head{display:flex;gap:8px;align-items:center;margin-bottom:6px;font-weight:600;}' +
    '.head span{flex:1}.head button,.c button{font:inherit;cursor:pointer;}' +
    'input{width:100%;box-sizing:border-box;font:inherit;padding:3px 6px;margin-bottom:6px;}' +
    '.c{border-top:1px solid #ddd;padding:6px 0;}.code{font-family:ui-monospace,monospace;font-weight:600;word-break:break-all;}' +
    '.val{font-family:ui-monospace,monospace;background:#f3f3f3;padding:2px 4px;margin:3px 0;white-space:pre-wrap;word-break:break-word;}' +
    '.meta,.note{color:#555;font-size:12px;}.err{color:#b00020;font-weight:600;}.first .code{color:#0b5394;}' +
    '</style>' +
    '<div class="box" hidden></div>' +
    '<div class="panel"><div class="head"><span>TAU Label Inspector</span><button data-act="close">Close (Esc)</button></div>' +
    '<input type="search" placeholder="Search codes or values…">' +
    '<div class="body"><div class="meta">Loading labels…</div></div></div>';
  var box = root.querySelector('.box');
  var panel = root.querySelector('.panel');
  var body = root.querySelector('.body');
  var search = root.querySelector('input');

  function normalise(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function buildIndex(payload) {
    var index = new Map();
    var patterns = [];
    Object.keys(payload).forEach(function (code) {
      var raw = payload[code];
      if (typeof raw !== 'string') return;
      var norm = normalise(raw);
      if (!norm) return;
      if (!index.has(norm)) index.set(norm, []);
      index.get(norm).push(code);
      // Values with {{placeholders}} match any filled-in text, e.g. "{{count}} results".
      // A value that is only placeholders ("{{idx_0}}") would match everything: skip it.
      if (/\{\{[^}]*\}\}/.test(norm) && (norm.replace(/\{\{[^}]*\}\}/g, '').match(/\p{L}/gu) || []).length >= 3) {
        var re = '^' + norm.split(/\{\{[^}]*\}\}/).map(escapeRe).join('.+?') + '$';
        try { patterns.push({ re: new RegExp(re), code: code }); } catch (e) { /* skip */ }
      }
    });
    state.index = index;
    state.patterns = patterns;
  }

  function ownText(el) {
    var t = '';
    el.childNodes.forEach(function (n) { if (n.nodeType === 3) t += n.nodeValue; });
    return t;
  }

  // Strings to try for one element, best source first.
  function probes(el) {
    var out = [];
    var level = 0;
    for (var cur = el; cur && cur.nodeType === 1 && level <= ANCESTOR_LEVELS; cur = cur.parentElement, level++) {
      var where = level === 0 ? '' : ' (ancestor +' + level + ')';
      out.push({ text: cur.textContent, source: 'text' + where, weight: 100 - level * 15 });
      if (level === 0) out.push({ text: ownText(cur), source: 'own text', weight: 95 });
      ATTRS.forEach(function (a) {
        if (cur.hasAttribute(a)) out.push({ text: cur.getAttribute(a), source: a + where, weight: 90 - level * 15 });
      });
    }
    return out;
  }

  function hintScore(el, code) {
    var score = 0;
    HINTS.forEach(function (h) {
      if (code.indexOf(h[1]) === 0 && el.closest(h[0])) score += 50;
    });
    // Generic proximity: words from nde-* ancestor tags that also appear in the code.
    var lc = code.toLowerCase();
    for (var cur = el; cur; cur = cur.parentElement) {
      var tag = cur.tagName.toLowerCase();
      if (tag.indexOf('nde-') !== 0) continue;
      tag.slice(4).split('-').forEach(function (w) { if (w.length > 3 && lc.indexOf(w) !== -1) score += 5; });
    }
    return score;
  }

  function lookup(el) {
    if (!state.index) return [];
    var found = new Map();
    probes(el).forEach(function (p) {
      var norm = normalise(p.text);
      if (!norm || norm.length > 300) return;
      var codes = (state.index.get(norm) || []).map(function (c) { return { code: c, bonus: 0 }; });
      state.patterns.forEach(function (pt) { if (pt.re.test(norm)) codes.push({ code: pt.code, bonus: -10 }); });
      codes.forEach(function (c) {
        var score = p.weight + c.bonus + hintScore(el, c.code);
        var prev = found.get(c.code);
        if (!prev || prev.score < score) {
          found.set(c.code, { code: c.code, value: state.payload[c.code], source: p.source, matched: p.text.trim(), score: score });
        }
      });
    });
    return Array.from(found.values()).sort(function (a, b) { return b.score - a.score || a.code.localeCompare(b.code); });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderCandidates(list, heading) {
    body.textContent = '';
    if (state.error) { body.appendChild(el('div', 'err', state.error)); return; }
    body.appendChild(el('div', 'meta', heading));
    if (!list.length) { body.appendChild(el('div', 'meta', 'No label code matches.')); return; }
    list.forEach(function (c, i) {
      var row = el('div', 'c' + (i === 0 ? ' first' : ''));
      var top = el('div');
      top.appendChild(el('span', 'code', c.code + ' '));
      var copy = el('button', null, 'Copy');
      copy.addEventListener('click', function () {
        navigator.clipboard.writeText(c.code).then(function () { copy.textContent = 'Copied'; }, function () { copy.textContent = 'Copy failed'; });
      });
      top.appendChild(copy);
      row.appendChild(top);
      row.appendChild(el('div', 'val', c.value));
      if (c.source) row.appendChild(el('div', 'meta', 'matched via ' + c.source));
      body.appendChild(row);
    });
    body.appendChild(el('div', 'note',
      'The code is the resolved one. In Alma the row to edit may be this code or a view-scoped override ' +
      '(' + vid + '.' + '<code>), which is why views can differ.'));
  }

  function inside(target) { return target === host || (target && host.contains(target)); }

  function onMove(e) {
    var t = e.target;
    if (inside(t) || !(t instanceof Element)) { box.hidden = true; return; }
    state.hovered = t;
    var r = t.getBoundingClientRect();
    box.hidden = false;
    box.style.cssText = 'top:' + r.top + 'px;left:' + r.left + 'px;width:' + r.width + 'px;height:' + r.height + 'px;';
  }

  function onClick(e) {
    if (e.composedPath().indexOf(host) !== -1) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    search.value = '';
    var label = t.tagName.toLowerCase() + ' “' + normalise(t.textContent || t.getAttribute('aria-label') || '').slice(0, 60) + '”';
    renderCandidates(lookup(t), 'Picked ' + label);
  }

  // Swallow the rest of the click sequence so links and buttons do not fire while picking.
  function swallow(e) {
    if (e.composedPath().indexOf(host) !== -1) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function onKey(e) { if (e.key === 'Escape') stop(); }

  function onSearch() {
    var q = normalise(search.value);
    if (!q || !state.payload) { renderCandidates([], 'Hover to highlight, click to look up.'); return; }
    var hits = [];
    Object.keys(state.payload).some(function (code) {
      var v = state.payload[code];
      if (typeof v === 'string' && (code.toLowerCase().indexOf(q) !== -1 || normalise(v).indexOf(q) !== -1)) {
        hits.push({ code: code, value: v });
      }
      return hits.length >= 50;
    });
    renderCandidates(hits, 'Search: ' + hits.length + (hits.length >= 50 ? '+' : '') + ' match(es)');
  }

  var listeners = [
    ['mousemove', onMove], ['click', onClick], ['mousedown', swallow], ['mouseup', swallow],
    ['pointerdown', swallow], ['pointerup', swallow], ['keydown', onKey]
  ];

  function stop() {
    listeners.forEach(function (l) { window.removeEventListener(l[0], l[1], true); });
    host.remove();
    delete window[KEY];
  }

  panel.querySelector('[data-act="close"]').addEventListener('click', stop);
  search.addEventListener('input', onSearch);
  listeners.forEach(function (l) { window.addEventListener(l[0], l[1], true); });
  document.documentElement.appendChild(host);
  window[KEY] = { stop: stop, lookup: lookup, state: state };

  if (!vid) {
    state.error = 'No vid= in the URL. Open a Primo NDE page (…/nde/…?vid=INST:VIEW) and try again.';
    renderCandidates([], '');
    return;
  }
  var url = '/primaws/rest/pub/translations/' + encodeURIComponent(vid) + '?lang=' + encodeURIComponent(lang) + '&vid=' + encodeURIComponent(vid);
  fetch(url, { credentials: 'same-origin' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.statusText);
      return r.json();
    })
    .then(function (payload) {
      if (!payload || typeof payload !== 'object') throw new Error('unexpected response shape');
      state.payload = payload;
      buildIndex(payload);
      renderCandidates([], vid + ' · ' + lang + ' · ' + state.index.size + ' distinct labels. Hover to highlight, click to look up.');
    })
    .catch(function (err) {
      state.error = 'Could not load labels from ' + url + ': ' + err.message;
      renderCandidates([], '');
    });
})();
