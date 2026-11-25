import { signal } from '@angular/core';
import { readDomLocation, readHostLocation, readLocation } from './location-source';

/** A holding as the host's location component carries it (shape verified live 2026-11-25). */
const HOLDING = {
  libraryCode: 'AC1',
  mainLocation: 'Sourasky Central Library',
  subLocation: 'Reading room 2 A - 2nd floor',
  subLocationCode: 'KB1',
  callNumber: '933.1 LIV',
  ilsApiId: '990020446760204146',
};

function ndeLocation(lib: string | null, sub: string | null, cn: string | null): Element {
  const el = document.createElement('nde-location');
  const add = (html: string) => el.insertAdjacentHTML('beforeend', html);
  if (lib !== null) add(`<span class="getit-library-title">${lib}</span>`);
  if (sub !== null) add(`<span data-qa="location-sub-location">${sub}</span>`);
  if (cn !== null) add(`<span data-qa="location-call-number">${cn}</span>`);
  return el;
}

describe('location-source', () => {
  describe('readHostLocation', () => {
    it('reads library, sub-location, call number and codes from hostComponent.location', () => {
      expect(readHostLocation({ location: HOLDING })).toEqual({
        libraryName: 'Sourasky Central Library',
        collectionName: 'Reading room 2 A - 2nd floor',
        rawCallNumber: '933.1 LIV',
        libraryCode: 'AC1',
        subLocationCode: 'KB1',
        source: 'host',
      });
    });

    it('reads the Hebrew display names as they come', () => {
      const facts = readHostLocation({
        location: { ...HOLDING, mainLocation: 'הספרייה המרכזית סוראסקי', subLocation: "אולם קריאה ב'1, קומה שניה" },
      });
      expect(facts?.libraryName).toBe('הספרייה המרכזית סוראסקי');
      expect(facts?.collectionName).toBe("אולם קריאה ב'1, קומה שניה");
    });

    it('reduces markup in host values to the text the page shows', () => {
      const facts = readHostLocation({
        location: { ...HOLDING, subLocation: 'CO Bora collection <B>(hours: 10:00-13:00)</b> &amp; more' },
      });
      expect(facts?.collectionName).toBe('CO Bora collection (hours: 10:00-13:00) & more');
    });

    it('accepts location as a signal', () => {
      expect(readHostLocation({ location: signal(HOLDING) })?.rawCallNumber).toBe('933.1 LIV');
    });

    it('returns null when there is no host component or no location', () => {
      expect(readHostLocation(undefined)).toBeNull();
      expect(readHostLocation(null)).toBeNull();
      expect(readHostLocation({})).toBeNull();
      expect(readHostLocation({ location: null })).toBeNull();
      expect(readHostLocation({ location: 'AC1' })).toBeNull();
    });

    for (const field of ['mainLocation', 'subLocation', 'callNumber'] as const) {
      it(`returns null when ${field} is missing, empty or not a string`, () => {
        const { [field]: _omit, ...rest } = HOLDING;
        expect(readHostLocation({ location: rest })).toBeNull();
        expect(readHostLocation({ location: { ...HOLDING, [field]: '  ' } })).toBeNull();
        expect(readHostLocation({ location: { ...HOLDING, [field]: { value: 'x' } } })).toBeNull();
      });
    }

    it('leaves the codes undefined when the host does not give them', () => {
      const { libraryCode: _l, subLocationCode: _s, ...rest } = HOLDING;
      const facts = readHostLocation({ location: rest });
      expect(facts?.libraryCode).toBeUndefined();
      expect(facts?.subLocationCode).toBeUndefined();
    });
  });

  describe('readDomLocation', () => {
    it('scrapes the three values and strips the trailing semicolon', () => {
      expect(
        readDomLocation(ndeLocation(' Sourasky Central Library ', 'Reading room 2 A - 2nd floor;', '933.1 LIV'))
      ).toEqual({
        libraryName: 'Sourasky Central Library',
        collectionName: 'Reading room 2 A - 2nd floor',
        rawCallNumber: '933.1 LIV',
        source: 'dom',
      });
    });

    it('returns null while any value has not rendered yet', () => {
      expect(readDomLocation(ndeLocation(null, 'Reading room;', '933.1'))).toBeNull();
      expect(readDomLocation(ndeLocation('Sourasky', null, '933.1'))).toBeNull();
      expect(readDomLocation(ndeLocation('Sourasky', 'Reading room;', ''))).toBeNull();
    });
  });

  describe('readLocation', () => {
    const dom = ndeLocation('DOM library', 'DOM room;', '100 DOM');

    it('prefers the host data', () => {
      expect(readLocation({ location: HOLDING }, dom)?.source).toBe('host');
    });

    it('falls back to the DOM when the host shape is not what we expect', () => {
      const facts = readLocation({ location: { renamed: true } }, dom);
      expect(facts?.source).toBe('dom');
      expect(facts?.libraryName).toBe('DOM library');
    });

    it('returns null when neither source has the data', () => {
      expect(readLocation(undefined, null)).toBeNull();
      expect(readLocation(undefined, ndeLocation(null, null, null))).toBeNull();
    });
  });
});
