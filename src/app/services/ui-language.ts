/**
 * UI language resolution for TAU components mounted inside Primo NDE.
 *
 * Every bilingual component in this package needs the same two things: read the
 * language the host is currently rendering in, and keep following it when the
 * user switches language without a page reload. This file is the single
 * implementation of both, because getting either subtly wrong is invisible in
 * one language and obvious in the other.
 *
 * Why an attribute observer and not a router/store subscription: verified live
 * on 2026-08-02 (issue #30) and again on 2026-08-12 (issue #41) — on a language
 * switch the host rewrites `<html lang>` and `<html dir>`, but does NOT fire
 * `popstate`, because its router navigates with pushState. Short of reaching
 * into the host's NgRx store, the attribute mutation is the only reliable
 * signal available to us.
 */

export type UiLanguage = 'en' | 'he';

/**
 * Resolves the UI language, preferring the signal that actually tracks in-app
 * switches.
 *
 * Priority mirrors the bilingual rules already in custom.css
 * (`html[lang="he"]`, then `html:not([lang])[dir="rtl"]`), with the URL kept as
 * a middle fallback for first paint, before the host has stamped `<html lang>`.
 *
 * Matching on a `he` prefix rather than equality is deliberate: it covers
 * `he_IL` and any other `he-*` tag, which an equality check silently treated as
 * English.
 */
export function readUiLanguage(): UiLanguage {
  const htmlLang = document.documentElement.getAttribute('lang');
  if (htmlLang) {
    return htmlLang.toLowerCase().startsWith('he') ? 'he' : 'en';
  }

  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang) {
    return urlLang.toLowerCase().startsWith('he') ? 'he' : 'en';
  }

  return document.documentElement.getAttribute('dir') === 'rtl' ? 'he' : 'en';
}

/**
 * Calls `onChange` whenever the host switches language, and never for a
 * mutation that leaves the resolved language unchanged.
 *
 * The caller owns the returned observer and MUST disconnect it in `ngOnDestroy`.
 * Components using OnPush also have to call `markForCheck()` from `onChange`:
 * the mutation originates outside their own change-detection path, so assigning
 * the field is not enough to repaint.
 *
 * @param current Reads the caller's present language, so a no-op mutation does
 *                not trigger needless work.
 */
export function watchUiLanguage(
  current: () => UiLanguage,
  onChange: (language: UiLanguage) => void
): MutationObserver {
  const observer = new MutationObserver(() => {
    const next = readUiLanguage();
    if (next !== current()) {
      onChange(next);
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'dir'],
  });

  return observer;
}
