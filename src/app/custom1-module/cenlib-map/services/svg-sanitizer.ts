/**
 * Floor-plan SVG sanitizer (issue #101).
 *
 * WHY THIS EXISTS. Floor plans are uploaded by staff through the Primo Maps admin
 * (NDE_MAPS_MANGER), served from CloudFront, and rendered by ShelfMapSvgComponent through
 * `[innerHTML]` with Angular's sanitizer BYPASSED (bypassSecurityTrustHtml). Angular's
 * own sanitizer cannot be used instead: it strips SVG entirely. So whatever an uploaded
 * file contains would run in every patron's Primo session. This function is what makes
 * that bypass safe: only content that has been through it is trusted.
 *
 * APPROACH: an allowlist, not a denylist. Elements outside ELEMENTS are removed with their
 * subtree, so an element nobody thought of is dropped by default. Attributes are kept
 * unless they are event handlers, carry `javascript:`, or point outside the document.
 *
 * WHAT THE REAL MAPS USE (inventoried 10.11.26 from the three live CloudFront floor plans
 * and the bundled fallbacks): svg, sodipodi:namedview, defs, pattern, filter + fe*
 * primitives, image (embedded data:image/jpeg), use (#id refs), clipPath, rect, path, g,
 * text. No script, no event handlers, no external references. All of it survives this.
 *
 * Returns null when the input is not a well-formed SVG document. The caller treats that
 * like a failed download, never as "render it unsanitized".
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Inkscape editor metadata. Inert, and present in every live floor plan. */
const EDITOR_NAMESPACES = new Set([
  'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd',
  'http://www.inkscape.org/namespaces/inkscape',
]);
const EDITOR_ELEMENTS = new Set(['namedview']);

/** SVG elements allowed to stay. Deliberately absent: script, foreignObject, a, style,
 *  animate/animateMotion/animateTransform/set (they can rewrite href at runtime). */
const ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
  'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
  'text', 'tspan', 'textPath', 'image',
  'pattern', 'clipPath', 'mask', 'marker', 'linearGradient', 'radialGradient', 'stop',
  'filter', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite',
  'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight',
  'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur',
  'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight',
  'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence',
]);

/** href may point inside the document, or embed a raster image. Nothing else. */
const SAFE_HREF = /^(#[\w.:-]+|data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]*)$/i;

/** url(...) that is not a same-document #fragment reference. */
const EXTERNAL_URL = /url\(\s*['"]?\s*(?!#)/i;

export interface SanitizedSvg {
  markup: string;
  /** Elements and attributes removed. Zero for every legitimate floor plan today. */
  removed: number;
}

export function sanitizeSvgMarkup(source: string): SanitizedSvg | null {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  if (
    !root ||
    root.localName !== 'svg' ||
    root.namespaceURI !== SVG_NS ||
    doc.getElementsByTagName('parsererror').length > 0
  ) {
    return null;
  }

  let removed = 0;

  const walk = (el: Element): void => {
    // Snapshot first: the loop removes children as it goes.
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const child = node as Element;
        if (!isAllowedElement(child)) {
          child.remove();
          removed++;
          continue;
        }
        removed += cleanAttributes(child);
        walk(child);
      } else if (node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.CDATA_SECTION_NODE) {
        // Comments and processing instructions: inert, but nothing in them is needed and
        // they are the classic vehicle for XML→HTML re-parse surprises.
        node.parentNode?.removeChild(node);
      }
    }
  };

  removed += cleanAttributes(root);
  walk(root);

  return { markup: new XMLSerializer().serializeToString(root), removed };
}

function isAllowedElement(el: Element): boolean {
  if (el.namespaceURI === SVG_NS) return ELEMENTS.has(el.localName);
  return EDITOR_NAMESPACES.has(el.namespaceURI ?? '') && EDITOR_ELEMENTS.has(el.localName);
}

/** Removes unsafe attributes from one element; returns how many it removed. */
function cleanAttributes(el: Element): number {
  let removed = 0;
  for (const attr of Array.from(el.attributes)) {
    if (!isSafeAttribute(attr)) {
      el.removeAttributeNode(attr);
      removed++;
    }
  }
  return removed;
}

function isSafeAttribute(attr: Attr): boolean {
  const name = attr.localName.toLowerCase();
  // Strip whitespace and control characters first: browsers ignore them inside a URL
  // scheme, so "java\tscript:" would otherwise slip past the check below.
  const compact = attr.value.replace(/[\u0000- ]+/g, '').toLowerCase();

  if (name.startsWith('on')) return false;
  if (compact.includes('javascript:') || compact.includes('vbscript:')) return false;
  if (name === 'href') return SAFE_HREF.test(attr.value.trim());
  if (EXTERNAL_URL.test(attr.value)) return false;
  if (name === 'style' && (compact.includes('@import') || compact.includes('expression('))) return false;
  return true;
}
