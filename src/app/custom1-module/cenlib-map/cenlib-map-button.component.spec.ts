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

  beforeEach(() => {
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
