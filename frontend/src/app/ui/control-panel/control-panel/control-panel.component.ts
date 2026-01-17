/**
 * @fileoverview Control panel container component for orchestrating response construction.
 *
 * This component serves as the main container for the simulation control panel,
 * orchestrating the tool catalog, tool form, and final response components with
 * tab-based navigation.
 *
 * Features:
 * - Tab navigation between "CALL TOOL" and "FINAL RESPONSE" actions
 * - Tool selection flow: catalog -> tool form -> back to catalog
 * - Session completed state with export functionality
 * - Accepts formConfigCreator function for schema conversion (injected by parent)
 *
 * @see mddocs/frontend/frontend-tdd.md#control-panel-components
 * @see mddocs/frontend/sprints/mocks/components/ActionPanel_Default_default.png
 */

import type { FunctionDeclaration } from '@adk-sim/protos';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  InjectionToken,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { JsonSchema7 } from '@jsonforms/core';

import { FinalResponseComponent } from '../final-response';
import { ToolCatalogComponent } from '../tool-catalog';
import { ToolFormComponent, type ToolFormConfig, type ToolInvokeEvent } from '../tool-form';

/**
 * Session status type for determining panel state.
 * Uses string literals for compatibility with proto enum values.
 */
export type SessionStatusType = 'active' | 'completed' | 'cancelled' | 'unspecified';

/**
 * Active tab type for tab navigation.
 */
type ActiveTab = 'tool' | 'response';

/**
 * Function type for creating form config from a tool declaration.
 * This is provided by the parent component (typically via ToolFormService).
 */
export type FormConfigCreator = (tool: FunctionDeclaration) => ToolFormConfig;

/**
 * Injection token for providing a FormConfigCreator function.
 * Used by tests to inject the form config creator without violating Sheriff rules.
 */
export const FORM_CONFIG_CREATOR = new InjectionToken<FormConfigCreator>('FormConfigCreator');

