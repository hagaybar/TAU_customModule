/**
 * Which bibliographic record a Shelf Map button belongs to, for usage tracking.
 *
 * Bibliographic data only: the record's title and Alma MMS ID. Never patron data.
 */

/** Longest title sent to Mixpanel; Mixpanel itself truncates string properties at 255. */
export const MAX_TITLE_LENGTH = 255;

/**
 * Alma MMS ID from a Primo docid: a local Alma record's docid is `alma<MMS ID>`.
 * Anything else (CDI records, missing docid) gives ''.
 */
export function mmsIdFromDocId(docid: string | null | undefined): string {
  const m = /^alma(\d+)$/.exec(docid ?? '');
  return m ? m[1] : '';
}

/**
 * Title of the record that `start` (the button, inside `<nde-location>`) belongs to.
 *
 * Walks up from `start` and takes the first `<nde-record-title>` found inside an ancestor, so
 * on a page listing several records it is the nearest record's title. On full display that is
 * the record header (`nde-full-display-container` holds both the header and Get It).
 * The link text is preferred: `<nde-record-title>` also holds a visually-hidden copy of the
 * title. Host DOM verified live on NDE full display, 2026-11-17. Returns '' if not found.
 */
export function findRecordTitle(start: Element): string {
  let el: Element | null = start.parentElement;
  while (el) {
    const titleEl: Element | null = el.querySelector('nde-record-title');
    el = el.parentElement;
    if (!titleEl) continue;
    const link = titleEl.querySelector('[data-qa="go_to_full_display"]');
    const text = (link ?? titleEl).textContent ?? '';
    return text.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
  }
  return '';
}
