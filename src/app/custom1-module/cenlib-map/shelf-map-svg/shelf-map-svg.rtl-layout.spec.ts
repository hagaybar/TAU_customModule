import { Component, SimpleChange, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { ShelfMapSvgComponent } from './shelf-map-svg.component';

/**
 * Issue #49 — RTL layout regression tests.
 *
 * These are *layout* assertions: they need a real layout engine, so they only
 * mean anything under the Karma/Chrome test target (`npm test`), not jsdom.
 *
 * The floor SVGs place every label as its own absolutely-positioned
 * `<text x="…">` and never set `text-anchor`. The default `text-anchor: start`
 * resolves against the inline base direction, so when the injected SVG inherits
 * `direction: rtl` from the Hebrew dialog the anchor flips to the label's right
 * edge: each label is drawn *leftward* from its `x` by its own advance width, and
 * "1-4" / "5-12" collapse into overlapping blobs.
 *
 * Invariant under test: the map is a drawing, not prose. Label placement must be
 * identical in both UI languages, while labels that *declare* their own
 * `direction="rtl"` (every Hebrew label in the real floor files) stay RTL.
 */
const SVG_WIDTH = 1040; // matches the real floor files

/**
 * Mimics the real floor files: separate x-anchored <text> nodes, no text-anchor,
 * Hebrew labels carrying their own direction="rtl". The coordinates and font
 * attributes of the range labels are copied verbatim from
 * src/assets/cenlib-map/floor_1.svg (top aisle row, y=32).
 */
const LABEL_FONT = 'font-family="Arial, Arial_MSFontService, sans-serif" font-weight="700" font-size="16px"';
const FLOOR_SVG = `<svg width="${SVG_WIDTH}" height="100" viewBox="0 0 ${SVG_WIDTH} 100" xmlns="http://www.w3.org/2000/svg">
  <text id="lbl-1" ${LABEL_FONT} x="223.211" y="32">1</text>
  <text id="lbl-dash-a" ${LABEL_FONT} x="232.044" y="32">-</text>
  <text id="lbl-4" ${LABEL_FONT} x="237.378" y="32">4</text>
  <text id="lbl-5" ${LABEL_FONT} x="330.214" y="32">5</text>
  <text id="lbl-dash-b" ${LABEL_FONT} x="339.047" y="32">-</text>
  <text id="lbl-12" ${LABEL_FONT} x="344.381" y="32">12</text>
  <text id="lbl-cl" ${LABEL_FONT} x="600" y="32">CL</text>
  <text id="lbl-105" ${LABEL_FONT} x="640" y="32">105</text>
  <text id="lbl-he" direction="rtl" font-family="Arial, sans-serif" font-size="16px" x="900" y="32">אולם קריאה א</text>
</svg>`;

/** Labels that rely on inherited direction — i.e. everything except the Hebrew ones. */
const X_ANCHORED_LABELS = [
  'lbl-1',
  'lbl-dash-a',
  'lbl-4',
  'lbl-5',
  'lbl-dash-b',
  'lbl-12',
  'lbl-cl',
  'lbl-105',
];

/**
 * Authored `x` of each label. With `text-anchor: start` under an LTR base
 * direction this IS the label's left edge; flip the base direction and the label
 * is drawn leftward from it instead, by its own advance width (5.3–26.7 user
 * units here) — which is exactly the bug. Comparing left edges against the
 * authored coordinate is font-independent, unlike comparing glyph boxes to each
 * other (side bearings differ between Arial and its Linux substitute).
 */
const AUTHORED_X: Record<string, number> = {
  'lbl-1': 223.211,
  'lbl-dash-a': 232.044,
  'lbl-4': 237.378,
  'lbl-5': 330.214,
  'lbl-dash-b': 339.047,
  'lbl-12': 344.381,
  'lbl-cl': 600,
  'lbl-105': 640,
};

const SVG_URL = 'https://cdn.example.test/maps/floor_1.svg';

/** Mirrors cenlib-map-dialog: the map sits inside a container whose dir follows the UI language. */
@Component({
  standalone: true,
  imports: [ShelfMapSvgComponent],
  template: `<div [attr.dir]="dir" style="width: 800px">
    <tau-shelf-map-svg [language]="dir === 'rtl' ? 'he' : 'en'"></tau-shelf-map-svg>
  </div>`,
})
class DialogHostComponent {
  dir: 'ltr' | 'rtl' = 'ltr';
  @ViewChild(ShelfMapSvgComponent) map!: ShelfMapSvgComponent;
}

interface LabelBox {
  left: number;
  right: number;
}

describe('ShelfMapSvgComponent — RTL layout (issue #49)', () => {
  let fixture: ComponentFixture<DialogHostComponent>;
  let host: DialogHostComponent;
  let httpMock: HttpTestingController;

  /** Load the map through the real HTTP path, exactly as the dialog does. */
  function loadMap(dir: 'ltr' | 'rtl'): void {
    host.dir = dir;
    fixture.detectChanges();

    host.map.svgPath = SVG_URL;
    host.map.ngOnChanges({ svgPath: new SimpleChange(undefined, SVG_URL, true) });
    httpMock.expectOne(SVG_URL).flush(FLOOR_SVG);
    tick(50); // component's post-render applyHighlighting()
    fixture.detectChanges();
  }

  const injectedSvg = (): SVGSVGElement => {
    const svg = fixture.nativeElement.querySelector('.map-content svg') as SVGSVGElement;
    expect(svg).withContext('injected SVG should be rendered').toBeTruthy();
    return svg;
  };

  /**
   * Label edges in SVG user units, relative to the SVG's own left edge, so they
   * are comparable across renders regardless of the container's scale.
   */
  function labelBoxes(): Record<string, LabelBox> {
    const svg = injectedSvg();
    const box = svg.getBoundingClientRect();
    const scale = box.width / SVG_WIDTH;
    const boxes: Record<string, LabelBox> = {};
    for (const id of X_ANCHORED_LABELS) {
      const rect = (svg.querySelector(`#${id}`) as SVGTextElement).getBoundingClientRect();
      boxes[id] = {
        left: (rect.x - box.x) / scale,
        right: (rect.x + rect.width - box.x) / scale,
      };
    }
    return boxes;
  }

  const midX = (el: Element): number => {
    const r = el.getBoundingClientRect();
    return r.x + r.width / 2;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DialogHostComponent, HttpClientTestingModule],
    });
    fixture = TestBed.createComponent(DialogHostComponent);
    host = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('keeps the injected SVG LTR inside a dir="rtl" dialog', fakeAsync(() => {
    loadMap('rtl');

    expect(getComputedStyle(injectedSvg()).direction).toBe('ltr');
  }));

  it('places every x-anchored label identically in Hebrew (rtl) and English (ltr)', fakeAsync(() => {
    loadMap('ltr');
    const english = labelBoxes();

    host.dir = 'rtl';
    fixture.detectChanges();
    const hebrew = labelBoxes();

    for (const id of X_ANCHORED_LABELS) {
      // Without the fix each label slides left by its own advance width.
      const drift = hebrew[id].left - english[id].left;
      expect(Math.abs(drift))
        .withContext(`${id} moved ${drift.toFixed(1)} user units in RTL`)
        .toBeLessThan(0.5);
    }
  }));

  it('anchors every label at its authored x in Hebrew, so "1-4" and "5-12" stay readable', fakeAsync(() => {
    loadMap('rtl');
    const boxes = labelBoxes();

    for (const [id, authoredX] of Object.entries(AUTHORED_X)) {
      const drift = boxes[id].left - authoredX;
      expect(Math.abs(drift))
        .withContext(`${id} starts ${drift.toFixed(1)} user units from its authored x=${authoredX}`)
        .toBeLessThan(1);
    }
  }));

  it('leaves labels that declare direction="rtl" (the Hebrew ones) right-to-left', fakeAsync(() => {
    loadMap('rtl');

    const hebrewLabel = injectedSvg().querySelector('#lbl-he') as SVGTextElement;
    expect(getComputedStyle(hebrewLabel).direction).toBe('rtl');
  }));

  describe('control mirroring', () => {
    it('mirrors the zoom controls in Hebrew (zoom-in rightmost, icon after the label)', fakeAsync(() => {
      loadMap('rtl');

      const buttons = fixture.nativeElement.querySelectorAll('.map-controls button');
      expect(buttons.length).toBe(3);
      // dir="rtl" already reverses a flex row; an extra row-reverse cancels it.
      expect(midX(buttons[0]))
        .withContext('first control (zoom in) should be rightmost in RTL')
        .toBeGreaterThan(midX(buttons[2]));

      const icon = buttons[0].querySelector('mat-icon') as HTMLElement;
      const label = buttons[0].querySelector('.control-label') as HTMLElement;
      expect(midX(icon))
        .withContext('icon should sit after (right of) its label in RTL')
        .toBeGreaterThan(midX(label));
    }));

    it('mirrors the legend in Hebrew (first item rightmost)', fakeAsync(() => {
      loadMap('rtl');

      const items = fixture.nativeElement.querySelectorAll('.legend .legend-item');
      expect(items.length).toBe(2);
      expect(midX(items[0]))
        .withContext('first legend item (shelves) should be rightmost in RTL')
        .toBeGreaterThan(midX(items[1]));
    }));

    it('leaves the zoom controls in reading order in English', fakeAsync(() => {
      loadMap('ltr');

      const buttons = fixture.nativeElement.querySelectorAll('.map-controls button');
      expect(midX(buttons[0])).toBeLessThan(midX(buttons[2]));

      const icon = buttons[0].querySelector('mat-icon') as HTMLElement;
      const label = buttons[0].querySelector('.control-label') as HTMLElement;
      expect(midX(icon)).toBeLessThan(midX(label));
    }));
  });
});
