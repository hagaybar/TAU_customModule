/**
 * Where the Shelf Map button gets its location from (issue #38).
 *
 * Preferred: the host's own data. Ex Libris passes every custom component an
 * `hostComponent` input. Inside `<nde-location>` that is the host's location component, whose
 * `location` property is the holding object from the `Delivery` store slice
 * (`Delivery.entities[<docid>].delivery.holding[i]`): `mainLocation`, `subLocation`,
 * `callNumber`, plus `libraryCode` and `subLocationCode`. Verified live on NDE, 2026-11-25.
 * Reading it through `hostComponent` rather than selecting it from the store gives each button
 * *its own* holding without having to match DOM order to array order.
 *
 * Fallback: the rendered text, scraped by CSS selector as before. `hostComponent` is a
 * documented input, but the shape of the object behind it is Ex Libris' internal model with no
 * deprecation policy. Any field missing or of the wrong type sends us to the DOM, so a host
 * release that reshapes it degrades to the old behaviour instead of hiding the button.
 *
 * Both sources give the same *localized display names* (Hebrew on the Hebrew UI, English on the
 * English UI), so the existing name-keyed config and mapping.csv work unchanged.
 */
import { isSignal } from '@angular/core';

export interface LocationFacts {
  /** Library display name, e.g. "Sourasky Central Library" / "הספרייה המרכזית סוראסקי" */
  libraryName: string;
  /** Sub-location display name, without the trailing ";" the DOM shows */
  collectionName: string;
  /** Call number as displayed, cutter included */
  rawCallNumber: string;
  /** Alma library code (host source only), e.g. "AC1" */
  libraryCode?: string;
  /** Alma location code (host source only), e.g. "KB1" */
  subLocationCode?: string;
  /** Which source produced these facts */
  source: 'host' | 'dom';
}

/**
 * Plain, whitespace-collapsed text. Host values may carry markup that the page renders as text:
 * a Sourasky sub-location arrives as `CO אוסף בורה. קומת מרתף <B>(שעות …)</b>` (seen live,
 * 2026-11-25), so tags and entities are reduced to the text the DOM would show. DOMParser
 * builds an inert document: nothing in it runs or loads.
 */
function text(value: unknown): string {
  if (typeof value !== 'string') return '';
  let plain = value;
  if (/[<&]/.test(plain)) {
    plain = new DOMParser().parseFromString(plain, 'text/html').body.textContent ?? '';
  }
  return plain.replace(/\s+/g, ' ').trim();
}

function stripTrailingSemicolon(value: string): string {
  return value.endsWith(';') ? value.slice(0, -1).trim() : value;
}

/**
 * Location facts from the host component's holding, or null if the shape is not what we expect.
 * Accepts `location` as a plain object or as an Angular signal (in case the host moves to
 * signal inputs).
 */
export function readHostLocation(hostComponent: unknown): LocationFacts | null {
  if (!hostComponent || typeof hostComponent !== 'object') return null;
  let location: unknown = (hostComponent as Record<string, unknown>)['location'];
  if (isSignal(location)) {
    try {
      location = location();
    } catch {
      return null;
    }
  }
  if (!location || typeof location !== 'object') return null;

  const holding = location as Record<string, unknown>;
  const libraryName = text(holding['mainLocation']);
  const collectionName = stripTrailingSemicolon(text(holding['subLocation']));
  const rawCallNumber = text(holding['callNumber']);
  if (!libraryName || !collectionName || !rawCallNumber) return null;

  return {
    libraryName,
    collectionName,
    rawCallNumber,
    libraryCode: text(holding['libraryCode']) || undefined,
    subLocationCode: text(holding['subLocationCode']) || undefined,
    source: 'host',
  };
}

/** Location facts scraped from the rendered `<nde-location>`, or null if any is missing. */
export function readDomLocation(ndeLocation: Element): LocationFacts | null {
  const read = (selector: string) => text(ndeLocation.querySelector(selector)?.textContent);
  const libraryName = read('.getit-library-title');
  const collectionName = stripTrailingSemicolon(read('[data-qa="location-sub-location"]'));
  const rawCallNumber = read('[data-qa="location-call-number"]');
  if (!libraryName || !collectionName || !rawCallNumber) return null;
  return { libraryName, collectionName, rawCallNumber, source: 'dom' };
}

/** Host data first, rendered text second. */
export function readLocation(
  hostComponent: unknown,
  ndeLocation: Element | null
): LocationFacts | null {
  return readHostLocation(hostComponent) ?? (ndeLocation ? readDomLocation(ndeLocation) : null);
}
