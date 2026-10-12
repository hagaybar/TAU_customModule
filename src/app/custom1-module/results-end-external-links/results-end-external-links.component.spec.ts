import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultsEndExternalLinksComponent } from './results-end-external-links.component';
import { SearchQueryService } from '../filter-assist-panel/services/search-query.service';
import { SearchQuery } from '../filter-assist-panel/models/search-target.model';

describe('ResultsEndExternalLinksComponent', () => {
  let fixture: ComponentFixture<ResultsEndExternalLinksComponent>;
  let searchQueryService: jasmine.SpyObj<SearchQueryService>;
  let originalLang: string | null;

  const query = (term: string): SearchQuery => ({
    queries: [`any,contains,${term},AND`],
    filters: [],
    searchTerm: term,
  });
  const noQuery: SearchQuery = { queries: [], filters: [], searchTerm: '' };

  const el = (): HTMLElement => fixture.nativeElement;
  const section = () => el().querySelector<HTMLElement>('.tau-results-end');
  const links = () => Array.from(el().querySelectorAll<HTMLAnchorElement>('.tau-results-end__link'));

  function create(lang: 'en' | 'he', data: SearchQuery): void {
    document.documentElement.setAttribute('lang', lang);
    searchQueryService.getSearchData.and.returnValue(data);
    fixture = TestBed.createComponent(ResultsEndExternalLinksComponent);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    originalLang = document.documentElement.getAttribute('lang');
    searchQueryService = jasmine.createSpyObj('SearchQueryService', ['getSearchData']);
    await TestBed.configureTestingModule({
      imports: [ResultsEndExternalLinksComponent],
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
    expect(section()).toBeNull();
  });

  it('offers every source with the current query, in a new window', () => {
    create('en', query('agnon'));
    expect(section()!.textContent).toContain("Didn't find what you were looking for?");
    expect(links().length).toBe(3);
    expect(links()[2].href).toBe('https://scholar.google.com/scholar?q=agnon');
    expect(links().every((a) => a.target === '_blank')).toBeTrue();
  });

  it('rebuilds the links from the URL before a click, so an in-app search is not stale', () => {
    create('en', query('agnon'));
    searchQueryService.getSearchData.and.returnValue(query('vigo'));
    section()!.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(links()[2].href).toBe('https://scholar.google.com/scholar?q=vigo');
  });

  it('is right-to-left with Hebrew text in Hebrew', () => {
    create('he', query('עגנון'));
    expect(section()!.getAttribute('dir')).toBe('rtl');
    expect(section()!.textContent).toContain('לא מצאתם את מה שחיפשתם?');
    expect(links()[2].textContent!.trim()).toBe('גוגל סקולר');
  });
});
