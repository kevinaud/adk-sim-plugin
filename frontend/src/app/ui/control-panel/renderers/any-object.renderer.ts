/**
 * @fileoverview Custom JSONForms renderer for open object schemas.
 *
 * Renders a textarea for JSON input when the schema has:
 * - type: 'object'
 * - additionalProperties: true
 * - No defined properties
 *
 * This handles Python Dict[str, Any] or similar open object parameters
 * that accept arbitrary key-value pairs.
 *
 * @example
 * Schema: { type: 'object', additionalProperties: true }
 * Renders: A textarea where users enter JSON like: { "key": "value" }
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { JsonFormsAngularService, JsonFormsControl } from '@jsonforms/angular';
import {
  Actions,
  and,
  isObjectControl,
  type JsonSchema,
  type RankedTester,
  rankWith,
  schemaMatches,
} from '@jsonforms/core';

/**
 * Tester function to detect open object schemas.
 *
 * Returns true when the schema:
 * - Is type 'object'
 * - Has additionalProperties: true
 * - Has no defined properties (empty or undefined)
 */
const isOpenObject = schemaMatches((schema: JsonSchema) => {
  const isObject = schema.type === 'object';
  const hasAdditionalProps = schema.additionalProperties === true;
  const hasNoProperties = !schema.properties || Object.keys(schema.properties).length === 0;
  return isObject && hasAdditionalProps && hasNoProperties;
});

/**
 * Ranked tester for the AnyObjectRenderer.
 * Uses rank 5 to take priority over the default object renderer (rank 2).
 */
export const AnyObjectRendererTester: RankedTester = rankWith(
  5,
  and(isObjectControl, isOpenObject),
);

/**
 * Custom renderer for open object schemas (Dict[str, Any] in Python).
 *
 * Renders a textarea that:
 * - Accepts JSON input
 * - Validates that input is valid JSON
 * - Parses and emits the object value on change
 *
 * The renderer shows a validation error if the JSON is invalid.
 */
@Component({
  selector: 'app-any-object-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field [ngStyle]="{ display: hidden ? 'none' : '' }" class="any-object-field">
      <mat-label>{{ label }}</mat-label>
      <textarea
        matInput
        [id]="id"
        [ngModel]="jsonText()"
        [placeholder]="placeholder"
        (ngModelChange)="onJsonTextChange($event)"
        (focus)="focused = true"
        (focusout)="focused = false"
        rows="6"
      ></textarea>
      @if (shouldShowUnfocusedDescription() || focused) {
        <mat-hint>{{ description || 'Enter a valid JSON object' }}</mat-hint>
      }
      @if (jsonError) {
        <mat-error>{{ jsonError }}</mat-error>
      } @else if (error) {
        <mat-error>{{ error }}</mat-error>
      }
    </mat-form-field>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: row;
    }
    .any-object-field {
      flex: 1 1 auto;
    }
    /* Properly scoped to this component's host to prevent CSS leakage */
    :host textarea.mat-mdc-input-element {
      font-family: monospace;
      font-size: 13px;
      line-height: 1.4;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnyObjectRenderer extends JsonFormsControl {
  focused = false;
  jsonError: string | null = null;

  readonly placeholder = '{\n  "key": "value"\n}';

  /**
   * Signal holding the JSON text displayed in the textarea.
   * Separate from the form control to avoid [object Object] display issues.
   */
  readonly jsonText = signal<string>('');

  /**
   * Track whether the user is currently editing to avoid overwriting their text.
   */
  private isUserEditing = false;

  constructor() {
    super(inject(JsonFormsAngularService));
  }

  /**
   * Parse and validate JSON text.
   * Returns the parsed object or undefined if invalid.
   */
  private parseJsonText(text: string): Record<string, unknown> | undefined {
    const value = text.trim();

    // Empty input returns empty object
    if (!value) {
      this.jsonError = null;
      return {};
    }

    try {
      const parsed: unknown = JSON.parse(value);

      // Validate it's actually an object (not array, null, or primitive)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.jsonError = 'Must be a JSON object (not array or primitive)';
        return undefined;
      }

      this.jsonError = null;
      return parsed as Record<string, unknown>;
    } catch {
      this.jsonError = 'Invalid JSON syntax';
      return undefined;
    }
  }

  /**
   * Handle JSON text changes from the textarea.
   */
  onJsonTextChange(text: string): void {
    this.isUserEditing = true;
    this.jsonText.set(text);

    // Parse and validate
    const parsedValue = this.parseJsonText(text);

    // Update JSONForms if valid, otherwise show error
    if (parsedValue === undefined) {
      // Mark as touched to show error
      this.form.markAsTouched();
      this.form.updateValueAndValidity();
    } else {
      this.jsonFormsService.updateCore(Actions.update(this.propsPath, () => parsedValue));
    }
  }

  /**
   * Override mapAdditionalProps to convert object data to JSON string for display.
   * This is called by the parent class whenever the JSONForms state changes.
   */
  override mapAdditionalProps(): void {
    // If user is editing, don't overwrite their text
    if (this.isUserEditing) {
      return;
    }

    // Convert object data to JSON string for textarea display
    if (this.data && typeof this.data === 'object') {
      const jsonString = JSON.stringify(this.data as Record<string, unknown>, null, 2);
      this.jsonText.set(jsonString);
    }
  }
}
