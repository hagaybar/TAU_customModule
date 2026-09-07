# Collection Discovery Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the cards of a configured list of collection IDs on `/nde/collectionDiscovery`, at every nesting level and in every UI language, from a standalone component of the TAU custom module.

**Architecture:** A render-nothing Angular component mounted at the host's `nde-collection-discovery-gallery-top` slot finds the enclosing `<nde-collection-discovery-gallery>` and keeps a `MutationObserver` on it. Every pass walks all `<nde-collection-discovery-gallery-collection>` cards under that root, reads the `collectionId` query parameter from the card's link, hides matches with an inline `display: none !important` plus a marker attribute, and restores previously marked cards that no longer match. The DOM logic is a pure function in its own file so it is unit-tested without Angular.

**Tech Stack:** Angular 18.2 standalone components, `@angular/elements` (host registers the slot), Karma + Jasmine in headless Chrome, the project's gated logger `dlog`/`dwarn`.

**Spec:** `docs/superpowers/specs/2026-09-07-collection-discovery-filter-design.md`

## Global Constraints

- No `console.log` / `console.warn` / `console.info` in shipped code. Use `dlog` / `dwarn` from `src/app/services/debug.util.ts` (project rule in `CLAUDE.md`).
- Never log host components, DOM nodes, or patron data — counts and selectors only.
- The component renders nothing: `template: ''`, `styles: [':host { display: none; }']`.
- Mount selector: `nde-collection-discovery-gallery-top`. Fallbacks, only if the live proxy shows the slot does not render: `nde-collection-discovery-grid-top`, then `nde-collection-discovery-gallery-before`.
- Host selectors are constants exported from the component files: `GALLERY_SELECTOR = 'nde-collection-discovery-gallery'`, `CARD_SELECTOR = 'nde-collection-discovery-gallery-collection'`, `CARD_LINK_SELECTOR = 'a[href*="collectionId="]'`.
- Language independence comes from parsing the `collectionId` query parameter with `URL.searchParams`, never from text.
- Every mutation of a card is reversible and idempotent: marker attribute `data-tau-hidden-collection="<id>"`.
- Test command (verified working on 2026-09-07):
  `npx ng test --watch=false --browsers=ChromeHeadless --include='<spec path>'`
- Compile check without archiving a throwaway package: `npx ng build` (not `npm run build`, whose `postbuild.js` archives every zip to `~/tau-packages/`).
- Commits: conventional prefix, and end with the session's attribution trailer.

## File Structure

New folder `src/app/custom1-module/collection-discovery-filter/`:

| File | Responsibility |
|------|----------------|
| `collection-filter.ts` | Pure DOM logic: `readCollectionId(card)`, `applyCollectionFilter(root, hiddenIds)`; exports the card selectors and the marker attribute. No Angular imports. |
| `collection-filter.spec.ts` | Unit tests for the pure logic against a hand-built DOM. |
| `hidden-collections.config.ts` | `HIDDEN_COLLECTION_IDS` (the list librarians edit) and `HIDDEN_COLLECTION_IDS_TOKEN` (injection token defaulting to that list, so tests can substitute). |
| `collection-discovery-filter.component.ts` | The Angular component: finds the gallery, runs the first pass, observes, coalesces via `requestAnimationFrame` outside the zone, cleans up. Exports `GALLERY_SELECTOR`. |
| `collection-discovery-filter.component.spec.ts` | Component tests: hides at mount, hides later-rendered cards, survives a grid swap, stops on destroy, inert with an empty list or outside a gallery. |

Modified:

| File | Change |
|------|--------|
| `src/app/custom1-module/customComponentMappings.ts` | One import and one map entry. |
| `.upstream-sync/owned-files.json` | New category `collection-discovery-filter`. |
| `README.md` | Summary-table row, add-on section "4. Collection Discovery Filter", docs index entry. |
| `docs/features/collection-discovery-filter.md` | New feature doc (request, host facts, how it works, how to add an ID, verification, limitations). |

---

### Task 1: Pure filter logic

