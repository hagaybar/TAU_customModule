/* ---------------------------------------------------------------------------
 * TAU NDE search box — live-page test snippet
 *
 * Paste this whole block into the browser DevTools console on a live library
 * page (e.g. https://cenlib.tau.ac.il/). It hides the existing Drupal search
 * block and puts the new NDE box in its place, with a live preview of the
 * exact URL the form will emit.
 *
 * Chrome blocks the first console paste — type "allow pasting" + Enter once.
 *
 * Nothing is saved and nothing is sent anywhere. To undo without reloading:
 *     __ndeBox.restore()
 * --------------------------------------------------------------------------- */
(function () {
  'use strict';

  // ---- settings -----------------------------------------------------------
  var VID        = '972TAU_INST:NDE';   // '972TAU_INST:NDE_TEST' to test the test view
  var TAB        = 'TAU';
  var SCOPE      = 'TAU';
  var ACTION     = 'https://tau.primo.exlibrisgroup.com/nde/search';
  var BLOCK_ID   = 'block-libraries-search-block-libraries-search-block';
  var LANG       = (document.documentElement.lang || 'he').slice(0, 2) === 'en' ? 'en' : 'he';
  // -------------------------------------------------------------------------

  var block = document.getElementById(BLOCK_ID);
  if (!block) {
    console.error('[nde-box] block #' + BLOCK_ID + ' not found on this page.');
    return;
  }

  // Re-running the snippet replaces the previous injection.
  if (window.__ndeBox && window.__ndeBox.restore) window.__ndeBox.restore();

  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'style') n.style.cssText = props[k];
      else if (k in n) n[k] = props[k];
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  function hidden(name, value) {
    return el('input', { type: 'hidden', name: name, value: value });
  }

  var STRINGS = {
    he: { label: 'חיפוש בקטלוג', ph: 'חיפוש ספרים, מאמרים ומקורות נוספים', btn: 'חיפוש' },
    en: { label: 'Search the catalogue', ph: 'Search books, articles and more', btn: 'Search' }
  }[LANG];

  var input = el('input', {
    type: 'text', name: 'query', dir: 'auto', autocomplete: 'off', required: true,
    placeholder: STRINGS.ph, 'aria-label': STRINGS.label,
    style: 'flex:1 1 16rem;min-width:12rem;padding:.6rem .7rem;font:inherit;' +
           'border:1px solid #bbb;border-radius:6px;background:#fff;color:#000;'
  });

  var button = el('button', {
    type: 'submit', textContent: STRINGS.btn,
    style: 'padding:.6rem 1.2rem;font:inherit;font-weight:600;border:0;' +
           'border-radius:6px;background:#3f608a;color:#fff;cursor:pointer;'
  });

  var preview = el('div', {
    dir: 'ltr',
    style: 'margin-block-start:.6rem;padding:.5rem .6rem;background:#f2f1ed;' +
           'border:1px solid #ddd;border-radius:6px;color:#444;word-break:break-all;' +
           'font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;text-align:left;'
  });

  var form = el('form', {
    action: ACTION, method: 'get', target: '_blank', acceptCharset: 'UTF-8',
    role: 'search',
    style: 'display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;width:100%;'
  }, [
    hidden('vid', VID),
    hidden('tab', TAB),
    hidden('search_scope', SCOPE),
    hidden('lang', LANG),
    input,
    button
  ]);

  var banner = el('div', {
    textContent: '▲ NDE test box (console-injected) — __ndeBox.restore() to undo',
    style: 'font:600 11px/1.6 system-ui,sans-serif;color:#a33a2f;margin-block-end:.4rem;'
  });

  var wrap = el('div', {
    style: 'padding:.75rem;border:2px dashed #a33a2f;border-radius:8px;background:#fff;'
  }, [banner, form, preview]);

  function url() {
    return ACTION +
      '?query=' + encodeURIComponent(input.value) +
      '&tab=' + encodeURIComponent(TAB) +
      '&search_scope=' + encodeURIComponent(SCOPE) +
      '&vid=' + encodeURIComponent(VID) +
      '&lang=' + LANG;
  }

  function render() { preview.textContent = url(); }
  input.addEventListener('input', render);
  form.addEventListener('submit', function () { console.log('[nde-box] emitting:', url()); });
  render();

  // Hide, don't destroy — the original form comes back with restore().
  var originals = [];
  Array.prototype.forEach.call(block.children, function (c) {
    originals.push([c, c.style.display]);
    c.style.display = 'none';
  });
  block.appendChild(wrap);
  input.focus();

  window.__ndeBox = {
    url: url,
    restore: function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      originals.forEach(function (p) { p[0].style.display = p[1]; });
      delete window.__ndeBox;
      console.log('[nde-box] original search block restored.');
    }
  };

  console.log('[nde-box] ready. vid=' + VID + ' lang=' + LANG +
              ' — type a term, the URL preview updates live. __ndeBox.restore() to undo.');
})();
