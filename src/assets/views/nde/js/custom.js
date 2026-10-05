/**
 * TAU host-loaded custom JS.
 *
 * Landing-page quick links ("the cubes"): open EXTERNAL links in a new tab.
 *
 * Why this lives here and not in the Back Office
 * ---------------------------------------------
 * The native NDE landing page is rendered by the host component
 * `nde-landing-quick-links`, which reads the per-view Back Office file
 * `assets/landingpage/landingpage.json`. Each link there has an `openInNewTab`
 * flag, and the host honours it (`target="_blank" rel="noopener noreferrer"`
 * plus the "(Opens in a new tab)" aria suffix). Alma's Landing Page tab,
 * however, only exposes Label / URL / Icon per link -- there is no control for
 * that flag, and the file is not part of this customization package, so we
 * cannot ship a corrected copy either. This script closes that gap from the
 * package side. See docs/features/landing-quick-links-new-tab.md.
 *
 * Scope: only absolute http(s) links to another host. In-app Primo routes
 * (e.g. the library-card link, /nde/account/overview) stay in the same tab,
 * because opening the SPA in a second tab is worse, not better.
 *
 * Remove this file's logic once Ex Libris exposes `openInNewTab` in the
 * Back Office and the flag is set on the view.
 */
(function () {
  'use strict';

  var QUICK_LINKS = 'nde-landing-quick-links a[href]';

  // Mirrors the host label `nde.aria.opensInaNewTab`, which the native
  // renderer appends to the link's aria-label when openInNewTab is true.
  var ARIA_SUFFIX = {
    en: '(Opens in a new tab)',
    he: '(נפתח בלשונית חדשה)'
  };

  function ariaSuffix() {
    var lang = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2).toLowerCase();
    return ARIA_SUFFIX[lang] || ARIA_SUFFIX.en;
  }

  function isExternal(anchor) {
    var href = anchor.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return false;
    try {
      return new URL(href, window.location.href).host !== window.location.host;
    } catch (e) {
      return false;
    }
  }

  // Idempotent: only writes when the attribute is not already correct, so the
  // MutationObserver below cannot trigger itself in a loop.
  function apply() {
    var anchors = document.querySelectorAll(QUICK_LINKS);
    for (var i = 0; i < anchors.length; i++) {
      var anchor = anchors[i];
      if (!isExternal(anchor)) continue;

      if (anchor.getAttribute('target') !== '_blank') {
        anchor.setAttribute('target', '_blank');
      }
      if (anchor.getAttribute('rel') !== 'noopener noreferrer') {
        anchor.setAttribute('rel', 'noopener noreferrer');
      }

      // The host rewrites aria-label on every language switch, dropping our
      // suffix; re-append it (skip until the translation has actually landed).
      var label = anchor.getAttribute('aria-label') || '';
      var suffix = ariaSuffix();
      if (label && label.indexOf(suffix) === -1) {
        anchor.setAttribute('aria-label', label + ' - ' + suffix);
      }
    }
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      apply();
    });
  }

  function start() {
    apply();
    // The landing page mounts (and remounts on navigation) well after this
    // script runs.
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true
    });
    // An in-app language switch reuses the same anchors and only swaps their
    // href/aria-label, which the childList observer above would not see.
    new MutationObserver(schedule).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang', 'dir']
    });
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
