/**
 * @fileoverview Final response component for submitting simulation responses.
 *
 * Supports two modes:
 * 1. Free-text mode: Simple textarea when no outputSchema is provided
 * 2. Schema mode: JSONForms-based form when outputSchema is defined
 *
 * This is a "dumb" UI component that receives configuration via inputs and
 * emits events on user interaction.
 *
 * @see mddocs/frontend/research/jsonforms-research.md#use-case-final-response-forms
 * @see mddocs/frontend/frontend-spec.md#fr-response-construction (FR-018, FR-019)
 */

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { JsonFormsModule } from '@jsonforms/angular';
import { angularMaterialRenderers } from '@jsonforms/angular-material';
import { generateDefaultUISchema, type JsonSchema7, type UISchemaElement } from '@jsonforms/core';
import type { ErrorObject } from 'ajv';

import { AnyObjectRenderer, AnyObjectRendererTester } from '../renderers';

/**
 * Combined JSONForms renderers: Angular Material + custom renderers.
 *
 * NOTE: This is intentionally defined inline (not imported from parent module)
 * to comply with Sheriff module boundary rules. Child modules cannot import
 * from parent barrel modules.
 */
const jsonFormsRenderers = [
  ...angularMaterialRenderers,
  { tester: AnyObjectRendererTester, renderer: AnyObjectRenderer },
];

/**
 * Recursively adds `showUnfocusedDescription: true` to all Control elements
 * in a UI schema so field descriptions are always visible.
 *
 * NOTE: This is intentionally duplicated (not shared) to comply with Sheriff
 * module boundary rules.
 */
function addDescriptionOptions(uischema: UISchemaElement): UISchemaElement {
  // Clone to avoid mutation
  const result = { ...uischema } as UISchemaElement & {
    options?: Record<string, unknown>;
    elements?: UISchemaElement[];
  };

  // Add option to Control elements
  if (result.type === 'Control') {
    result.options = {
      ...result.options,
      showUnfocusedDescription: true,
    };
  }

  // Recurse into layout elements
  if (result.elements && Array.isArray(result.elements)) {
    result.elements = result.elements.map((el) => addDescriptionOptions(el));
  }

  return result;
}

/**
 * Final response component for submitting simulation responses (FR-018, FR-019).
 *
 * When no outputSchema is provided, renders a simple Material textarea.
 * When outputSchema is defined, renders a JSONForms-based form.
 *
 * @example
 * ```html
 * <!-- Free-text mode -->
 * <app-final-response
 *   (submitText)="onTextResponse($event)"
 * />
 *
 * <!-- Schema mode -->
 * <app-final-response
 *   [outputSchema]="responseSchema"
 *   (submitStructured)="onStructuredResponse($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-final-response',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    JsonFormsModule,
  ],
  template: `
    <div class="final-response" data-testid="final-response">
      @if (hasOutputSchema()) {
        <!-- Schema mode: JSONForms -->
        <div class="schema-mode" data-testid="schema-mode">
          <jsonforms
            [data]="formData()"
            [schema]="outputSchema()!"
            [uischema]="enhancedUiSchema()"
            [renderers]="renderers"
            [config]="jsonFormsConfig"
            (dataChange)="onDataChange($event)"
            (errors)="onErrors($event)"
          />
        </div>
      } @else {
        <!-- Free-text mode: Material textarea -->
        <mat-form-field appearance="outline" class="full-width" data-testid="free-text-mode">
          <mat-label>Final Response</mat-label>
          <textarea
            matInput
            [value]="textResponse()"
            (input)="onTextInput($event)"
            rows="6"
            data-testid="response-textarea"
          ></textarea>
        </mat-form-field>
      }

      <!-- Submit button -->
      <div class="form-footer">
        <button
          mat-flat-button
          color="primary"
          [disabled]="isSubmitDisabled()"
          (click)="onSubmit()"
          data-testid="submit-button"
        >
          <mat-icon>send</mat-icon>
          SUBMIT RESPONSE
        </button>
      </div>
    </div>
  `,
  styles: `
    .final-response {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
    }

    .full-width {
      width: 100%;
    }

    .schema-mode {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .form-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--mat-sys-outline-variant, #cac4d0);
    }

    button[mat-flat-button] {
      display: inline-flex;
      align-items: center;
      gap: 8px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinalResponseComponent {
  /**
   * Optional JSON Schema for structured responses.
   * When null/undefined, a free-text textarea is rendered.
   * When defined, a JSONForms-based form is rendered.
   */
  readonly outputSchema = input<JsonSchema7 | null>(null);

  /**
   * Emits when the user submits a free-text response.
   */
  readonly submitText = output<string>();

  /**
   * Emits when the user submits a schema-validated structured response.
   */
  readonly submitStructured = output<unknown>();

  /**
   * JSONForms renderers (Angular Material + custom renderers).
   */
  readonly renderers = jsonFormsRenderers;

  /**
   * JSONForms config with default options.
   */
  readonly jsonFormsConfig = {
    showUnfocusedDescription: true,
  };

  /**
   * Whether an output schema is defined (determines which mode to render).
   */
  readonly hasOutputSchema = computed(() => this.outputSchema() !== null);

  /**
   * Generated UI schema from the output schema.
   */
  readonly uiSchema = computed<UISchemaElement | null>(() => {
    const schema = this.outputSchema();
    if (!schema) {
      return null;
    }
    return generateDefaultUISchema(schema);
  });

  /**
   * Enhanced UI schema with description options enabled.
   */
  readonly enhancedUiSchema = computed<UISchemaElement>(() => {
    const schema = this.uiSchema();
    if (!schema) {
      // Return a minimal valid UI schema as fallback
      return { type: 'VerticalLayout', elements: [] };
    }
    return addDescriptionOptions(schema);
  });

  /**
   * Current text response (free-text mode).
   */
  readonly textResponse = signal('');

  /**
   * Current form data (schema mode).
   */
  readonly formData = signal<unknown>({});

  /**
   * Current validation errors (schema mode).
   */
  private readonly errors = signal<ErrorObject[]>([]);

  /**
   * Whether the form has validation errors (schema mode).
   */
  readonly hasErrors = computed(() => this.errors().length > 0);

  /**
   * Whether the submit button should be disabled.
   * - Free-text mode: disabled when textarea is empty
   * - Schema mode: disabled when validation errors exist
   */
  readonly isSubmitDisabled = computed(() => {
    if (this.hasOutputSchema()) {
      return this.hasErrors();
    }
    return this.textResponse().trim().length === 0;
  });

  /**
   * Handle text input in free-text mode.
   */
  onTextInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.textResponse.set(target.value);
  }

  /**
   * Handle form data changes from JSONForms.
   */
  onDataChange(data: unknown): void {
    this.formData.set(data);
  }

  /**
   * Handle validation errors from JSONForms.
   */
  onErrors(errors: ErrorObject[]): void {
    this.errors.set(errors);
  }

  /**
   * Handle submit button click.
   */
  onSubmit(): void {
    if (this.hasOutputSchema()) {
      if (!this.hasErrors()) {
        this.submitStructured.emit(this.formData());
      }
    } else {
      const text = this.textResponse().trim();
      if (text.length > 0) {
        this.submitText.emit(text);
      }
    }
  }
}
