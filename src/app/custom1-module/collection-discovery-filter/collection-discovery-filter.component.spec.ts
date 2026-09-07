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