**Files:**
- Create: `src/app/custom1-module/collection-discovery-filter/collection-filter.ts`
- Test: `src/app/custom1-module/collection-discovery-filter/collection-filter.spec.ts`

**Interfaces:**
- Consumes: nothing from this feature.
- Produces:
  - `export const CARD_SELECTOR: string`
  - `export const CARD_LINK_SELECTOR: string`
  - `export const HIDDEN_MARKER: string` (= `'data-tau-hidden-collection'`)
  - `export function readCollectionId(card: Element): string | null`
  - `export function applyCollectionFilter(root: ParentNode, hiddenIds: ReadonlySet<string>): number` — returns the number of cards left hidden after the pass.

- [ ] **Step 1: Write the failing tests**

Create `src/app/custom1-module/collection-discovery-filter/collection-filter.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/custom1-module/collection-discovery-filter/collection-filter.spec.ts'
```
Expected: the build fails with `Cannot find module './collection-filter'` (the spec cannot compile until the module exists).

- [ ] **Step 3: Write the implementation**

Create `src/app/custom1-module/collection-discovery-filter/collection-filter.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/custom1-module/collection-discovery-filter/collection-filter.spec.ts'
```
Expected: `TOTAL: 10 SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add src/app/custom1-module/collection-discovery-filter/collection-filter.ts \
        src/app/custom1-module/collection-discovery-filter/collection-filter.spec.ts
git commit -m "feat(collection-discovery-filter): pure card-hiding logic keyed on collectionId"
```

---

### Task 2: Configuration and injection token

**Files:**
- Create: `src/app/custom1-module/collection-discovery-filter/hidden-collections.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const HIDDEN_COLLECTION_IDS: readonly string[]`
  - `export const HIDDEN_COLLECTION_IDS_TOKEN: InjectionToken<readonly string[]>` — `providedIn: 'root'`, factory returns `HIDDEN_COLLECTION_IDS`.

This task has no test of its own: the token is exercised by every test in Task 3, which overrides it.

- [ ] **Step 1: Write the config file**

Create `src/app/custom1-module/collection-discovery-filter/hidden-collections.config.ts`:

```ts
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
  // '81429943170004146', // example — The Reconstructed Trademark Registry of Mandatory Palestine
];

/**
 * Injection token for the list, so tests can substitute their own. Production
 * never provides it explicitly: the factory falls back to the constant above.
 */
export const HIDDEN_COLLECTION_IDS_TOKEN = new InjectionToken<readonly string[]>(
  'HIDDEN_COLLECTION_IDS',
  { providedIn: 'root', factory: () => HIDDEN_COLLECTION_IDS },
);
```

- [ ] **Step 2: Type-check it**

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json
```
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add src/app/custom1-module/collection-discovery-filter/hidden-collections.config.ts
git commit -m "feat(collection-discovery-filter): hidden-collection ID list and injection token"
```

---

### Task 3: The component

**Files:**
- Create: `src/app/custom1-module/collection-discovery-filter/collection-discovery-filter.component.ts`
- Test: `src/app/custom1-module/collection-discovery-filter/collection-discovery-filter.component.spec.ts`

**Interfaces:**
- Consumes: `applyCollectionFilter`, `HIDDEN_MARKER` from `./collection-filter`; `HIDDEN_COLLECTION_IDS_TOKEN` from `./hidden-collections.config`; `dlog`, `dwarn` from `../../services/debug.util`.
- Produces:
  - `export const GALLERY_SELECTOR = 'nde-collection-discovery-gallery'`
  - `export class CollectionDiscoveryFilterComponent implements AfterViewInit, OnDestroy` — standalone, selector `tau-collection-discovery-filter`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/custom1-module/collection-discovery-filter/collection-discovery-filter.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  CollectionDiscoveryFilterComponent,
  GALLERY_SELECTOR,
} from './collection-discovery-filter.component';
import { HIDDEN_MARKER } from './collection-filter';
import { HIDDEN_COLLECTION_IDS_TOKEN } from './hidden-collections.config';

const href = (id: string) =>
  `/nde/collectionDiscovery?collectionId=${id}&lang=he&vid=972TAU_INST%3ANDE`;

