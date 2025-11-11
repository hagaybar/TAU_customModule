import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoResultsExternalLinksComponent } from './no-results-external-links.component';
import { SearchQueryService } from '../filter-assist-panel/services/search-query.service';
import { SearchQuery } from '../filter-assist-panel/models/search-target.model';

describe('NoResultsExternalLinksComponent', () => {
  let component: NoResultsExternalLinksComponent;
  let fixture: ComponentFixture<NoResultsExternalLinksComponent>;
  let mockSearchQueryService: jasmine.SpyObj<SearchQueryService>;

  beforeEach(async () => {
    const serviceSpy = jasmine.createSpyObj('SearchQueryService', [
      'getCurrentLanguage',
      'getSearchData'
    ]);

    await TestBed.configureTestingModule({
      imports: [ NoResultsExternalLinksComponent ], // standalone component
      providers: [
        { provide: SearchQueryService, useValue: serviceSpy }
      ]
    }).compileComponents();

    mockSearchQueryService = TestBed.inject(SearchQueryService) as jasmine.SpyObj<SearchQueryService>;
    fixture = TestBed.createComponent(NoResultsExternalLinksComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Initialization', () => {
    it('should initialize with English language', () => {
      mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
      mockSearchQueryService.getSearchData.and.returnValue({
        queries: ['any,contains,test,AND'],
        filters: [],
        searchTerm: 'test'
      });

      component.ngOnInit();

      expect(component.currentLanguage).toBe('en');
      expect(mockSearchQueryService.getCurrentLanguage).toHaveBeenCalled();
    });

    it('should initialize with Hebrew language', () => {
      mockSearchQueryService.getCurrentLanguage.and.returnValue('he');
      mockSearchQueryService.getSearchData.and.returnValue({
        queries: ['any,contains,בדיקה,AND'],
        filters: [],
        searchTerm: 'בדיקה'
      });

      component.ngOnInit();

      expect(component.currentLanguage).toBe('he');
    });

    it('should extract search data from service', () => {
      const mockSearchData: SearchQuery = {
        queries: ['any,contains,quantum physics,AND'],
        filters: ['pfilter=rtype,exact,books'],
        searchTerm: 'quantum physics'
      };

      mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
      mockSearchQueryService.getSearchData.and.returnValue(mockSearchData);

      component.ngOnInit();

      expect(component.searchData).toEqual(mockSearchData);
      expect(mockSearchQueryService.getSearchData).toHaveBeenCalled();
    });
  });

  describe('Language and Direction', () => {
    it('should return LTR direction for English', () => {
      component.currentLanguage = 'en';
      expect(component.textDirection).toBe('ltr');
    });

    it('should return RTL direction for Hebrew', () => {
      component.currentLanguage = 'he';
      expect(component.textDirection).toBe('rtl');
    });

    it('should display English title when language is English', () => {
      component.currentLanguage = 'en';
      expect(component.cardTitle).toBe('Try searching in external sources');
    });

    it('should display Hebrew title when language is Hebrew', () => {
      component.currentLanguage = 'he';
      expect(component.cardTitle).toBe('נסה לחפש במקורות חיצוניים');
    });
  });

  describe('URL Building', () => {
    beforeEach(() => {
      mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
      mockSearchQueryService.getSearchData.and.returnValue({
        queries: ['any,contains,quantum physics,AND'],
        filters: [],
        searchTerm: 'quantum physics'
      });
      component.ngOnInit();
    });

    it('should build correct URL for ULI', () => {
      const uliSource = component.externalSources.find(s => s.name === 'ULI');
      expect(uliSource).toBeDefined();

      const url = component.buildExternalUrl(uliSource!);

      expect(url).toContain('uli.nli.org.il');
      expect(url).toContain('quantum');
      expect(url).toContain('tab=ULIC_slot');
    });

    it('should build correct URL for WorldCat', () => {
      const worldcatSource = component.externalSources.find(s => s.name === 'WorldCat');
      expect(worldcatSource).toBeDefined();

      const url = component.buildExternalUrl(worldcatSource!);

      expect(url).toContain('worldcat.org');
      expect(url).toContain('quantum');
    });

    it('should build correct URL for Google Scholar', () => {
      const scholarSource = component.externalSources.find(s => s.name === 'Google Scholar');
      expect(scholarSource).toBeDefined();

      const url = component.buildExternalUrl(scholarSource!);

      expect(url).toContain('scholar.google.com');
      expect(url).toContain('quantum');
    });

    it('should handle URL building errors gracefully', () => {
      const faultySource: any = {
        name: 'Faulty',
        url: 'https://example.com?q=',
        mapping: () => { throw new Error('Test error'); }
      };

      component.searchData.searchTerm = 'test search';
      const url = component.buildExternalUrl(faultySource);

      // Should fall back to simple search term
      expect(url).toContain('example.com');
      expect(url).toContain('test');
    });

    it('should encode special characters in search terms', () => {
      component.searchData = {
        queries: ['any,contains,test & special,AND'],
        filters: [],
        searchTerm: 'test & special'
      };

      const source = component.externalSources[0];
      const url = component.buildExternalUrl(source);

      // URL should not contain raw special characters
      expect(url).not.toContain('&');
      expect(url).toContain('%');
    });
  });

  describe('Source Name Localization', () => {
    it('should return English name when language is English', () => {
      component.currentLanguage = 'en';
      const uliSource = component.externalSources.find(s => s.name === 'ULI');

      expect(component.getSourceName(uliSource!)).toBe('ULI');
    });

    it('should return Hebrew name when language is Hebrew', () => {
      component.currentLanguage = 'he';
      const uliSource = component.externalSources.find(s => s.name === 'ULI');

      expect(component.getSourceName(uliSource!)).toBe('הקטלוג המאוחד (ULI)');
    });

    it('should handle all configured sources', () => {
      component.currentLanguage = 'he';

      component.externalSources.forEach(source => {
        const localizedName = component.getSourceName(source);
        expect(localizedName).toBeTruthy();
        expect(localizedName.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Query Validation', () => {
    it('should return true when queries exist', () => {
      component.searchData = {
        queries: ['any,contains,test,AND'],
        filters: [],
        searchTerm: 'test'
      };

      expect(component.hasSearchQuery()).toBe(true);
    });

    it('should return true when search term exists', () => {
      component.searchData = {
        queries: [],
        filters: [],
        searchTerm: 'test'
      };

      expect(component.hasSearchQuery()).toBe(true);
    });

    it('should return false when no queries or search term', () => {
      component.searchData = {
        queries: [],
        filters: [],
        searchTerm: ''
      };

      expect(component.hasSearchQuery()).toBe(false);
    });
  });

  describe('Component Rendering', () => {
    it('should render when search query exists', () => {
      mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
      mockSearchQueryService.getSearchData.and.returnValue({
        queries: ['any,contains,test,AND'],
        filters: [],
        searchTerm: 'test'
      });

      component.ngOnInit();
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.no-results-external-links');
      expect(container).toBeTruthy();
    });

    it('should not render when no search query', () => {
      mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
      mockSearchQueryService.getSearchData.and.returnValue({
        queries: [],
        filters: [],
        searchTerm: ''
      });

      component.ngOnInit();
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.no-results-external-links');
      expect(container).toBeFalsy();
    });

    it('should render all external sources as links', () => {
      mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
      mockSearchQueryService.getSearchData.and.returnValue({
        queries: ['any,contains,test,AND'],
        filters: [],
        searchTerm: 'test'
      });

      component.ngOnInit();
      fixture.detectChanges();

      const links = fixture.nativeElement.querySelectorAll('.link');
      expect(links.length).toBe(component.externalSources.length);
    });

    it('should set correct direction attribute for RTL', () => {
      mockSearchQueryService.getCurrentLanguage.and.returnValue('he');
      mockSearchQueryService.getSearchData.and.returnValue({
        queries: ['any,contains,test,AND'],
        filters: [],
        searchTerm: 'test'
      });

      component.ngOnInit();
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.no-results-external-links');
      expect(container.getAttribute('dir')).toBe('rtl');
    });

    it('should render card title', () => {
      mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
      mockSearchQueryService.getSearchData.and.returnValue({
        queries: ['any,contains,test,AND'],
        filters: [],
        searchTerm: 'test'
      });

      component.ngOnInit();
      fixture.detectChanges();

      const title = fixture.nativeElement.querySelector('.card-title');
      expect(title).toBeTruthy();
      expect(title.textContent).toContain('Try searching in external sources');
    });

    it('should render links with target="_blank"', () => {
      mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
      mockSearchQueryService.getSearchData.and.returnValue({
        queries: ['any,contains,test,AND'],
        filters: [],
        searchTerm: 'test'
      });

      component.ngOnInit();
      fixture.detectChanges();

      const links = fixture.nativeElement.querySelectorAll('.link');
      links.forEach((link: HTMLAnchorElement) => {
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      });
    });
  });

  describe('External Sources Configuration', () => {
    it('should load external sources from config', () => {
      expect(component.externalSources).toBeDefined();
      expect(component.externalSources.length).toBeGreaterThan(0);
    });

    it('should have required properties for each source', () => {
      component.externalSources.forEach(source => {
        expect(source.name).toBeDefined();
        expect(source.nameHe).toBeDefined();
        expect(source.url).toBeDefined();
        expect(source.img).toBeDefined();
        expect(source.alt).toBeDefined();
        expect(typeof source.mapping).toBe('function');
      });
    });
  });
});
