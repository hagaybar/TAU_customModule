/**
 * Pure DOM logic for the Collection Discovery filter.
 *
 * No Angular in here on purpose: everything is a function of a root element
 * and a set of IDs, so it is unit-tested against a hand-built DOM. The
 * component in this folder owns *when* to run it; this file owns *what* it
 * does.
 *
 * Host facts these selectors rely on (verified live 2026-09-07, he + en):
 * every collection card, at every nesting level, is one
 * <nde-collection-discovery-gallery-collection> wrapping two anchors whose
 * href carries `collectionId=<id>`. See the design spec for the evidence:
 * docs/superpowers/specs/2026-09-07-collection-discovery-filter-design.md
 */

/** The host element that wraps one collection card, at every nesting level. */
export const CARD_SELECTOR = 'nde-collection-discovery-gallery-collection';

/** Any anchor inside a card that links to a collection page. */
export const CARD_LINK_SELECTOR = 'a[href*="collectionId="]';

/**
 * Marker on cards this filter has hidden; the value is the collection ID.
 * It is what makes a pass reversible: a marked card whose link no longer
 * matches is restored, an unmarked card is never touched.
 */
export const HIDDEN_MARKER = 'data-tau-hidden-collection';

/**
 * Reads the collection ID a card links to.
 *
 * Parses the query string rather than pattern-matching the text, so the
 * result does not depend on parameter order, encoding, or the `lang` value —
 * which is what makes the filter language-independent.
 *
 * @returns the ID, or null when the card has no collection link or the link
 *          cannot be parsed.
 */
export function readCollectionId(card: Element): string | null {
  const href = card.querySelector<HTMLAnchorElement>(CARD_LINK_SELECTOR)?.getAttribute('href');
  if (!href) {
    return null;
  }
  try {
    return new URL(href, window.location.origin).searchParams.get('collectionId');
  } catch {
    return null;
  }
}

/**
 * Hides every card under `root` whose collection ID is in `hiddenIds`, and
 * restores any card this filter hid earlier that no longer matches.
 *
 * Idempotent and safe to run on every DOM mutation: it re-evaluates every
 * card each time, so it also copes with the host reusing a DOM node for a
 * different collection.
 *
 * @returns the number of cards left hidden after this pass.
 */
export function applyCollectionFilter(root: ParentNode, hiddenIds: ReadonlySet<string>): number {
  let hidden = 0;
  for (const card of Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTOR))) {
    const id = readCollectionId(card);
    if (id !== null && hiddenIds.has(id)) {
      card.style.setProperty('display', 'none', 'important');
      card.setAttribute(HIDDEN_MARKER, id);
      hidden++;
    } else if (card.hasAttribute(HIDDEN_MARKER)) {
      card.style.removeProperty('display');
      card.removeAttribute(HIDDEN_MARKER);
    }
  }
  return hidden;
}
