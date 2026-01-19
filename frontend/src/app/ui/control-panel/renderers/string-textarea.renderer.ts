/**
 * @fileoverview Custom JSONForms renderer for string fields using textarea.
 *
 * Replaces the default text input with a textarea for all string fields,
 * providing better UX for long text input. The textarea starts with a
 * single-line height and expands vertically as the user enters more content.
 *
 * @example
 * Schema: { type: 'string', description: 'Enter your query' }
 * Renders: A textarea that grows with content
 */

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { JsonFormsAngularService, JsonFormsControl } from '@jsonforms/angular';
import {
  and,
  isEnumControl,
  isOneOfEnumControl,
  isStringControl,
  not,
  type RankedTester,
  rankWith,
} from '@jsonforms/core';

/**
 * Ranked tester for the StringTextareaRenderer.
 * Uses rank 3 to take priority over the default string renderer (rank 2)
 * but lower than specialized renderers (rank 5+).
 *
 * Excludes enum controls (which use autocomplete) by using:
 * `and(isStringControl, not(isEnumControl), not(isOneOfEnumControl))`
 */
export const StringTextareaRendererTester: RankedTester = rankWith(
  3,
  and(isStringControl, not(isEnumControl), not(isOneOfEnumControl)),
);

/**
 * Custom renderer for string fields using a textarea.
 *
 * Renders a textarea that:
 * - Starts with single-line height
 * - Automatically expands as content grows
 * - Uses Material Design styling
 * - Displays validation errors correctly
 *
 * The textarea uses CSS to limit initial height and expand naturally
 * with the content using `field-sizing: content` where supported,
 * with a fallback to a reasonable min/max height.
 */
@Component({
  selector: 'app-string-textarea-renderer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field [ngStyle]="{ display: hidden ? 'none' : '' }" class="string-textarea-field">
      <mat-label>{{ label }}</mat-label>
      <textarea
        #textareaRef
        matInput
        [id]="id"
        [formControl]="form"
        (input)="onChange($event); adjustHeight()"
        (focus)="focused = true"
        (focusout)="focused = false"
        rows="1"
      ></textarea>
      @if (shouldShowUnfocusedDescription() || focused) {
        <mat-hint>{{ description }}</mat-hint>
      }
      <mat-error>{{ error }}</mat-error>
    </mat-form-field>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: row;
    }

    .string-textarea-field {
      flex: 1 1 auto;
    }

    /* Auto-expanding textarea styles */
    :host textarea.mat-mdc-input-element {
      resize: none;
      overflow: hidden;
      min-height: 24px;
      max-height: 200px;
      line-height: 1.5;
      /* Modern browsers: auto-size to content */
      field-sizing: content;
    }

    /* Fallback for browsers without field-sizing support */
    @supports not (field-sizing: content) {
      :host textarea.mat-mdc-input-element {
        overflow-y: auto;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StringTextareaRenderer extends JsonFormsControl {
  focused = false;

  /**
   * Reference to the textarea element for height adjustment.
   */
  readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textareaRef');

  constructor() {
    super(inject(JsonFormsAngularService));
  }

  /**
   * Override to extract the value from input events.
   * Returns undefined for empty values to allow schema validation for required fields.
   */
  override getEventValue = (event: Event): string | undefined => {
    const value = (event.target as HTMLTextAreaElement).value;
    return value || undefined;
  };

  /**
   * Adjust textarea height to fit content.
   * This is a fallback for browsers that don't support field-sizing: content.
   */
  adjustHeight(): void {
    const textarea = this.textareaRef()?.nativeElement;
    if (!textarea) return;

    // Only adjust if field-sizing is not supported
    if (CSS.supports('field-sizing', 'content')) return;

    // Reset height to allow shrinking
    textarea.style.height = 'auto';
    // Set to scrollHeight to expand
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${String(newHeight)}px`;
  }
}
