import { findRecordTitle, mmsIdFromDocId } from './record-context';

describe('record-context', () => {
  describe('mmsIdFromDocId', () => {
    it('strips the alma prefix from a local Alma docid', () => {
      expect(mmsIdFromDocId('alma990021960510204146')).toBe('990021960510204146');
    });

    it('returns empty for a missing or non-Alma docid', () => {
      expect(mmsIdFromDocId(null)).toBe('');
      expect(mmsIdFromDocId('')).toBe('');
      expect(mmsIdFromDocId('cdi_crossref_primary_10_1000_x')).toBe('');
      expect(mmsIdFromDocId('alma99abc')).toBe('');
    });
  });

  describe('findRecordTitle', () => {
    let root: HTMLElement;

    afterEach(() => root?.remove());

    function mount(html: string): HTMLElement {
      root = document.createElement('div');
      root.innerHTML = html;
      document.body.appendChild(root);
      return root;
    }

    // Shape seen live on NDE full display, 2026-11-17.
    const fullDisplay = (title: string) => `
      <nde-full-display-container>
        <nde-search-result-item-container>
          <nde-record-title data-qa="brief_result_title">
            <a class="record-title" data-qa="go_to_full_display">${title}</a>
            <span class="visually-hidden">${title}</span>
          </nde-record-title>
        </nde-search-result-item-container>
        <nde-full-display-service-container>
          <nde-get-it><nde-locations-container>
            <nde-location><span id="start"></span></nde-location>
          </nde-locations-container></nde-get-it>
        </nde-full-display-service-container>
      </nde-full-display-container>`;

    it('reads the record title shown above the location panel', () => {
      const r = mount(fullDisplay('כבוד   המלכים\n'));
      expect(findRecordTitle(r.querySelector('#start')!)).toBe('כבוד המלכים');
    });

    it("picks the nearest record's title when several records are on the page", () => {
      const r = mount(`
        <div class="item"><nde-record-title><a data-qa="go_to_full_display">First</a></nde-record-title>
          <nde-location><span id="a"></span></nde-location></div>
        <div class="item"><nde-record-title><a data-qa="go_to_full_display">Second</a></nde-record-title>
          <nde-location><span id="b"></span></nde-location></div>`);
      expect(findRecordTitle(r.querySelector('#b')!)).toBe('Second');
    });

    it('falls back to the whole nde-record-title when the link is absent', () => {
      const r = mount(`<section><nde-record-title> Plain title </nde-record-title><i id="s"></i></section>`);
      expect(findRecordTitle(r.querySelector('#s')!)).toBe('Plain title');
    });

    it('returns empty when no title is on the page', () => {
      const r = mount(`<nde-location><span id="s"></span></nde-location>`);
      expect(findRecordTitle(r.querySelector('#s')!)).toBe('');
    });

    it('caps very long titles', () => {
      const r = mount(fullDisplay('x'.repeat(1000)));
      expect(findRecordTitle(r.querySelector('#start')!).length).toBe(255);
    });
  });
});
