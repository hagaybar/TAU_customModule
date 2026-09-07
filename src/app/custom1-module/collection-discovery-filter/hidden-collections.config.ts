import { InjectionToken } from '@angular/core';

/**
 * Collection IDs to hide on the Collection Discovery page.
 *
 * An ID is the `collectionId` value in a card's link, e.g.
 *   /nde/collectionDiscovery?collectionId=81429943170004146&lang=he&vid=...
 * It is also the `collectionId` in the address bar when you open the
 * collection, which is the easiest place to copy it from.
 *
 * Each entry hides that collection's card wherever it appears — the lobby or
 * any sub-collection page — in every UI language. Descendants are not hidden
 * automatically: they only appear on the hidden parent's own page, which the
 * UI no longer links to. A direct link to a hidden collection still works;
 * this is a display filter, not access control.
 *
 * Changing this list means edit → `npm run build` → upload the package.
 */
export const HIDDEN_COLLECTION_IDS: readonly string[] = [
  '81444210450004146',
  '81429943170004146', // The Reconstructed Trademark Registry of Mandatory Palestine
];

/**
 * Injection token for the list, so tests can substitute their own. Production
 * never provides it explicitly: the factory falls back to the constant above.
 */
export const HIDDEN_COLLECTION_IDS_TOKEN = new InjectionToken<readonly string[]>(
  'HIDDEN_COLLECTION_IDS',
  { providedIn: 'root', factory: () => HIDDEN_COLLECTION_IDS },
);
