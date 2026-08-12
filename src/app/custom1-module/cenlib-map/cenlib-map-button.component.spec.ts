import { ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';

import { CenlibMapButtonComponent } from './cenlib-map-button.component';

/**
 * These tests pin the button's *appearance* contract, decided in issue #41
 * (option B — "Pin it"). The button is moved at runtime into the native Locate
 * button's slot, so it is judged against Ex Libris's own Get It controls: it has
 * to be a filled tonal pill drawn from the host's theme tokens, not the
 * hard-coded blue outlined rectangle it used to be.
 *
 * Colours are asserted through the fallbacks baked into the SCSS
 * (`var(--sys-primary, #3f608a)`), because the host tokens are not defined
 * inside the Karma page. That is deliberate: the fallback is what keeps the
 * button correct if the token ever goes missing at runtime.
 */
describe('CenlibMapButtonComponent', () => {
  let fixture: ComponentFixture<CenlibMapButtonComponent>;
  let component: CenlibMapButtonComponent;

  /** Render the button, which only appears once a mapping has been found. */
  function showButton(language: 'en' | 'he' = 'en'): HTMLButtonElement {
    component.currentLanguage = language;
    component.shouldShow = true;
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button.cenlib-map-button');
    expect(button).withContext('button should render once shouldShow is true').toBeTruthy();
    return button as HTMLButtonElement;
  }

  // The component resolves language from <html lang> first, so tests must own
  // those attributes rather than inherit whatever the Karma page carries.
  let originalLang: string | null;
  let originalDir: string | null;

  beforeEach(() => {
    originalLang = document.documentElement.getAttribute('lang');
    originalDir = document.documentElement.getAttribute('dir');
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');

    TestBed.configureTestingModule({
      imports: [CenlibMapButtonComponent, HttpClientTestingModule],
      providers: [{ provide: MatDialog, useValue: { open: () => ({ afterClosed: () => ({ subscribe: () => {} }) }) } }],
    })
      // In production the component is OnPush and calls markForCheck() itself
      // once a mapping resolves. As the root of a fixture there is no parent to
      // propagate that, so tests drive it with default change detection.
      .overrideComponent(CenlibMapButtonComponent, {
        set: { changeDetection: ChangeDetectionStrategy.Default },
      });
    fixture = TestBed.createComponent(CenlibMapButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    const restore = (attr: string, value: string | null) =>
      value === null
        ? document.documentElement.removeAttribute(attr)
        : document.documentElement.setAttribute(attr, value);
    restore('lang', originalLang);
    restore('dir', originalDir);
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('is hidden until a shelf mapping has been resolved', () => {
    expect(component.shouldShow).toBeFalse();
    expect(fixture.nativeElement.querySelector('button.cenlib-map-button')).toBeNull();
  });

  describe('the glyph', () => {
    it('is the map pointer, not the folded map', () => {
      const icon = showButton().querySelector('mat-icon');
      // `map` is the folded-paper Google-Maps glyph rejected in #41: it reads as
      // geography rather than "this is where the book is".
      expect(icon?.textContent?.trim()).toBe('location_on');
    });

    it('leads the label in both directions', () => {
      // The browser already reverses the row under RTL. The component must not
      // reverse it a second time, or the icon trails in Hebrew and leads in
      // English — which is what shipped before #41. The rule under test is
      // `:host-context([dir='rtl'])`, so the direction has to be set on an
      // ancestor of the host, not on the button.
      const previousDir = document.body.getAttribute('dir');
      try {
        for (const dir of ['ltr', 'rtl']) {
          document.body.setAttribute('dir', dir);
          const button = showButton(dir === 'rtl' ? 'he' : 'en');
          expect(getComputedStyle(button).flexDirection)
            .withContext(`flex-direction under dir="${dir}"`)
            .toBe('row');
        }
      } finally {
        if (previousDir === null) document.body.removeAttribute('dir');
        else document.body.setAttribute('dir', previousDir);
      }
    });
  });

  describe('the label', () => {
    it('reads "Shelf Map" in English and "מפת מדף" in Hebrew', () => {
      expect(showButton('en').querySelector('.button-text')?.textContent?.trim()).toBe('Shelf Map');
      expect(showButton('he').querySelector('.button-text')?.textContent?.trim()).toBe('מפת מדף');
    });

    it('keeps an aria-label in both languages, so the glyph never carries the meaning alone', () => {
      expect(showButton('en').getAttribute('aria-label')).toBe('Show shelf map');
      expect(showButton('he').getAttribute('aria-label')).toBe('הצג מפת מדף');
    });
  });

  describe('in-app language switch', () => {
    // Reproduced live on NDE_TEST, 12 Aug 2026: switching language in the app
    // left this button in the language the page first loaded in, while the host's
    // own controls beside it switched correctly.
    //
    // Root cause, proved rather than inferred — the button was stamped with a
    // data attribute, the language was switched, and the stamp was still on the
    // same DOM node afterwards. The component is moved into the native Locate
    // button's slot and the host does not tear that subtree down on a switch, so
    // the instance survives and a constructor-time read of the language is frozen
    // for the rest of the session. Same shape as the announcement banner bug
    // fixed in #30, for a different reason: that one lives outside the router
    // outlet, this one is relocated out of its own mount point.
    //
    // These tests deliberately never re-create the fixture. Re-creating it would
    // hide the bug, because a fresh mount re-reads the language.

    /** MutationObserver callbacks are async; let the microtask queue drain. */
    const flush = () => new Promise<void>(resolve => setTimeout(resolve));

    /** Switch language the way the host does: rewrite <html lang> and <html dir>. */
    async function switchTo(language: 'en' | 'he') {
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('dir', language === 'he' ? 'rtl' : 'ltr');
      await flush();
      fixture.detectChanges();
    }

    it('follows a switch from Hebrew to English', async () => {
      await switchTo('he');
      component.shouldShow = true;
      fixture.detectChanges();
      expect(component.currentLanguage).toBe('he');

      await switchTo('en');

      expect(component.currentLanguage).toBe('en');
      const button = fixture.nativeElement.querySelector('button.cenlib-map-button');
      expect(button.querySelector('.button-text').textContent.trim()).toBe('Shelf Map');
      expect(button.getAttribute('aria-label')).toBe('Show shelf map');
    });

    it('follows a switch from English to Hebrew', async () => {
      await switchTo('en');
      component.shouldShow = true;
      fixture.detectChanges();
      expect(component.currentLanguage).toBe('en');

      await switchTo('he');

      expect(component.currentLanguage).toBe('he');
      const button = fixture.nativeElement.querySelector('button.cenlib-map-button');
      expect(button.querySelector('.button-text').textContent.trim()).toBe('מפת מדף');
      expect(button.getAttribute('aria-label')).toBe('הצג מפת מדף');
    });

    it('stops watching once destroyed', async () => {
      await switchTo('en');
      fixture.destroy();

      document.documentElement.setAttribute('lang', 'he');
      await flush();

      expect(component.currentLanguage).toBe('en');
    });

    it('falls back to the URL, then dir, when <html lang> is absent', () => {
      // First paint can land before the host stamps <html lang>. he_IL and any
      // other he-* tag have to resolve to Hebrew, which an equality check missed.
      expect(component.resolveLanguage()).toBe('en');

      document.documentElement.setAttribute('dir', 'rtl');
      expect(component.resolveLanguage()).toBe('he');

      document.documentElement.setAttribute('lang', 'he_IL');
      expect(component.resolveLanguage()).toBe('he');

      document.documentElement.setAttribute('lang', 'en');
      expect(component.resolveLanguage()).toBe('en');
    });
  });

  describe('the shape and colour', () => {
    it('is a filled tonal pill, not an outlined rectangle', () => {
      const style = getComputedStyle(showButton());
      // Pill, matching the native "View Items" control beside it.
      expect(parseFloat(style.borderRadius)).toBeGreaterThanOrEqual(20);
      // Tonal fill rather than a border. The old button was transparent with a
      // 1px outline; adding a background to that would leave a stray border.
      expect(style.backgroundColor).toBe('rgb(211, 227, 255)');
      expect(parseFloat(style.borderTopWidth)).toBe(0);
    });

    it('takes its foreground from the theme token, not a hard-coded blue', () => {
      // #1976d2 on the location card's #f3f3f3 measures 4.15:1 and fails WCAG AA
      // for normal text; the theme colour #3f608a measures 5.82:1 and passes.
      expect(getComputedStyle(showButton()).color).toBe('rgb(63, 96, 138)');
    });

    it('stands 40px tall, level with the native Get It buttons', () => {
      expect(getComputedStyle(showButton()).height).toBe('40px');
    });
  });
});
