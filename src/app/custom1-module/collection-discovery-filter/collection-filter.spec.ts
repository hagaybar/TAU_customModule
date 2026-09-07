import {
  applyCollectionFilter,
  HIDDEN_MARKER,
  readCollectionId,
} from './collection-filter';

/** Builds a card the way the host does: two anchors (thumbnail + title) with the same href. */
function card(href: string | null, label = ''): HTMLElement {
  const el = document.createElement('nde-collection-discovery-gallery-collection');
  el.className = 'grid-item';
  el.innerHTML =
    href === null
      ? '<div class="collection-grid-card"><h3>no link</h3></div>'
      : `<div class="collection-grid-card">
           <a class="thumbnail-container" href="${href}"></a>
           <h3><a class="collection-title" href="${href}">${label}</a></h3>
         </div>`;
  return el;
}

/** Hebrew-page href, parameter order as the host emits it. */
const HE = (id: string) =>
  `/nde/collectionDiscovery?collectionId=${id}&lang=he&vid=972TAU_INST%3ANDE`;
/** English-page href with the parameters deliberately reordered. */
const EN = (id: string) =>
  `/nde/collectionDiscovery?vid=972TAU_INST%3ANDE&lang=en&collectionId=${id}`;

describe('readCollectionId', () => {
  it('reads the collectionId from a Hebrew-page link', () => {
    expect(readCollectionId(card(HE('81429943170004146')))).toBe('81429943170004146');
  });

  it('reads it regardless of parameter order and language', () => {
    expect(readCollectionId(card(EN('81429943170004146')))).toBe('81429943170004146');
  });

  it('returns null for a card without a collection link', () => {
    expect(readCollectionId(card(null))).toBeNull();
  });
});

describe('applyCollectionFilter', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('nde-collection-discovery-gallery');
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it('hides listed cards, marks them, and leaves the others visible', () => {
    const a = card(HE('1'));
    const b = card(HE('2'));
    const c = card(EN('3'));
    root.append(a, b, c);

    const hidden = applyCollectionFilter(root, new Set(['2', '3']));

    expect(hidden).toBe(2);
    expect(getComputedStyle(a).display).not.toBe('none');
    expect(getComputedStyle(b).display).toBe('none');
    expect(getComputedStyle(c).display).toBe('none');
    expect(a.hasAttribute(HIDDEN_MARKER)).toBeFalse();
    expect(b.getAttribute(HIDDEN_MARKER)).toBe('2');
    expect(c.getAttribute(HIDDEN_MARKER)).toBe('3');
  });

  it('hides cards at any depth under the root', () => {
    const grid = document.createElement('nde-collection-discovery-grid');
    const wrapper = document.createElement('div');
    wrapper.className = 'grid-container-sub';
    const deep = card(HE('9'));
    wrapper.append(deep);
    grid.append(wrapper);
    root.append(grid);

    expect(applyCollectionFilter(root, new Set(['9']))).toBe(1);
    expect(getComputedStyle(deep).display).toBe('none');
  });

  it('restores a card it hid earlier once its link no longer matches', () => {
    const a = card(HE('1'));
    root.append(a);
    applyCollectionFilter(root, new Set(['1']));
    a.querySelectorAll('a').forEach((anchor) => anchor.setAttribute('href', HE('2')));

    expect(applyCollectionFilter(root, new Set(['1']))).toBe(0);
    expect(a.style.display).toBe('');
    expect(a.hasAttribute(HIDDEN_MARKER)).toBeFalse();
  });

  it('skips cards without a collection link', () => {
    const a = card(null);
    root.append(a);

    expect(applyCollectionFilter(root, new Set(['1']))).toBe(0);
    expect(a.style.display).toBe('');
    expect(a.hasAttribute(HIDDEN_MARKER)).toBeFalse();
  });

  it('is idempotent', () => {
    root.append(card(HE('1')));
    applyCollectionFilter(root, new Set(['1']));

    expect(applyCollectionFilter(root, new Set(['1']))).toBe(1);
    expect(root.querySelectorAll(`[${HIDDEN_MARKER}]`).length).toBe(1);
  });

  it('hides nothing when the list is empty', () => {
    root.append(card(HE('1')), card(HE('2')));

    expect(applyCollectionFilter(root, new Set())).toBe(0);
    expect(root.querySelectorAll(`[${HIDDEN_MARKER}]`).length).toBe(0);
  });
});
