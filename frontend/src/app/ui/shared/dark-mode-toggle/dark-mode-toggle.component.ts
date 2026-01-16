/**
 * @fileoverview Dark mode toggle component.
 *
 * Provides a button to toggle between light and dark themes.
 * Uses Angular Material icon button with dynamic icon and tooltip
 * based on current theme state.
 *
 * @see mddocs/frontend/sprints/sprint4.md#s4pr4-create-darkmodetogglecomponent
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ThemeService } from '../../../util/theme';

/**
 * Dark mode toggle component.
 *
 * Displays a button that toggles between light and dark modes.
 * Shows a sun icon (light_mode) when in dark mode (to switch to light),
 * and a moon icon (dark_mode) when in light mode (to switch to dark).
 *
 * @example
 * ```html
 * <!-- In a toolbar -->
 * <app-dark-mode-toggle />
 * ```
 */
@Component({
  selector: 'app-dark-mode-toggle',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button mat-icon-button [matTooltip]="label()" [attr.aria-label]="label()" (click)="onToggle()">
      <mat-icon>{{ icon() }}</mat-icon>
    </button>
  `,
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DarkModeToggleComponent {
  private readonly themeService = inject(ThemeService);

  /** Whether dark mode is currently active */
  readonly isDarkMode = this.themeService.isDarkMode;

  /**
   * Icon to display based on current theme.
   * Shows light_mode (sun) when dark to indicate "switch to light",
   * shows dark_mode (moon) when light to indicate "switch to dark".
   */
  readonly icon = computed(() => (this.isDarkMode() ? 'light_mode' : 'dark_mode'));

  /**
   * Label for tooltip and aria-label (identical content for both).
   */
  readonly label = computed(() =>
    this.isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode',
  );

  /**
   * Handle toggle button click.
   */
  onToggle(): void {
    this.themeService.toggleTheme();
  }
}
