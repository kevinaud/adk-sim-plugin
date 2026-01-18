/**
 * @fileoverview Tool form component for invoking tools via JSONForms.
 *
 * Renders a dynamic form based on a tool's JSON Schema using JSONForms
 * with Angular Material renderers. This is a "dumb" UI component that
 * receives configuration via input and emits events on user interaction.
 *
 * Features:
 * - Dynamic form generation from JSON Schema
 * - AJV-based validation with error display
 * - Elapsed time timer
 * - Back navigation to tool catalog
 *
 * @see mddocs/frontend/research/jsonforms-research.md#use-case-tool-invocation-forms
 * @see mddocs/frontend/frontend-tdd.md#toolformcomponent-jsonforms
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { JsonFormsModule } from '@jsonforms/angular';
import { angularMaterialRenderers } from '@jsonforms/angular-material';
import type { UISchemaElement } from '@jsonforms/core';
import type { ErrorObject } from 'ajv';

import { AnyObjectRenderer, AnyObjectRendererTester } from '../renderers';
import type { ToolFormConfig, ToolInvokeEvent } from './tool-form.types';

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
 * Tool form component for invoking tools (FR-017).
 *
 * Renders a dynamic form based on the tool's schema configuration.
 * Uses JSONForms with Angular Material renderers for form generation.
 *
 * @example
 * ```html
 * <app-tool-form
 *   [config]="toolFormConfig()"
 *   (back)="onBackToActions()"
 *   (invokeOutput)="onToolInvoke($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-tool-form',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, JsonFormsModule],
  template: `
    <div class="tool-form" data-testid="tool-form">
      <!-- Back link -->
      <button type="button" class="back-link" (click)="back.emit()" data-testid="back-link">
        <mat-icon>arrow_back</mat-icon>
        <span>BACK TO ACTIONS</span>
      </button>

      <!-- Header -->
      <h3 class="form-header" data-testid="form-header">Execute: {{ config().toolName }}</h3>

      <!-- Description -->
      @if (config().toolDescription) {
        <p class="form-description" data-testid="form-description">
          {{ config().toolDescription }}
        </p>
      }

      <!-- Parameters section -->
      <div class="parameters-section">
        <h4 class="parameters-heading">Parameters</h4>

        <!-- JSONForms -->
        <jsonforms
          [data]="formData()"
          [schema]="config().schema"
          [uischema]="enhancedUiSchema()"
          [renderers]="renderers"
          [config]="jsonFormsConfig"
          (dataChange)="onDataChange($event)"
          (errors)="onErrors($event)"
        />
      </div>

      <!-- Footer -->
      <div class="form-footer">
        <button
          mat-flat-button
          color="primary"
          [disabled]="hasErrors()"
          (click)="onExecute()"
          data-testid="execute-button"
        >
          <mat-icon>play_arrow</mat-icon>
          EXECUTE
        </button>
      </div>
    </div>
  `,
  styles: `
    .tool-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      padding: 0;
      color: #1976d2;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      &:hover {
        text-decoration: underline;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .form-header {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      color: var(--mat-sys-on-surface, #1c1b1f);
    }

    .form-description {
      margin: 0;
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant, #49454f);
      line-height: 1.5;
    }

    .parameters-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .parameters-heading {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: var(--mat-sys-on-surface, #1c1b1f);
    }

    .form-footer {
      display: flex;
      align-items: center;
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
export class ToolFormComponent {
  /**
   * Configuration for the form including schema, UI schema, and tool metadata.
   */
  readonly config = input.required<ToolFormConfig>();

  /**
   * Emits when the user clicks the back link.
   */
  readonly back = output();

  /**
   * Emits when the user submits the form (clicks EXECUTE).
   */
  readonly invokeOutput = output<ToolInvokeEvent>();

  /**
   * JSONForms renderers (Angular Material + custom renderers).
   */
  readonly renderers = jsonFormsRenderers;

  /**
   * JSONForms config with default options.
   * Enables showing field descriptions without focus.
   */
  readonly jsonFormsConfig = {
    showUnfocusedDescription: true,
  };

  /**
   * Enhanced UI schema with description options enabled.
   * Transforms the input UI schema to always show field descriptions.
   */
  readonly enhancedUiSchema = computed(() => {
    return addDescriptionOptions(this.config().uischema);
  });

  /**
   * Current form data.
   */
  readonly formData = signal<unknown>({});

  /**
   * Current validation errors.
   */
  private readonly errors = signal<ErrorObject[]>([]);

  /**
   * Computed signal indicating whether the form has validation errors.
   */
  readonly hasErrors = computed(() => this.errors().length > 0);

  constructor() {
    // Reset form data when config changes (form opens with new tool)
    effect(() => {
      // Access config to track changes
      this.config();
      this.formData.set({});
    });
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
   * Handle execute button click.
   */
  onExecute(): void {
    if (!this.hasErrors()) {
      this.invokeOutput.emit({
        toolName: this.config().toolName,
        args: this.formData(),
      });
    }
  }
}
