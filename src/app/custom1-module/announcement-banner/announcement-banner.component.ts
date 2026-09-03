import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { dlog } from '../../services/debug.util';
import { readUiLanguage, UiLanguage, watchUiLanguage } from '../../services/ui-language';

/**
 * Announcement Banner (issue #30).
 *
 * A full-width announcement strip, EFSC-style, mounted at the `nde-header-before`
 * extension slot so it sits above the NDE header. Slot placement was verified
 * live through the dev proxy — see the note in customComponentMappings.ts.
 *
 * CONTENT is the bilingual "refreshed look" wording approved for the production
 * NDE view (03.08.26). It supersedes the demo text this component shipped with on
 * NDE_TEST.
 *
 * The text is hard-coded, so every wording change costs a rebuild *and* a manual
 * Back Office upload. That is acceptable for a standing launch message; it is not
 * acceptable if library staff need to edit announcements themselves.
 *
 * That question is still open, and it was open in the request this banner came
 * from: the library's NDE feature-request document raised the banner as
 * "סוגייה 3" and explicitly deferred it — "לברר האם זה טקסט דינאמי שמשתנה, או
 * ש-hard coded" (establish whether the text is dynamic or hard-coded). Nobody has
 * answered it since. That document is held by the library and is deliberately not
 * in this repo, which is public; ask the library for it rather than looking for a
 * path here. Its other items became issues #28, #29 and #31.
 *
 * If the answer comes back as dynamic, the source of `message` has to move to
 * Back Office labels or a same-origin JSON fetch — the rest of the component
 * (slot, styling, RTL, dismissal, a11y) stays as-is.
 */
@Component({
  selector: 'tau-announcement-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcement-banner.component.html',
  styleUrls: ['./announcement-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementBannerComponent implements OnInit, OnDestroy {
  currentLanguage: UiLanguage = 'en';

  dismissed = false;

  private langObserver?: MutationObserver;

  /**
   * Bumping this retires a previous dismissal, so a new announcement resurfaces
   * for users who dismissed the last one.
   *
   * v1 → v2 on 03.08.26 with the approved production wording. NDE_TEST and NDE
   * share the origin tau.primo.exlibrisgroup.com, and localStorage is per-origin,
   * so without the bump anyone who dismissed the demo banner on NDE_TEST would
   * never see the production one.
   */
  private static readonly DISMISS_KEY = 'tauAnnouncementDismissed:v2';

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  get textDirection(): 'ltr' | 'rtl' {
    return this.currentLanguage === 'he' ? 'rtl' : 'ltr';
  }

  /**
   * Approved production wording (issue #30, supplied 03.08.26) — reassures patrons
   * that this is the familiar DaTA / דעת״א service in a new interface, not a
   * different system.
   *
   * Typography is deliberate and must be preserved verbatim if this is ever
   * re-typed: the Hebrew uses a real gershayim (U+05F4) in דעת״א, and the English
   * a curly apostrophe (U+2019) in DaTA’s — not their ASCII lookalikes. Both
   * strings are single-quoted, so neither needs escaping.
   */
  get message(): string {
    return this.currentLanguage === 'he'
      ? 'ברוכים הבאים לדעת״א במראה רענן, עם אותה חוויית חיפוש מוכרת של ספריות אוניברסיטת תל אביב'
      : 'Welcome to DaTA’s refreshed look, with the same familiar search experience from Tel Aviv University Libraries';
  }

  get dismissLabel(): string {
    return this.currentLanguage === 'he' ? 'סגירת ההודעה' : 'Dismiss announcement';
  }

  get regionLabel(): string {
    return this.currentLanguage === 'he' ? 'הודעת ספרייה' : 'Library announcement';
  }

  ngOnInit(): void {
    this.currentLanguage = this.readLanguage();
    this.dismissed = this.readDismissed();
    this.watchLanguage();

    // Host tag is '<slot>-from-remote-<n>', so this names the slot that mounted us.
    dlog(
      '[AnnouncementBanner] mounted in slot:',
      this.elementRef.nativeElement.tagName.toLowerCase()
    );
  }

  ngOnDestroy(): void {
    this.langObserver?.disconnect();
  }

  /**
   * Keeps the banner in step with an in-app language switch.
   *
   * This banner mounts at `nde-header-before`, *outside* the router outlet, so
   * unlike our other components it is never destroyed while the user browses —
   * `ngOnInit` runs once, at first paint. Reading the language only there left
   * the text frozen in whatever language the page first loaded in, until a
   * manual refresh.
   *
   * Verified live on 2026-08-02 during that bug: on a language switch the host
   * rewrites `<html lang>` and `<html dir>` (en→he, ltr→rtl) while the component
   * node itself survives untouched. `popstate` does *not* fire — the host router
   * navigates with pushState — so the attribute mutation is the only reliable
   * signal available to us without reaching into the host's NgRx store.
   */
  private watchLanguage(): void {
    this.langObserver = watchUiLanguage(
      () => this.currentLanguage,
      language => {
        this.currentLanguage = language;
        // OnPush: writing the field is not enough to repaint, and the mutation
        // originates outside this component's own change-detection path.
        this.changeDetectorRef.markForCheck();
      }
    );
  }

  /** @see readUiLanguage — shared with every other bilingual TAU component. */
  private readLanguage(): UiLanguage {
    return readUiLanguage();
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
