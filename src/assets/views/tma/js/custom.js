/*
 * TMA — host-fetched script, copied verbatim to src/assets/js/custom.js by
 * scripts/select-view.mjs. Primo fetches that fixed path on every page.
 *
 * Note: src/assets/css/custom.js (a 174-byte placeholder from the Ex Libris template) is a
 * different file and is NOT per-view. Leave it alone.
 *
 * ── Why this exists ────────────────────────────────────────────────────────────────────
 *
 * The homepage cards link to searches, and Primo refuses a search URL that has no vid —
 * it renders "Failed to load view configuration" rather than defaulting to the current
 * view. Verified live on 2026-09-15. So the links have to name one.
 *
 * But homepage_<lang>.html is copied into the package verbatim, never templated, so a
 * hardcoded vid is frozen at build time. The moment this content is promoted from
 * TMA_NDE to TMA — which the whole per-view design exists to make a one-line change —
 * every card would send people to a view that is no longer the one they are in.
 *
 * So the href carries vid=972TAU_INST:TMA_NDE as a working fallback, and this rewrites it
 * to whatever view the page is actually being served in. Promotion then needs no edit to
 * the HTML at all.
 *
 * It runs at document level rather than inline in the HTML because injected markup does
 * not execute its own <script> tags — the host inserts that HTML as a string.
 */
(function () {
  'use strict';

  var CARD_SELECTOR = 'a.tma-card[href*="vid="]';

  function currentVid() {
    try {
      var vid = new URLSearchParams(window.location.search).get('vid');
      // A vid is always <INST>:<VIEW>. Anything else is not one, and rewriting a link with
      // it would break a link that currently works.
      return vid && /^[A-Za-z0-9_]+:[A-Za-z0-9_]+$/.test(vid) ? vid : null;
    } catch (e) {
      return null;
    }
  }

  function retarget(vid) {
    var links = document.querySelectorAll(CARD_SELECTOR);
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      var fixed = href.replace(/([?&]vid=)[^&]*/, '$1' + encodeURIComponent(vid));
      if (fixed !== href) links[i].setAttribute('href', fixed);
    }
    return links.length;
  }

  function run() {
    var vid = currentVid();
    if (!vid) return;

    // The cards arrive with the homepage HTML, which the host fetches and injects after
    // this script has already run. Retarget whatever is there now, then watch for the
    // injection — and stop watching once it has happened, so this is not a permanent
    // observer on a page the user may sit on for a long time.
    if (retarget(vid) > 0) return;

    if (typeof MutationObserver !== 'function') return;
    var observer = new MutationObserver(function () {
      if (retarget(vid) > 0) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Give up after 30s rather than observing forever on a page with no cards, which is
    // every page except the landing page.
    window.setTimeout(function () {
      observer.disconnect();
    }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
