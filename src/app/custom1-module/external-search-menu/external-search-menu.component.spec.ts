import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ExternalSearchMenuComponent } from './external-search-menu.component';
import { SearchQueryService } from '../filter-assist-panel/services/search-query.service';
import { SearchQuery } from '../filter-assist-panel/models/search-target.model';

describe('ExternalSearchMenuComponent', () => {
  let fixture: ComponentFixture<ExternalSearchMenuComponent>;
  let component: ExternalSearchMenuComponent;
  let searchQueryService: jasmine.SpyObj<SearchQueryService>;
  let originalLang: string | null;

  const query = (term: string): SearchQuery => ({
    queries: [`any,contains,${term},AND`],
    filters: [],
    searchTerm: term,
  });
  const noQuery: SearchQuery = { queries: [], filters: [], searchTerm: '' };

  const el = (): HTMLElement => fixture.nativeElement;
  const trigger = () => el().querySelector<HTMLButtonElement>('.tau-xsearch__trigger');
  const items = () => Array.from(el().querySelectorAll<HTMLAnchorElement>('.tau-xsearch__item'));

  function create(lang: 'en' | 'he', data: SearchQuery): void {
    document.documentElement.setAttribute('lang', lang);
    searchQueryService.getSearchData.and.returnValue(data);
    fixture = TestBed.createComponent(ExternalSearchMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    originalLang = document.documentElement.getAttribute('lang');
    searchQueryService = jasmine.createSpyObj('SearchQueryService', ['getSearchData']);
    await TestBed.configureTestingModule({
      imports: [ExternalSearchMenuComponent],
      providers: [{ provide: SearchQueryService, useValue: searchQueryService }],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    if (originalLang === null) {
      document.documentElement.removeAttribute('lang');
    } else {
      document.documentElement.setAttribute('lang', originalLang);
    }
  });

  it('renders nothing when the URL holds no search query', () => {
    create('en', noQuery);
    expect(trigger()).toBeNull();
  });

  it('renders the globe button, closed, when a search was made', () => {
    create('en', query('agnon'));
    expect(trigger()).not.toBeNull();
    expect(trigger()!.getAttribute('aria-expanded')).toBe('false');
    expect(items().length).toBe(0);
  });

  it('opens a menu of every source, linking the current query', fakeAsync(() => {
    create('en', query('agnon'));
    trigger()!.click();
    fixture.detectChanges();
    tick();

    expect(trigger()!.getAttribute('aria-expanded')).toBe('true');
    expect(items().length).toBe(component.externalSources.length);
    expect(items()[2].href).toBe('https://scholar.google.com/scholar?q=agnon');
    expect(items().every((a) => a.target === '_blank')).toBeTrue();
  }));

  it('re-reads the query on open, so an in-app search is not stale', fakeAsync(() => {
    create('en', query('agnon'));
    searchQueryService.getSearchData.and.returnValue(query('vigo'));
    trigger()!.click();
    fixture.detectChanges();
    tick();

    expect(items()[2].href).toBe('https://scholar.google.com/scholar?q=vigo');
  }));

  it('is right-to-left with Hebrew names in Hebrew', fakeAsync(() => {
    create('he', query('עגנון'));
    trigger()!.click();
    fixture.detectChanges();
    tick();

    expect(el().querySelector('.tau-xsearch')!.getAttribute('dir')).toBe('rtl');
    expect(items()[2].textContent!.trim()).toBe('גוגל סקולר');
    expect(trigger()!.getAttribute('aria-label')).toBe('חיפוש במקורות חיצוניים');
  }));

  it('anchors the menu to the button edge that matches the direction', () => {
    create('he', query('x'));
    trigger()!.click();
    fixture.detectChanges();
    const menu = el().querySelector<HTMLElement>('.tau-xsearch__menu')!;
    expect(menu.style.right).not.toBe('');
    expect(menu.style.left).toBe('');
  });

  it('closes on Escape and returns focus to the button', fakeAsync(() => {
    create('en', query('agnon'));
    trigger()!.click();
    fixture.detectChanges();
    tick();

    el().querySelector('.tau-xsearch__menu')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(items().length).toBe(0);
    expect(document.activeElement).toBe(trigger());
  }));

  it('closes on a click outside it', fakeAsync(() => {
    create('en', query('agnon'));
    trigger()!.click();
    fixture.detectChanges();
    tick();

    document.body.click();
    fixture.detectChanges();

    expect(items().length).toBe(0);
  }));
});
