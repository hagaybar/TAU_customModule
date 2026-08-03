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

  // The component reads <html lang>/<dir> first, so tests must control them
  // rather than inherit whatever the Karma page happens to carry.
  let originalLang: string | null;
  let originalDir: string | null;

  beforeEach(async () => {
    localStorage.removeItem('tauAnnouncementDismissed:v2');
    originalLang = document.documentElement.getAttribute('lang');
    originalDir = document.documentElement.getAttribute('dir');
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');

    await TestBed.configureTestingModule({
      imports: [AnnouncementBannerComponent],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem('tauAnnouncementDismissed:v2');
    const restore = (attr: string, value: string | null) =>
      value === null
        ? document.documentElement.removeAttribute(attr)
        : document.documentElement.setAttribute(attr, value);
    restore('lang', originalLang);
    restore('dir', originalDir);
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
      expect(banner.textContent).toContain('דעת״א');
    });
  });

  describe('in-app language switch', () => {
    // The banner mounts at nde-header-before — OUTSIDE the router outlet — so it
    // is never destroyed when the user switches language in-app. ngOnInit runs
    // once, at first paint. Verified live: the host rewrites <html lang>/<dir>
    // on every switch, but does NOT fire popstate (the router uses pushState),
    // and the component node survives the switch untouched.
    //
    // These tests deliberately never re-create the fixture — re-creating it
    // would hide the bug, because a fresh mount re-reads the language.

    /** MutationObserver callbacks are async; let the microtask queue drain. */
    const flush = () => new Promise<void>(resolve => setTimeout(resolve));

    it('follows a switch from English to Hebrew without being re-created', async () => {
      createComponent();
      expect(component.currentLanguage).toBe('en');

      document.documentElement.setAttribute('lang', 'he');
      document.documentElement.setAttribute('dir', 'rtl');
      await flush();
      fixture.detectChanges();

      expect(component.currentLanguage).toBe('he');
      const banner: HTMLElement = fixture.nativeElement.querySelector('.tau-announcement');
      expect(banner.getAttribute('dir')).toBe('rtl');
      expect(banner.textContent).toContain('ברוכים הבאים');
    });

    it('follows a switch back from Hebrew to English', async () => {
      document.documentElement.setAttribute('lang', 'he');
      createComponent();
      expect(component.currentLanguage).toBe('he');

      document.documentElement.setAttribute('lang', 'en');
      document.documentElement.setAttribute('dir', 'ltr');
      await flush();
      fixture.detectChanges();

      expect(component.currentLanguage).toBe('en');
      const banner: HTMLElement = fixture.nativeElement.querySelector('.tau-announcement');
      expect(banner.getAttribute('dir')).toBe('ltr');
      expect(banner.textContent).toContain('DaTA');
    });

    it('stops observing once destroyed', async () => {
      createComponent();
      fixture.destroy();

      document.documentElement.setAttribute('lang', 'he');
      await flush();

      // No throw, and no state change after teardown.
      expect(component.currentLanguage).toBe('en');
    });
  });

  describe('language source precedence', () => {
    it('prefers <html lang> over the URL parameter', () => {
      // Once the host has stamped <html lang>, it is authoritative — it is the
      // attribute that actually tracks in-app switches.
      document.documentElement.setAttribute('lang', 'he');
      createComponent();
      expect(component.currentLanguage).toBe('he');
    });

    it('treats he_IL as Hebrew', () => {
      document.documentElement.setAttribute('lang', 'he_IL');
      createComponent();
      expect(component.currentLanguage).toBe('he');
    });

    it('falls back to dir=rtl when no lang is set anywhere', () => {
      // Mirrors custom.css's html:not([lang])[dir="rtl"] fallback.
      document.documentElement.setAttribute('dir', 'rtl');
      createComponent();
      expect(component.currentLanguage).toBe('he');
    });
  });

  it('names the service in both languages so patrons recognise it', () => {
    // The whole point of the message is continuity — a patron must see the name
    // they already know, not just "welcome to our new site".
    createComponent();
    expect(component.message).toContain('DaTA');

    component.currentLanguage = 'he';
    expect(component.message).toContain('דעת״א');
  });

  it('keeps the approved wording byte-for-byte, curly punctuation included', () => {
    // The approved copy uses a real gershayim (U+05F4) and a curly apostrophe
    // (U+2019). Re-typing either as its ASCII lookalike (" / ') is a silent
    // typographic regression that no other assertion here would catch.
    createComponent();
    expect(component.message).toBe(
      'Welcome to DaTA’s refreshed look, with the same familiar search experience from Tel Aviv University Libraries'
    );

    component.currentLanguage = 'he';
    expect(component.message).toBe(
      'ברוכים הבאים לדעת״א במראה רענן, עם אותה חוויית חיפוש מוכרת של ספריות אוניברסיטת תל אביב'
    );
  });
});
