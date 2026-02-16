import { Component, OnInit, OnDestroy } from '@angular/core';
import { ThemeService, ResolvedTheme } from '../../services/theme.service';
import { Subscription } from 'rxjs';

/**
 * Theme Toggle Component
 * A floating action button that allows users to toggle between light and dark themes.
 * Positioned fixed at the bottom-right corner of the viewport.
 */
@Component({
  selector: 'custom-theme-toggle',
  standalone: false,
  templateUrl: './theme-toggle.component.html',
  styleUrls: ['./theme-toggle.component.scss']
})
export class ThemeToggleComponent implements OnInit, OnDestroy {
  /** Current resolved theme */
  currentTheme: ResolvedTheme = 'light';

  /** Whether dark mode is currently active */
  isDark = false;

  /** Subscription to theme changes */
  private themeSubscription: Subscription | null = null;

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    // Get initial theme state
    this.currentTheme = this.themeService.getCurrentTheme();
    this.isDark = this.themeService.isDark();

    // Subscribe to theme changes
    this.themeSubscription = this.themeService.currentTheme$.subscribe((theme) => {
      this.currentTheme = theme;
      this.isDark = theme === 'dark';
    });
  }

  ngOnDestroy(): void {
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Get the appropriate icon name based on current theme
   */
  get iconName(): string {
    return this.isDark ? 'light_mode' : 'dark_mode';
  }

  /**
   * Get aria-checked value for the switch role
   */
  get ariaChecked(): string {
    return this.isDark ? 'true' : 'false';
  }
}