function card(id: string): HTMLElement {
  const el = document.createElement('nde-collection-discovery-gallery-collection');
  el.innerHTML = `<div class="collection-grid-card">
      <a class="thumbnail-container" href="${href(id)}"></a>
      <h3><a class="collection-title" href="${href(id)}">${id}</a></h3>
    </div>`;
  return el;
}

/**
 * The observer callback runs as a microtask and schedules the pass for the
 * next animation frame; waiting two frames is enough for it to have run.
 */
const twoFrames = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

describe('CollectionDiscoveryFilterComponent', () => {
  let gallery: HTMLElement;
  let grid: HTMLElement;
  let fixture: ComponentFixture<CollectionDiscoveryFilterComponent> | undefined;

  /**
   * Mounts the component the way the host's `-top` slot does: as the first
   * child of <nde-collection-discovery-gallery>, ahead of the grid.
   */
  async function mount(ids: string[], insideGallery = true): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CollectionDiscoveryFilterComponent],
      providers: [{ provide: HIDDEN_COLLECTION_IDS_TOKEN, useValue: ids }],
    }).compileComponents();
    fixture = TestBed.createComponent(CollectionDiscoveryFilterComponent);
    if (insideGallery) {
      gallery.prepend(fixture.nativeElement);
    }
    fixture.detectChanges(); // first change detection runs ngAfterViewInit
  }

  beforeEach(() => {
    gallery = document.createElement(GALLERY_SELECTOR);
    grid = document.createElement('nde-collection-discovery-grid');
    gallery.appendChild(grid);
    document.body.appendChild(gallery);
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    gallery.remove();
  });

  it('hides a listed card that is already rendered when it mounts', async () => {
    grid.append(card('1'), card('2'));

    await mount(['2']);

    expect(grid.children[0].hasAttribute(HIDDEN_MARKER)).toBeFalse();
    expect(grid.children[1].getAttribute(HIDDEN_MARKER)).toBe('2');
  });

  it('hides a listed card rendered after it mounted', async () => {
    await mount(['3']);

    grid.append(card('3'));
    await twoFrames();

    expect(grid.children[0].getAttribute(HIDDEN_MARKER)).toBe('3');
  });

  it('keeps filtering after the host swaps the grid (navigation into a sub-collection)', async () => {
    await mount(['5']);

    grid.remove();
    const newGrid = document.createElement('nde-collection-discovery-grid');
    newGrid.append(card('4'), card('5'));
    gallery.append(newGrid);
    await twoFrames();

    expect(newGrid.children[0].hasAttribute(HIDDEN_MARKER)).toBeFalse();
    expect(newGrid.children[1].getAttribute(HIDDEN_MARKER)).toBe('5');
  });

  it('stops observing once destroyed', async () => {
    await mount(['6']);
    fixture!.destroy();

    grid.append(card('6'));
    await twoFrames();

    expect(grid.children[0].hasAttribute(HIDDEN_MARKER)).toBeFalse();
  });

  it('is inert when the list is empty', async () => {
    grid.append(card('1'));

    await mount([]);
    grid.append(card('1'));
    await twoFrames();

    expect(gallery.querySelectorAll(`[${HIDDEN_MARKER}]`).length).toBe(0);
  });

  it('is inert, and does not throw, when mounted outside a gallery', async () => {
    grid.append(card('1'));

    await expectAsync(mount(['1'], false)).toBeResolved();

    expect(grid.children[0].hasAttribute(HIDDEN_MARKER)).toBeFalse();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/custom1-module/collection-discovery-filter/collection-discovery-filter.component.spec.ts'
```
Expected: the build fails with `Cannot find module './collection-discovery-filter.component'`.

- [ ] **Step 3: Write the component**

Create `src/app/custom1-module/collection-discovery-filter/collection-discovery-filter.component.ts`:

```ts
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
} from '@angular/core';
import { dlog, dwarn } from '../../services/debug.util';
import { applyCollectionFilter } from './collection-filter';
import { HIDDEN_COLLECTION_IDS_TOKEN } from './hidden-collections.config';

/** The host element that wraps the card grid, on the lobby and on every collection page. */
export const GALLERY_SELECTOR = 'nde-collection-discovery-gallery';

/**
 * Collection Discovery filter.
 *
 * Hides the cards of the collections listed in `HIDDEN_COLLECTION_IDS` on
 * /nde/collectionDiscovery — the lobby and every sub-collection page — in
 * every UI language.
 *
 * Mounted at the `nde-collection-discovery-gallery-top` slot. It renders
 * nothing; its host element exists only so `closest(GALLERY_SELECTOR)` can
 * find the gallery this instance filters. The host re-renders the grid under
 * that same gallery when the user drills into a collection, searches within
 * the page, pages, or switches language, so a MutationObserver on the gallery
 * is what keeps the filter applied. Passes are coalesced through
 * requestAnimationFrame and run outside the Angular zone, so a burst of DOM
 * mutations costs one pass and triggers no change detection.
 *
 * Design: docs/superpowers/specs/2026-09-07-collection-discovery-filter-design.md
 */
@Component({
  selector: 'tau-collection-discovery-filter',
  standalone: true,
  template: '',
  styles: [':host { display: none; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionDiscoveryFilterComponent implements AfterViewInit, OnDestroy {
  private readonly hiddenIds: ReadonlySet<string> = new Set(inject(HIDDEN_COLLECTION_IDS_TOKEN));
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ngZone = inject(NgZone);

  private root: Element | null = null;
  private observer: MutationObserver | null = null;
  private pendingFrame: number | null = null;

  ngAfterViewInit(): void {
    this.root = this.elementRef.nativeElement.closest(GALLERY_SELECTOR);
    if (!this.root) {
      dwarn(`[CollectionDiscoveryFilter] no ${GALLERY_SELECTOR} ancestor; filter inactive`);
      return;
    }
    if (this.hiddenIds.size === 0) {
      dlog('[CollectionDiscoveryFilter] no collection IDs configured; filter inactive');
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.applyNow();
      // childList + subtree only: the pass itself changes attributes and
      // styles, and observing those would make every pass schedule another.
      this.observer = new MutationObserver(() => this.scheduleApply());
      this.observer.observe(this.root!, { childList: true, subtree: true });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.pendingFrame !== null) {
      cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
    }
    this.root = null;
  }

  /** Coalesces any number of mutations in one frame into a single pass. */
  private scheduleApply(): void {
    if (this.pendingFrame !== null) {
      return;
    }
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = null;
      this.applyNow();
    });
  }

  private applyNow(): void {
    if (!this.root) {
      return;
    }
    const hidden = applyCollectionFilter(this.root, this.hiddenIds);
    dlog(`[CollectionDiscoveryFilter] pass complete; ${hidden} card(s) hidden`);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/custom1-module/collection-discovery-filter/*.spec.ts'
```
Expected: `TOTAL: 16 SUCCESS` (10 from Task 1 + 6 here).

- [ ] **Step 5: Commit**

```bash
git add src/app/custom1-module/collection-discovery-filter/collection-discovery-filter.component.ts \
        src/app/custom1-module/collection-discovery-filter/collection-discovery-filter.component.spec.ts
git commit -m "feat(collection-discovery-filter): observer component mounted in the gallery"
```

---

### Task 4: Register the slot and claim the folder

**Files:**
- Modify: `src/app/custom1-module/customComponentMappings.ts` (imports at lines 1-5; map entries after the `nde-header-before` entry, before the disabled ILL sorter line)
- Modify: `.upstream-sync/owned-files.json` (insert a category after `external-search-integration`, i.e. after its closing `},` around line 41)

**Interfaces:**
- Consumes: `CollectionDiscoveryFilterComponent` from Task 3.
- Produces: the slot mapping the host reads at boot; nothing for later tasks.

- [ ] **Step 1: Add the import and the map entry**

In `src/app/custom1-module/customComponentMappings.ts`, after the `AnnouncementBannerComponent` import add:

```ts
import { CollectionDiscoveryFilterComponent } from './collection-discovery-filter/collection-discovery-filter.component';
```

After the `['nde-header-before', AnnouncementBannerComponent],` entry (and its comment block), before the disabled ILL-sorter comment, add:

```ts
  // Collection Discovery filter — hides configured collections by ID at every
  // level of /nde/collectionDiscovery, in every language. Renders nothing; it
  // uses the slot only to reach <nde-collection-discovery-gallery> and observe
  // it. The host applies its custom-slot directive to the gallery (seen in its
  // bootstrap bundle on 2026-09-07); the slot rendering live is verified in
  // docs/features/collection-discovery-filter.md.
  ['nde-collection-discovery-gallery-top', CollectionDiscoveryFilterComponent],
```

- [ ] **Step 2: Claim the folder for upstream sync**

In `.upstream-sync/owned-files.json`, after the `external-search-integration` category (after its closing `},`), add:

```json
    "collection-discovery-filter": {
      "risk": "medium",
      "description": "Hides configured collections by ID on the Collection Discovery page (observer on the host gallery)",
      "files": [
        "src/app/custom1-module/collection-discovery-filter/**"
      ]
    },
```

Check the file is still valid JSON:
```bash
node -e "JSON.parse(require('fs').readFileSync('.upstream-sync/owned-files.json','utf8')); console.log('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Compile the whole module**

Run:
```bash
npx ng build 2>&1 | tail -5
```
Expected: `Build at: ...` with no errors. (Use `npx ng build`, not `npm run build`: the npm script's `postbuild.js` archives a throwaway package to `~/tau-packages/`.)

- [ ] **Step 4: Run the full test suite**

Run:
```bash
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -3
```
Expected: `TOTAL: N SUCCESS`, no failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/custom1-module/customComponentMappings.ts .upstream-sync/owned-files.json
git commit -m "feat(collection-discovery-filter): mount at nde-collection-discovery-gallery-top; claim the folder"
```

---

### Task 5: Verify the slot live through the dev proxy

This is the step that proves the mount point. Nothing in a unit test can. Do it with the Playwright MCP tools when available; otherwise in a browser by hand. The IDs below are real collections on the production view, chosen because one is a lobby card and one is a sub-collection card.

**Files:**
- Temporarily modify (do NOT commit): `src/app/custom1-module/collection-discovery-filter/hidden-collections.config.ts`
- Possibly modify (only on fallback): `src/app/custom1-module/customComponentMappings.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: the verification date and outcome that Task 6 writes into the docs.

- [ ] **Step 1: Put two real IDs in the list, temporarily**

Edit `HIDDEN_COLLECTION_IDS` to:

```ts
export const HIDDEN_COLLECTION_IDS: readonly string[] = [
  '81429943170004146', // lobby card — The Reconstructed Trademark Registry of Mandatory Palestine
  '81265778720004146', // sub-collection of Archives (81358236510004146) — The Online Wiener Archive
];
```

- [ ] **Step 2: Start the proxy**

Run in the background (from the worktree root):
```bash
npm run start:proxy
```
Wait for `Compiled successfully` / the dev server listening on `http://localhost:4200`. The proxy targets the live host (`proxy/proxy.const.mjs` → `tau`); the view is whatever `build-settings.env` says (`NDE_TEST` by default, which mirrors `NDE`).

- [ ] **Step 3: Lobby check**

Open `http://localhost:4200/nde/collectionDiscovery?vid=972TAU_INST:NDE_TEST&lang=he`.

Verify, in this order:
1. The console shows the boot banner `[TAU] custom module · ...`, and (debug is ON by default on `NDE_TEST`) `Total components to register: 5` — one more than before this feature.
2. `document.querySelector('tau-collection-discovery-filter')` is non-null and its parent is `<nde-collection-discovery-gallery>`. If it is null, the slot did not render — go to Step 7.
3. The console shows `[CollectionDiscoveryFilter] pass complete; 1 card(s) hidden`.
4. `document.querySelectorAll('nde-collection-discovery-gallery-collection').length` is 14 and `document.querySelectorAll('[data-tau-hidden-collection]').length` is 1; the Trademark Registry card is not visible.

- [ ] **Step 4: Sub-collection check (recursion)**

Click the "ארכיונים" (Archives) card, or open `http://localhost:4200/nde/collectionDiscovery?collectionId=81358236510004146&vid=972TAU_INST:NDE_TEST&lang=he`.

Verify: six sub-collection cards exist in the DOM, one carries `data-tau-hidden-collection="81265778720004146"`, and the Online Wiener Archive card is not visible. The host prints "Showing 6 of 6 results" (accepted stale count, spec D1).

- [ ] **Step 5: Language switch and navigation back**

Switch the UI language to English from the header menu (no reload). Verify the same card stays hidden and the console shows a new `pass complete` line. Use the breadcrumbs to return to the lobby; verify the Trademark Registry card is still hidden.

- [ ] **Step 6: Remove the temporary IDs**

Restore `HIDDEN_COLLECTION_IDS` to the empty list with the commented example, exactly as written in Task 2. Confirm with `git diff --stat` that the config file shows no changes. Stop the proxy.

- [ ] **Step 7: Only if the slot did not render — fall back**

Change the map key in `customComponentMappings.ts` to `nde-collection-discovery-grid-top` and repeat Steps 3-5; if that also fails, `nde-collection-discovery-gallery-before` (then the observed root is still found by `closest`, because `-before` places the element as a sibling *inside the gallery's parent* — in that case change `GALLERY_SELECTOR` handling in the component to `this.elementRef.nativeElement.parentElement?.querySelector(GALLERY_SELECTOR) ?? closest(...)`, add a test for it, and commit). Record which key worked in the mapping comment and in the feature doc.

- [ ] **Step 8: Commit only if the fallback changed code**

```bash
git add src/app/custom1-module/customComponentMappings.ts src/app/custom1-module/collection-discovery-filter/
git commit -m "fix(collection-discovery-filter): mount at <slot that rendered>"
```
If Step 7 was not needed, there is nothing to commit in this task.

---

### Task 6: Documentation

**Files:**
- Create: `docs/features/collection-discovery-filter.md`
- Modify: `README.md` — the add-ons summary table (around line 20, after the Announcement Banner row), the add-ons section (insert "### 4. Collection Discovery Filter" before `## 🎨 CSS & Styling Tweaks`, around line 224), and the docs index (after the "NDE Embedded Search Box" entry, around line 632)

**Interfaces:**
- Consumes: the verification date and slot outcome from Task 5.
- Produces: nothing for code.

- [ ] **Step 1: Write the feature doc**

Create `docs/features/collection-discovery-filter.md` (replace `<verification date>` and `<slot>` with what Task 5 established):

```markdown
# Collection Discovery filter: hide collections by ID

**Status:** built; ships with an empty list until the library supplies the IDs to hide.
**Design:** [`docs/superpowers/specs/2026-09-07-collection-discovery-filter-design.md`](../superpowers/specs/2026-09-07-collection-discovery-filter-design.md)

## The request

Hide chosen digital collections from `/nde/collectionDiscovery`, keyed on the
collection ID in each card's link, at every nesting level (the lobby, a
collection's sub-collections, their sub-collections…), in both UI languages,
as a standalone component.

## What the host renders (verified 2026-09-07, he + en)

- Every card at every level is one `<nde-collection-discovery-gallery-collection>`
  wrapping two anchors (thumbnail and title) whose href is
  `/nde/collectionDiscovery?collectionId=<id>&lang=<he|en>&vid=…`.
  The ID is the same in both languages; only `lang` differs.
- All cards sit under one `<nde-collection-discovery-gallery>`, present on the
  lobby and on every collection page. Drilling into a collection re-renders
  the grid under the same gallery.
- The lobby loads `myaccount/collection?name=get_collections`; collection pages
  load a `pnxs` search with `q=cdparentid,exact,<id>&isCDSearch=true`.
  Neither is interceptable from the custom module, so the DOM is the layer.
- The host applies its custom-slot directive to the gallery, so
  `nde-collection-discovery-gallery-top` is a valid mount point.
  Confirmed live through the dev proxy on <verification date> (mounted at `<slot>`).

## How it works

`CollectionDiscoveryFilterComponent` mounts at `<slot>`, renders nothing
(`:host { display: none }`), finds the gallery with `closest()`, runs one pass,
and keeps a `MutationObserver` (`childList` + `subtree`) on it. A pass walks
every card under the gallery, parses `collectionId` from the card's link with
`URL.searchParams`, hides matches with `display: none !important` plus the
marker `data-tau-hidden-collection="<id>"`, and restores marked cards that no
longer match. Passes are coalesced through `requestAnimationFrame` and run
outside the Angular zone. Depth never matters: every level is the same card
component under the same gallery, and the pass queries the whole subtree.

The pure logic is `collection-filter.ts` (`readCollectionId`,
`applyCollectionFilter`); the component only decides when to run it.

## Adding or removing an ID

1. Open the collection in Primo. The address bar reads
   `…/collectionDiscovery?collectionId=<id>&…`; copy the number.
2. Add it to `HIDDEN_COLLECTION_IDS` in
   `src/app/custom1-module/collection-discovery-filter/hidden-collections.config.ts`,
   with a comment naming the collection.
3. `npm run build`, then upload the package (see the README's deploy steps).
   Fill in the `note` column in `~/tau-packages/MANIFEST.tsv` on upload.

Hiding a parent hides its card; its descendants only appear on the parent's
own page, which the UI no longer links to. To hide a sub-collection while its
parent stays visible, list the sub-collection's own ID.

## Verification (dev proxy)

With two real IDs in the list — a lobby card and a sub-collection card —
through `npm run start:proxy`:

1. Lobby: console shows `Total components to register: 5` and
   `[CollectionDiscoveryFilter] pass complete; 1 card(s) hidden`;
   `document.querySelector('tau-collection-discovery-filter').parentElement`
   is the gallery; the card is gone, the other 13 are unchanged.
2. Archives (`collectionId=81358236510004146`): six sub-collection cards in the
   DOM, one marked hidden and invisible.
3. Switch language in-app: still hidden, a new `pass complete` line.
4. Breadcrumbs back to the lobby: still hidden.

Unit tests: `npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/custom1-module/collection-discovery-filter/*.spec.ts'`.

## Known limitations

- **Stale count.** Collection pages print "Showing N of N results" from the
  host's own data; after hiding, fewer cards show than the line says.
  Accepted in the design (D1); patching host text is fragile.
- **Direct links still work.** A hidden collection is hidden, not
  access-controlled. Removing it from search and facets is an Alma-side change.
- **Host markup can change.** The two host selectors are constants at the top
  of `collection-filter.ts` and the component; upstream sync flags the folder
  (`.upstream-sync/owned-files.json`, category `collection-discovery-filter`).

## Turning it off

Remove the map entry in `src/app/custom1-module/customComponentMappings.ts`,
or empty `HIDDEN_COLLECTION_IDS` — with an empty list the component mounts and
attaches no observer.
```

- [ ] **Step 2: Add the README summary row**

In `README.md`, in the "🧩 Add-ons & components" table, after the Announcement Banner row, add:

```markdown
| **Collection Discovery Filter** | 🚧 Built — awaiting the ID list and a package upload | Hides chosen digital collections (by collection ID) from the Collection Discovery page at every nesting level, in both languages |
```

- [ ] **Step 3: Add the README add-on section**

In `README.md`, immediately before `## 🎨 CSS & Styling Tweaks`, add (replace `<verification date>` and `<slot>`):

```markdown
### 4. Collection Discovery Filter
**Status:** 🚧 Built — ships with an empty list until the library supplies the IDs to hide
**Date Implemented:** 07.09.26

Hides chosen digital collections from the **Collection Discovery** page (`/nde/collectionDiscovery`),
keyed on the collection ID in each card's link. Works on the lobby and on every sub-collection page,
at any depth, in Hebrew and English, and follows in-app navigation and language switches without a reload.

**Implemented Features:**
- ✅ **One list of IDs** in `hidden-collections.config.ts`; each entry hides that collection's card wherever it appears
- ✅ **Any depth, no per-level code**: every level is the same host card component under the same gallery, and the filter re-walks the whole gallery on every DOM change
- ✅ **Language-independent by construction**: the ID is parsed from the link's `collectionId` query parameter, never from text
- ✅ **Reversible and idempotent**: hidden cards carry `data-tau-hidden-collection="<id>"`; a marked card whose link no longer matches is restored
- ✅ **Cheap**: passes are coalesced through `requestAnimationFrame` and run outside the Angular zone; with an empty list the component attaches nothing

**Location in NDE:** the `<slot>` extension slot inside `<nde-collection-discovery-gallery>`, verified live through
the dev proxy on <verification date>. The component renders nothing; the slot only gives it a foothold from which to
find and observe the gallery.

**Known limitations:** the host's "Showing N of N results" line on collection pages keeps the host's number
(accepted in the design); a direct link to a hidden collection still opens it — this is a display filter, not access control.

**Technical Details:**
- Component: `CollectionDiscoveryFilterComponent` (standalone, `OnPush`, renders nothing)
- Pure logic: `collection-filter.ts` — `readCollectionId`, `applyCollectionFilter`
- Selector mapping: `<slot>`
- Files: `src/app/custom1-module/collection-discovery-filter/`
- Tests: `collection-filter.spec.ts` (hide / restore / depth / parameter order / idempotence), `collection-discovery-filter.component.spec.ts` (mount, late render, grid swap, destroy, inert cases)
- Docs: [`docs/features/collection-discovery-filter.md`](docs/features/collection-discovery-filter.md) · design spec `docs/superpowers/specs/2026-09-07-collection-discovery-filter-design.md`

---

```

- [ ] **Step 4: Add the README docs-index entry**

In `README.md`, under "### Feature Documentation", after the "NDE Embedded Search Box" block, add:

```markdown
#### Collection Discovery Filter
- **[Collection Discovery Filter](docs/features/collection-discovery-filter.md)** - Hide chosen digital collections by ID at every level of the Collection Discovery page; how to add an ID, verification, limitations
```

- [ ] **Step 5: Check the links resolve**

Run:
```bash
test -f docs/features/collection-discovery-filter.md && test -f docs/superpowers/specs/2026-09-07-collection-discovery-filter-design.md && grep -c "collection-discovery-filter" README.md
```
Expected: a count of at least 4.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/features/collection-discovery-filter.md
git commit -m "docs(collection-discovery-filter): feature doc and README entries"
```

---

## Self-review

**Spec coverage.** §4.1 mount → Task 4 + Task 5 (fallbacks in Task 5 Step 7). §4.2 matching → Task 1 (`readCollectionId`). §4.3 hiding/marker → Task 1 (`applyCollectionFilter`). §4.4 observer, rAF, zone, destroy → Task 3. §4.5 depth → Task 1 depth test, Task 5 Step 4. §4.6 config → Task 2. §4.7 logging → Task 3 (`dlog` once per pass). §4.8 files → Tasks 1-4, 6. §5 error handling: no gallery → Task 3 (`dwarn`, inert test); malformed href → Task 1 (`readCollectionId` try/catch, no-link test); empty list → Task 3 (inert test, observer skipped). §6 testing → Tasks 1, 3, 5. §7 risks → documented in Task 6. §8 rollout is manual and outside this plan (build + upload after the ID list arrives).

**Placeholders.** `<verification date>` and `<slot>` in Task 6 are deliberate: they are filled from Task 5's outcome, and Task 6 says so.

**Type consistency.** `applyCollectionFilter(root: ParentNode, hiddenIds: ReadonlySet<string>): number` is used with the same signature in Task 3; `HIDDEN_MARKER` is the same string in Tasks 1 and 3; `GALLERY_SELECTOR` is exported from the component file and imported by its spec; `HIDDEN_COLLECTION_IDS_TOKEN` is `InjectionToken<readonly string[]>` and the component wraps it in a `Set`.
