import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnouncementBannerComponent } from './announcement-banner.component';

describe('AnnouncementBannerComponent', () => {
  let fixture: ComponentFixture<AnnouncementBannerComponent>;
  let component: AnnouncementBannerComponent;

  const createComponent = () => {
    fixture = TestBed.createComponent(AnnouncementBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    localStorage.removeItem('tauAnnouncementDismissed:v1');
    await TestBed.configureTestingModule({
      imports: [AnnouncementBannerComponent],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem('tauAnnouncementDismissed:v1');
  });

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('defaults to English and LTR when no lang parameter is present', () => {
    createComponent();
    expect(component.currentLanguage).toBe('en');
    expect(component.textDirection).toBe('ltr');
  });

  it('renders the banner with role="status" so screen readers announce it', () => {
    createComponent();
    const banner: HTMLElement = fixture.nativeElement.querySelector('.tau-announcement');
    expect(banner).toBeTruthy();
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.getAttribute('dir')).toBe('ltr');
  });

  it('exposes an accessibly-named dismiss button', () => {
    createComponent();
    const button: HTMLElement = fixture.nativeElement.querySelector('.tau-announcement__dismiss');
    expect(button).toBeTruthy();
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('aria-label')).toBe(component.dismissLabel);
  });

  it('removes the banner from the DOM once dismissed', () => {
    createComponent();
    const button: HTMLElement = fixture.nativeElement.querySelector('.tau-announcement__dismiss');
    button.click();
    fixture.detectChanges();

    expect(component.dismissed).toBeTrue();
    expect(fixture.nativeElement.querySelector('.tau-announcement')).toBeNull();
  });

  it('stays dismissed on the next mount', () => {
    createComponent();
    component.dismiss();

    createComponent();
    expect(component.dismissed).toBeTrue();
    expect(fixture.nativeElement.querySelector('.tau-announcement')).toBeNull();
  });

  describe('Hebrew', () => {
    let search: string;

    beforeEach(() => {
      search = window.location.search;
      history.replaceState(null, '', '?lang=he');
    });

    afterEach(() => {
      history.replaceState(null, '', search || window.location.pathname);
    });

    it('switches to Hebrew text and RTL direction', () => {
      createComponent();
      expect(component.currentLanguage).toBe('he');
      expect(component.textDirection).toBe('rtl');

      const banner: HTMLElement = fixture.nativeElement.querySelector('.tau-announcement');
      expect(banner.getAttribute('dir')).toBe('rtl');
      expect(banner.textContent).toContain('ברוכים הבאים');
      expect(banner.textContent).toContain('דעת"א');
    });
  });

  it('names the service in both languages so patrons recognise it', () => {
    // The whole point of the demo message is continuity — a patron must see the
    // name they already know, not just "welcome to our new site".
    createComponent();
    expect(component.message).toContain('DaTA');

    component.currentLanguage = 'he';
    expect(component.message).toContain('דעת"א');
  });
});
