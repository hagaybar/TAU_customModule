import { sanitizeSvgMarkup } from './svg-sanitizer';

/**
 * Issue #101. Floor plans are staff-uploaded and rendered with Angular's sanitizer
 * bypassed, so sanitizeSvgMarkup() is the only thing between an upload and every
 * patron's Primo session. These tests pin both halves: active content goes, and
 * everything the real floor plans use (inventoried 10.11.26 from the live CloudFront
 * maps) survives unchanged.
 */
describe('sanitizeSvgMarkup', () => {
  const NS = 'http://www.w3.org/2000/svg';
  const XL = 'http://www.w3.org/1999/xlink';
  const wrap = (inner: string) =>
    `<svg xmlns="${NS}" xmlns:xlink="${XL}" width="100" height="50">${inner}</svg>`;

  /** Parse the output back the way the component renders it: as HTML via innerHTML. */
  function render(markup: string): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML = markup;
    return div;
  }

  const clean = (inner: string) => {
    const out = sanitizeSvgMarkup(wrap(inner));
    expect(out).not.toBeNull();
    return out!.markup;
  };

  describe('removes active content', () => {
    it('drops <script> elements', () => {
      const out = render(clean('<script>window.__x=1</script><rect id="a"/>'));
      expect(out.querySelector('script')).toBeNull();
      expect(out.querySelector('#a')).not.toBeNull();
    });

    it('drops every on* event-handler attribute', () => {
      const out = render(clean('<rect id="a" onclick="x()" onload="x()" ONMOUSEOVER="x()"/>'));
      const rect = out.querySelector('#a')!;
      expect(Array.from(rect.attributes).map((a) => a.name.toLowerCase()).filter((n) => n.startsWith('on')))
        .toEqual([]);
    });

    it('drops foreignObject (an HTML island inside the SVG)', () => {
      const out = render(clean('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>'));
      expect(out.querySelector('foreignObject')).toBeNull();
    });

    it('drops animation elements, which can rewrite attributes such as href at runtime', () => {
      const out = render(clean('<rect id="a"><set attributeName="fill" to="red"/><animate attributeName="x"/></rect>'));
      expect(out.querySelector('set')).toBeNull();
      expect(out.querySelector('animate')).toBeNull();
    });

    it('drops links and elements that are not on the allowlist', () => {
      const out = render(clean('<a href="https://example.org"><rect id="a"/></a><iframe/><style>@import url(x)</style>'));
      expect(out.querySelector('a')).toBeNull();
      expect(out.querySelector('iframe')).toBeNull();
      expect(out.querySelector('style')).toBeNull();
    });

    it('drops javascript: and external hrefs, in both href and xlink:href', () => {
      const out = render(clean(
        '<use id="u1" href="javascript:x()"/>' +
        '<use id="u2" xlink:href="javascript:x()"/>' +
        '<image id="i1" href="https://evil.example/x.png"/>' +
        '<image id="i2" href="data:image/svg+xml;base64,PHN2Zy8+"/>',
      ));
      for (const id of ['u1', 'u2', 'i1', 'i2']) {
        const el = out.querySelector('#' + id)!;
        expect(el.getAttribute('href')).withContext(id).toBeNull();
        expect(el.getAttributeNS(XL, 'href')).withContext(id).toBeNull();
      }
    });

    it('drops any attribute whose value smuggles javascript:', () => {
      const out = render(clean('<rect id="a" fill="javascript:x()" style="fill:red"/>'));
      expect(out.querySelector('#a')!.getAttribute('fill')).toBeNull();
      expect(out.querySelector('#a')!.getAttribute('style')).toBe('fill:red');
    });

    it('drops style attributes that load external resources', () => {
      const out = render(clean('<rect id="a" style="fill:url(https://evil.example/p)"/><rect id="b" style="fill:url(#p1)"/>'));
      expect(out.querySelector('#a')!.getAttribute('style')).toBeNull();
      expect(out.querySelector('#b')!.getAttribute('style')).toBe('fill:url(#p1)');
    });

    it('does not let escaped text re-parse into markup when rendered as HTML', () => {
      const out = render(clean('<text id="t">&lt;img src=x onerror=alert(1)&gt;</text>'));
      expect(out.querySelector('img')).toBeNull();
      expect(out.querySelector('#t')!.textContent).toBe('<img src=x onerror=alert(1)>');
    });

    it('drops comments and processing instructions', () => {
      const out = sanitizeSvgMarkup(wrap('<!-- note --><?pi x?><rect id="a"/>'))!.markup;
      expect(out).not.toContain('<!--');
      expect(out).not.toContain('<?pi');
    });

    it('counts what it removed, so the component can warn', () => {
      const out = sanitizeSvgMarkup(wrap('<script/><rect id="a" onclick="x()"/>'))!;
      expect(out.removed).toBe(2);
      expect(sanitizeSvgMarkup(wrap('<rect id="a"/>'))!.removed).toBe(0);
    });
  });

  describe('keeps everything the real floor plans use', () => {
    it('keeps shelves, ids, data attributes, text and presentation attributes', () => {
      const out = render(clean(
        '<g id="layer1" transform="translate(1,2)">' +
        '<rect id="cl1_100" data-shelf-uid="u1" data-map-object="shelf" x="1" y="2" width="3" height="4" ' +
        'fill="#ccc" stroke="#000" stroke-width="1" style="fill:#eee"/>' +
        '<path d="M0 0L1 1" fill-rule="evenodd"/>' +
        '<text x="1" y="2" font-size="12" direction="rtl" writing-mode="lr">מדף</text>' +
        '</g>',
      ));
      const shelf = out.querySelector('#cl1_100')!;
      expect(shelf.getAttribute('data-shelf-uid')).toBe('u1');
      expect(shelf.getAttribute('style')).toBe('fill:#eee');
      expect(out.querySelector('text')!.textContent).toBe('מדף');
      expect(out.querySelector('path')!.getAttribute('d')).toBe('M0 0L1 1');
    });

    it('keeps defs, patterns, clip paths, filters, internal <use> refs and embedded raster images', () => {
      const out = render(clean(
        '<defs>' +
        '<image id="img1" width="1" height="1" href="data:image/jpeg;base64,/9j/4AAQ"/>' +
        '<pattern id="p1" patternUnits="userSpaceOnUse"><use href="#img1"/></pattern>' +
        '<clipPath id="c1"><rect width="1" height="1"/></clipPath>' +
        '<filter id="f1"><feGaussianBlur stdDeviation="1"/><feComponentTransfer>' +
        '<feFuncA type="linear" slope="1" intercept="0"/></feComponentTransfer></filter>' +
        '</defs>' +
        '<rect fill="url(#p1)" clip-path="url(#c1)"/>',
      ));
      expect(out.querySelector('#img1')!.getAttribute('href')).toBe('data:image/jpeg;base64,/9j/4AAQ');
      expect(out.querySelector('use')!.getAttribute('href')).toBe('#img1');
      expect(out.querySelector('pattern')).not.toBeNull();
      expect(out.querySelector('clipPath')).not.toBeNull();
      expect(out.querySelector('feGaussianBlur')).not.toBeNull();
      expect(out.querySelector('feFuncA')).not.toBeNull();
    });

    it('keeps the Inkscape namedview metadata element', () => {
      const out = sanitizeSvgMarkup(
        `<svg xmlns="${NS}" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd">` +
        '<sodipodi:namedview id="nv" pagecolor="#fff"/><rect id="a"/></svg>',
      )!;
      expect(out.removed).toBe(0);
    });

    it('keeps the root svg attributes the scaling fix relies on', () => {
      const out = render(sanitizeSvgMarkup(
        `<svg xmlns="${NS}" width="100" height="50" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid"><rect/></svg>`,
      )!.markup);
      const svg = out.querySelector('svg')!;
      expect(svg.getAttribute('viewBox')).toBe('0 0 100 50');
      expect(svg.getAttribute('width')).toBe('100');
    });
  });

  describe('refuses input it cannot trust', () => {
    it('returns null for markup that is not well-formed SVG', () => {
      expect(sanitizeSvgMarkup('<svg><rect></svg')).toBeNull();
      expect(sanitizeSvgMarkup('not svg at all')).toBeNull();
    });

    it('returns null when the root element is not <svg>', () => {
      expect(sanitizeSvgMarkup('<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>')).toBeNull();
    });
  });
});
