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
  DestroyRef,
  effect,
  inject,
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

import type { ToolFormConfig, ToolInvokeEvent } from './tool-form.types';

/**
 * Recursively adds `showUnfocusedDescription: true` to all Control elements
 * in a UI schema so field descriptions are always visible.
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
        <span class="timer" data-testid="timer">{{ formattedTime() }}</span>
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
      justify-content: space-between;
      margin-top: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--mat-sys-outline-variant, #cac4d0);
    }

    .timer {
      font-size: 14px;
      font-family: 'Roboto Mono', monospace;
      color: var(--mat-sys-on-surface-variant, #49454f);
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
  private readonly destroyRef = inject(DestroyRef);

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
   * JSONForms renderers (Angular Material).
   */
  readonly renderers = angularMaterialRenderers;

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

  /**
   * Elapsed time in seconds since the form was opened.
   */
  private readonly elapsedSeconds = signal(0);

  /**
   * Formatted elapsed time string (e.g., "0.00s").
   */
  readonly formattedTime = computed(() => {
    const seconds = this.elapsedSeconds();
    return `${seconds.toFixed(2)}s`;
  });

  /**
   * Timer interval ID for cleanup.
   */
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start timer when config changes (form opens)
    effect(() => {
      // Access config to track changes
      this.config();

      // Reset timer
      this.elapsedSeconds.set(0);
      this.formData.set({});

      // Clear any existing timer
      if (this.timerId) {
        clearInterval(this.timerId);
      }

      // Start new timer (updates every 10ms for smooth display)
      this.timerId = setInterval(() => {
        this.elapsedSeconds.update((t) => t + 0.01);
      }, 10);
    });

    // Cleanup timer on destroy
    this.destroyRef.onDestroy(() => {
      if (this.timerId) {
        clearInterval(this.timerId);
      }
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
