// theme.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'tau-primo-theme-preference';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly preferenceSubject = new BehaviorSubject<ThemePreference>(this.loadPreference());
  private readonly resolvedThemeSubject = new BehaviorSubject<ResolvedTheme>(this.resolveTheme(this.loadPreference()));

  private mediaQuery: MediaQueryList | null = null;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

  /**
   * Observable of the resolved theme (always 'light' or 'dark')
   */
  readonly currentTheme$: Observable<ResolvedTheme> = this.resolvedThemeSubject.asObservable().pipe(
    distinctUntilChanged()
  );

  /**
   * Convenience observable for dark mode state
   */
  readonly isDark$: Observable<boolean> = this.currentTheme$.pipe(
    map(theme => theme === 'dark'),
    distinctUntilChanged()
  );

  /**
   * Observable of the raw preference ('light', 'dark', or 'system')
   */
  readonly preference$: Observable<ThemePreference> = this.preferenceSubject.asObservable().pipe(
    distinctUntilChanged()
  );

  constructor() {
    this.setupSystemPreferenceListener();
  }

  /**
   * Initialize the theme service and apply the current theme to the DOM.
   * This should be called during app initialization.
   */
  initialize(): void {
    const preference = this.loadPreference();
    this.preferenceSubject.next(preference);
    this.updateResolvedTheme();
    this.applyThemeToDOM(this.resolvedThemeSubject.getValue());
  }

  /**
   * Set the theme preference
   * @param preference - 'light', 'dark', or 'system'
   */
  setTheme(preference: ThemePreference): void {
    this.savePreference(preference);
    this.preferenceSubject.next(preference);
    this.updateResolvedTheme();
    this.applyThemeToDOM(this.resolvedThemeSubject.getValue());
  }

  /**
   * Toggle between light and dark themes.
   * If current resolved theme is light, switches to dark preference.
   * If current resolved theme is dark, switches to light preference.
   */
  toggleTheme(): void {
    const currentResolved = this.resolvedThemeSubject.getValue();
    const newPreference: ThemePreference = currentResolved === 'dark' ? 'light' : 'dark';
    this.setTheme(newPreference);
  }

  /**
   * Get the current resolved theme synchronously
   */
  getCurrentTheme(): ResolvedTheme {
    return this.resolvedThemeSubject.getValue();
  }

  /**
   * Get the current preference synchronously
   */
  getPreference(): ThemePreference {
    return this.preferenceSubject.getValue();
  }

  /**
   * Check if dark mode is currently active
   */
  isDark(): boolean {
    return this.resolvedThemeSubject.getValue() === 'dark';
  }

  private loadPreference(): ThemePreference {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // localStorage may not be available
    }
    return 'system';
  }

  private savePreference(preference: ThemePreference): void {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // localStorage may not be available
    }
  }

  private resolveTheme(preference: ThemePreference): ResolvedTheme {
    if (preference === 'system') {
      return this.getSystemPreference();
    }
    return preference;
  }

  private getSystemPreference(): ResolvedTheme {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  private updateResolvedTheme(): void {
    const resolved = this.resolveTheme(this.preferenceSubject.getValue());
    this.resolvedThemeSubject.next(resolved);
  }

  private setupSystemPreferenceListener(): void {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    this.mediaQueryListener = (e: MediaQueryListEvent) => {
      // Only update if preference is 'system'
      if (this.preferenceSubject.getValue() === 'system') {
        const newTheme: ResolvedTheme = e.matches ? 'dark' : 'light';
        this.resolvedThemeSubject.next(newTheme);
        this.applyThemeToDOM(newTheme);
      }
    };

    // Use addEventListener for modern browsers
    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', this.mediaQueryListener);
    } else {
      // Fallback for older browsers
      this.mediaQuery.addListener(this.mediaQueryListener);
    }
  }

  private applyThemeToDOM(theme: ResolvedTheme): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;

    // Toggle dark-theme class
    if (theme === 'dark') {
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
    }

    // Set data-theme attribute
    root.setAttribute('data-theme', theme);

    // Set color-scheme style for native element styling
    root.style.colorScheme = theme;
  }

  /**
   * Cleanup method - call if service needs to be destroyed
   */
  destroy(): void {
    if (this.mediaQuery && this.mediaQueryListener) {
      if (this.mediaQuery.removeEventListener) {
        this.mediaQuery.removeEventListener('change', this.mediaQueryListener);
      } else {
        // Fallback for older browsers
        this.mediaQuery.removeListener(this.mediaQueryListener);
      }
    }
  }
}

/**
 * Factory function for APP_INITIALIZER to apply theme before bootstrap
 */
export function initializeTheme(themeService: ThemeService): () => void {
  return () => {
    themeService.initialize();
  };
}