/**
 * Control panel container component (FR-005).
 *
 * Orchestrates the tool catalog, tool form, and final response components
 * with tab-based navigation. Manages internal state for active tab and
 * selected tool.
 *
 * @example
 * ```html
 * <app-control-panel
 *   [tools]="availableTools()"
 *   [formConfigCreator]="createFormConfig"
 *   [outputSchema]="responseSchema"
 *   [sessionStatus]="'active'"
 *   (toolInvoke)="onToolInvoke($event)"
 *   (finalResponse)="onFinalResponse($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    ToolCatalogComponent,
    ToolFormComponent,
    FinalResponseComponent,
  ],
  template: `
    <div class="control-panel" data-testid="control-panel">
      @if (isSessionCompleted()) {
        <!-- Session Completed State -->
        <div class="completed-state" data-testid="completed-state">
          <div class="checkmark-container">
            <mat-icon class="checkmark-icon">check_circle</mat-icon>
          </div>
          <h2 class="completed-title">Session Completed</h2>
          <p class="completed-message">Export the Golden Trace to save this simulation.</p>
          <button
            mat-flat-button
            class="export-button"
            (click)="onExportClick()"
            data-testid="export-button"
          >
            <mat-icon>download</mat-icon>
            EXPORT GOLDEN TRACE
          </button>
        </div>
      } @else {
        <!-- Header -->
        <h2 class="panel-header" data-testid="panel-header">Choose Action</h2>

        <!-- Tab Navigation -->
        <div class="tab-navigation" role="tablist" data-testid="tab-navigation">
          <button
            type="button"
            role="tab"
            class="tab"
            [class.active]="activeTab() === 'tool'"
            [attr.aria-selected]="activeTab() === 'tool'"
            (click)="setActiveTab('tool')"
            data-testid="tab-tool"
          >
            <mat-icon>build</mat-icon>
            <span>CALL TOOL</span>
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            [class.active]="activeTab() === 'response'"
            [attr.aria-selected]="activeTab() === 'response'"
            (click)="setActiveTab('response')"
            data-testid="tab-response"
          >
            <mat-icon>send</mat-icon>
            <span>FINAL RESPONSE</span>
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content" data-testid="tab-content">
          @if (activeTab() === 'tool') {
            @if (showToolForm()) {
              <!-- Tool Form View -->
              <app-tool-form
                [config]="toolFormConfig()!"
                (back)="onBackToActions()"
                (invokeOutput)="onToolInvoke($event)"
                data-testid="tool-form-view"
              />
            } @else {
              <!-- Tool Catalog View -->
              <div class="catalog-view" data-testid="catalog-view">
                <p class="select-label">Select a tool:</p>
                <app-tool-catalog
                  [tools]="tools()"
                  [selectedTool]="selectedTool()"
                  (selectTool)="onToolSelect($event)"
                />
              </div>
            }
          } @else {
            <!-- Final Response View -->
            <app-final-response
              [outputSchema]="outputSchema()"
              (submitText)="onTextResponse($event)"
              (submitStructured)="onStructuredResponse($event)"
              data-testid="final-response-view"
            />
          }
        </div>
      }
    </div>
  `,
  styles: `
    .control-panel {
      display: flex;
      flex-direction: column;
      min-height: 200px; /* Minimum height for visibility */
      background: var(--mat-sys-surface, #fff);
      border: 1px solid var(--mat-sys-outline-variant, #cac4d0);
      border-radius: 12px;
      overflow: hidden;
    }

    .panel-header {
      margin: 0;
      padding: 16px 16px 0;
      font-size: 20px;
      font-weight: 500;
      color: var(--mat-sys-on-surface, #1c1b1f);
    }

    /* Tab Navigation */
    .tab-navigation {
      display: flex;
      padding: 16px 16px 0;
      gap: 0;
    }

    .tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px 24px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      color: var(--mat-sys-on-surface-variant, #49454f);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.5px;
      transition:
        color 0.2s,
        border-color 0.2s;

      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      &:hover {
        color: var(--mat-sys-on-surface, #1c1b1f);
      }

      &.active {
        color: var(--mat-sys-on-surface, #1c1b1f);
        border-bottom-color: var(--mat-sys-on-surface, #1c1b1f);
      }
    }

    /* Tab Content */
    .tab-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .catalog-view {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .select-label {
      margin: 0;
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant, #49454f);
    }

    /* Completed State */
    .completed-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      gap: 16px;
    }

    .checkmark-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background-color: rgba(76, 175, 80, 0.1);
    }

    .checkmark-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #4caf50;
    }

    .completed-title {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      color: var(--mat-sys-on-surface, #1c1b1f);
    }

    .completed-message {
      margin: 0;
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant, #49454f);
    }

    .export-button {
      background-color: #4caf50 !important;
      color: white !important;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlPanelComponent {
  /**
   * Injected form config creator (optional, can also be passed via input).
   */
  private readonly injectedFormConfigCreator = inject(FORM_CONFIG_CREATOR, { optional: true });

  /**
   * List of available tools (from SimulationStore.availableTools).
   */
  readonly tools = input<FunctionDeclaration[]>([]);

  /**
   * Function to create form config from a tool declaration.
   * Can be provided via input or injected via FORM_CONFIG_CREATOR token.
   */
  readonly formConfigCreator = input<FormConfigCreator | undefined>();

  /**
   * Optional output schema for structured final responses.
   */
  readonly outputSchema = input<JsonSchema7 | null>(null);

  /**
   * Session status for determining completed state.
   */
  readonly sessionStatus = input<SessionStatusType>('active');

  /**
   * Emits when a tool is invoked with arguments.
   */
  readonly toolInvoke = output<ToolInvokeEvent>();

  /**
   * Emits when a final response is submitted (text or structured).
   */
  readonly finalResponse = output<
    { type: 'text'; data: string } | { type: 'structured'; data: unknown }
  >();

  /**
   * Emits when the export button is clicked in completed state.
   */
  readonly exportClick = output();

  /**
   * Internal state: currently active tab.
   */
  private readonly _activeTab = signal<ActiveTab>('tool');
  readonly activeTab = this._activeTab.asReadonly();

  /**
   * Internal state: currently selected tool (for showing form).
   */
  private readonly _selectedTool = signal<FunctionDeclaration | null>(null);
  readonly selectedTool = this._selectedTool.asReadonly();

  /**
   * Internal state: whether to show the tool form (vs catalog).
   */
  private readonly _showToolForm = signal(false);
  readonly showToolForm = this._showToolForm.asReadonly();

  /**
   * Computed: whether the session is completed.
   */
  readonly isSessionCompleted = computed(() => this.sessionStatus() === 'completed');

  /**
   * Computed: effective form config creator (input takes precedence over injection).
   */
  private readonly effectiveFormConfigCreator = computed(
    () => this.formConfigCreator() ?? this.injectedFormConfigCreator,
  );

  /**
   * Computed: tool form configuration for the selected tool.
   */
  readonly toolFormConfig = computed(() => {
    const tool = this._selectedTool();
    const creator = this.effectiveFormConfigCreator();
    return tool && creator ? creator(tool) : null;
  });

  /**
   * Sets the active tab.
   */
  setActiveTab(tab: ActiveTab): void {
    this._activeTab.set(tab);
  }

  /**
   * Handles tool selection from the catalog.
   * Transitions to tool form view.
   */
  onToolSelect(tool: FunctionDeclaration): void {
    this._selectedTool.set(tool);
    this._showToolForm.set(true);
  }

  /**
   * Handles back navigation from tool form.
   * Returns to catalog view.
   */
  onBackToActions(): void {
    this._showToolForm.set(false);
    this._selectedTool.set(null);
  }

  /**
   * Handles tool invocation from the tool form.
   */
  onToolInvoke(event: ToolInvokeEvent): void {
    this.toolInvoke.emit(event);
    // Return to catalog after invocation
    this.onBackToActions();
  }

  /**
   * Handles text response submission.
   */
  onTextResponse(text: string): void {
    this.finalResponse.emit({ type: 'text', data: text });
  }

  /**
   * Handles structured response submission.
   */
  onStructuredResponse(data: unknown): void {
    this.finalResponse.emit({ type: 'structured', data });
  }

  /**
   * Handles export button click in completed state.
   */
  onExportClick(): void {
    this.exportClick.emit();
  }
}
