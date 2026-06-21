import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ElementRef, SimpleChange } from '@angular/core';

import { ShelfMapSvgComponent } from './shelf-map-svg.component';

describe('ShelfMapSvgComponent', () => {
  let fixture: ComponentFixture<ShelfMapSvgComponent>;
  let component: ShelfMapSvgComponent;

  /**
   * Wire up a fake "already loaded" external SVG so applyHighlighting() has a
   * container to operate on, without going through the real HTTP load. The
   * caller supplies the inner SVG markup (shelf <rect> elements with ids).
   */
  function attachSvg(innerHtml: string): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = `<svg>${innerHtml}</svg>`;
    component.svgContainer = new ElementRef(container);
    component.useExternalSvg = true;
    return container;
  }

  /** Drive a highlightedShelfCodes change through ngOnChanges + flush the timeout. */
  function setCodes(codes: string[], previous: string[] = []): void {
    component.highlightedShelfCodes = codes;
    component.ngOnChanges({
      highlightedShelfCodes: new SimpleChange(previous, codes, previous.length === 0),
    });
    tick();
  }

  const isHighlighted = (container: HTMLElement, id: string): boolean =>
    !!container.querySelector(`#${id}`)?.classList.contains('highlighted');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ShelfMapSvgComponent, HttpClientTestingModule],
    });
    fixture = TestBed.createComponent(ShelfMapSvgComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Finding 1 — re-highlight when codes change on the same SVG', () => {
    it('clears the previous highlight and applies the new one without an SVG reload', fakeAsync(() => {
      const container = attachSvg(
        '<rect id="cl_106_a"></rect><rect id="cl_107_a"></rect>'
      );

      setCodes(['cl_106_a']);
      expect(isHighlighted(container, 'cl_106_a')).toBe(true);
      expect(isHighlighted(container, 'cl_107_a')).toBe(false);

      // Codes change while the SAME svg stays loaded (no svgPath change).
      setCodes(['cl_107_a'], ['cl_106_a']);
      expect(isHighlighted(container, 'cl_106_a')).toBe(false);
      expect(isHighlighted(container, 'cl_107_a')).toBe(true);
    }));

    it('keeps the highlight stable when the same code set is re-applied', fakeAsync(() => {
      const container = attachSvg('<rect id="cl_106_a"></rect>');

      setCodes(['cl_106_a']);
      setCodes(['cl_106_a'], ['cl_106_a']);

      expect(isHighlighted(container, 'cl_106_a')).toBe(true);
    }));
  });

  describe('Finding 2 — exact-id matching only (mirror the producer)', () => {
    it('highlights a shelf whose id exactly matches the code', fakeAsync(() => {
      const container = attachSvg('<rect id="cl_106_a"></rect>');

      setCodes(['cl_106_a']);

      expect(isHighlighted(container, 'cl_106_a')).toBe(true);
    }));

    it('does NOT fuzzy-rescue cl1_106_a onto a cl_106_a element', fakeAsync(() => {
      const container = attachSvg('<rect id="cl_106_a"></rect>');

      // Producer enforces exact match; consumer must not silently match a
      // different shelf and mask producer↔consumer drift.
      setCodes(['cl1_106_a']);

      expect(isHighlighted(container, 'cl_106_a')).toBe(false);
    }));

    it('does NOT fuzzy-rescue cl_106_a onto a cl1_106_a element', fakeAsync(() => {
      const container = attachSvg('<rect id="cl1_106_a"></rect>');

      setCodes(['cl_106_a']);

      expect(isHighlighted(container, 'cl1_106_a')).toBe(false);
    }));
  });
});
