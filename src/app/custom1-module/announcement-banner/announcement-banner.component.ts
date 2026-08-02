import { ChangeDetectionStrategy, Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { dlog } from '../../services/debug.util';

/**
 * Announcement Banner (issue #30).
 *
 * A full-width announcement strip, EFSC-style, mounted at the `nde-header-before`
 * extension slot so it sits above the NDE header. Slot placement was verified
 * live through the dev proxy — see the note in customComponentMappings.ts.
 *
 * CONTENT IS TEMPORARY — a bilingual "welcome to the new view" message written to
 * demonstrate the banner on NDE_TEST. The permanent wording is still undecided at
 * source (docs/research/"need to add those features for test env.docx", סוגייה 3,
 * asks *what* the banner contains and whether the text is dynamic).
 *
 * The text is hard-coded, so every wording change costs a rebuild *and* a manual
 * Back Office upload. That is acceptable for a one-off demo message; it is not
 * acceptable if library staff need to edit announcements themselves. If the answer
 * to "dynamic or hard-coded?" comes back as dynamic, the source of `message` has to
 * move to Back Office labels or a same-origin JSON fetch — the rest of the
 * component (slot, styling, RTL, dismissal, a11y) stays as-is.
 */
@Component({
  selector: 'tau-announcement-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcement-banner.component.html',
  styleUrls: ['./announcement-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementBannerComponent implements OnInit {
  currentLanguage: 'en' | 'he' = 'en';

  dismissed = false;

  /**
   * Bumping this retires a previous dismissal, so a new announcement resurfaces
   * for users who dismissed the last one.
   */
  private static readonly DISMISS_KEY = 'tauAnnouncementDismissed:v1';

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  get textDirection(): 'ltr' | 'rtl' {
    return this.currentLanguage === 'he' ? 'rtl' : 'ltr';
  }

  /**
   * TEMPORARY demo wording (issue #30) — reassures patrons that this is the
   * familiar DaTA / דעת"א service in a new interface, not a different system.
   * Replace once the requester specifies the permanent text.
   *
   * Single-quoted so the gershayim in דעת"א needs no escaping.
   */
  get message(): string {
    return this.currentLanguage === 'he'
      ? 'ברוכים הבאים לדעת"א בעיצוב חדש — מערכת החיפוש המוכרת של ספריות אוניברסיטת תל אביב, במראה מחודש.'
      : 'Welcome to the new look of DaTA — the Tel Aviv University Libraries search service you already know, in a refreshed interface.';
  }

  get dismissLabel(): string {
    return this.currentLanguage === 'he' ? 'סגירת ההודעה' : 'Dismiss announcement';
  }

  get regionLabel(): string {
    return this.currentLanguage === 'he' ? 'הודעת ספרייה' : 'Library announcement';
  }

  ngOnInit(): void {
    // Matches SearchQueryService.getCurrentLanguage() — NDE carries the UI
    // language in the `lang` URL parameter, not on <html lang>, at mount time.
    const lang = new URLSearchParams(window.location.search).get('lang');
    this.currentLanguage = lang === 'he' || lang === 'he_IL' ? 'he' : 'en';

    this.dismissed = this.readDismissed();

    // Host tag is '<slot>-from-remote-<n>', so this names the slot that mounted us.
    dlog(
      '[AnnouncementBanner] mounted in slot:',
      this.elementRef.nativeElement.tagName.toLowerCase()
    );
  }

  dismiss(): void {
    this.dismissed = true;
    try {
      localStorage.setItem(AnnouncementBannerComponent.DISMISS_KEY, '1');
    } catch {
      // Restricted/sandboxed contexts: dismissal just won't persist. Not fatal.
    }
  }

  private readDismissed(): boolean {
    try {
      return localStorage.getItem(AnnouncementBannerComponent.DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  }
}
