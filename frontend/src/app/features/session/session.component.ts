/**
 * @fileoverview Session component for displaying an individual simulation session.
 *
 * This component provides the main simulation interface with:
 * - Blue header bar with "Simulating: {agentName}" and status badge
 * - Collapsible "System Instructions" section
 * - Split-pane layout with Event Stream (left) and Control Panel (right sidebar)
 *
 * Implements FR-001 (Session Navigation), FR-005 (Split-Pane Layout).
 *
 * @see mddocs/frontend/frontend-spec.md#fr-session-management
 * @see mddocs/frontend/frontend-spec.md#us-4-split-pane-interface-layout
 * @see mddocs/frontend/sprints/mocks/tool-selection.png
 */

import type { Content } from '@adk-sim/converters';
import {
  createTextResponse,
  createToolInvocationResponse,
  protoContentToGenaiContent,
} from '@adk-sim/converters';
import type { FunctionDeclaration as ProtoFunctionDeclaration } from '@adk-sim/protos';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import type { JsonSchema7 } from '@jsonforms/core';
import { map } from 'rxjs';

import { SessionGateway } from '../../data-access/session';
import { ToolFormService } from '../../data-access/tool-form';
import {
  ControlPanelComponent,
  type SessionStatusType,
  type ToolFormConfig,
} from '../../ui/control-panel';
import { EventStreamComponent } from '../../ui/event-stream';
import { SplitPaneComponent } from '../../ui/shared';
import { SimulationStore } from './simulation.store';

/**
 * Session status for the status badge.
 * Maps simulation state to visual indicators.
 */
type SessionStatus = 'awaiting' | 'active' | 'completed';

/**
 * Session component that displays an individual simulation session.
 *
 * Layout structure (from mocks):
 * - Header bar: Blue background with "Simulating: {agentName}" and status badge
 * - System Instructions: Collapsible accordion section
 * - Split-pane:
 *   - Left (main): Event Stream with header and placeholder content
 *   - Right (sidebar): Control Panel (400px width)
 *
 * @example
 * ```html
 * <!-- Rendered at /session/:id -->
 * <app-session></app-session>
 * ```
 */
@Component({
  selector: 'app-session',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    SplitPaneComponent,
    ControlPanelComponent,
    EventStreamComponent,
  ],
  providers: [SimulationStore],
  template: `
    <div class="session-container" data-testid="session-container">
      <!-- Header Bar -->
      <header class="session-header" data-testid="session-header">
        <div class="header-content">
          <mat-icon class="agent-icon">smart_toy</mat-icon>
          <span class="header-title">Simulating: {{ agentName() }}</span>
        </div>
        <div
          class="status-badge"
          [class.awaiting]="sessionStatus() === 'awaiting'"
          [class.active]="sessionStatus() === 'active'"
          [class.completed]="sessionStatus() === 'completed'"
          data-testid="status-badge"
        >
          {{ statusLabel() }}
        </div>
      </header>

      <!-- Split-Pane Layout -->
      <app-split-pane [sidebarWidth]="400" class="flex-1">
        <!-- Left Pane: System Instructions + Event Stream -->
        <div main class="main-pane" data-testid="main-pane">
          <!-- System Instructions (Collapsible) - Now inside main pane -->
          <div class="system-instructions" data-testid="system-instructions">
            <button
              class="instructions-header"
              (click)="toggleInstructions()"
              type="button"
              [attr.aria-expanded]="instructionsExpanded()"
              aria-controls="instructions-content"
            >
              <mat-icon class="instructions-icon">psychology</mat-icon>
              <span class="instructions-label">System Instructions</span>
              <mat-icon class="expand-icon">
                {{ instructionsExpanded() ? 'expand_less' : 'expand_more' }}
              </mat-icon>
            </button>
            @if (instructionsExpanded()) {
              <div
                class="instructions-content"
                id="instructions-content"
                data-testid="instructions-content"
              >
                @if (systemInstruction()) {
                  <pre class="instructions-text">{{ systemInstructionText() }}</pre>
                } @else {
                  <p class="no-instructions">No system instructions provided.</p>
                }
              </div>
            }
          </div>

          <!-- Event Stream Section -->
          <div class="event-stream-pane" data-testid="event-stream-pane">
            <div class="event-stream-header">
              <span class="event-stream-title">Event Stream</span>
              <div class="event-stream-actions">
                <button mat-icon-button type="button" aria-label="Expand all" title="Expand all">
                  <mat-icon>unfold_more</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  aria-label="Collapse all"
                  title="Collapse all"
                >
                  <mat-icon>unfold_less</mat-icon>
                </button>
              </div>
            </div>
            <div class="event-stream-content" data-testid="event-stream-content">
              <app-event-stream [events]="eventStreamContents()" />
            </div>
          </div>
        </div>

        <!-- Right Sidebar: Control Panel -->
        <div sidebar class="control-panel-sidebar" data-testid="control-panel-sidebar">
          <app-control-panel
            [tools]="availableTools()"
            [formConfigCreator]="boundCreateFormConfig"
            [outputSchema]="outputSchema()"
            [sessionStatus]="controlPanelStatus()"
            (toolInvoke)="onToolInvoke($event)"
            (finalResponse)="onFinalResponse($event)"
            (exportClick)="onExportClick()"
            data-testid="control-panel"
          />
        </div>
      </app-split-pane>
    </div>
  `,
  styles: `
    .session-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background-color: var(--sys-surface-container);
    }

    /* Header Bar */
    .session-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background-color: var(--color-action-accent);
      color: var(--sys-surface);
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .agent-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .header-title {
      font-size: 18px;
      font-weight: 500;
    }

    /* Status Badge */
    .status-badge {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-badge.awaiting {
      background-color: var(--color-warning-accent);
      color: var(--color-warning-on);
    }

    .status-badge.active {
      background-color: transparent;
      border: 2px solid var(--color-success-accent);
      color: var(--sys-surface);
    }

    .status-badge.completed {
      background-color: var(--color-success-accent);
      color: var(--sys-surface);
    }

    /* Split-Pane Content */
    app-split-pane {
      min-height: 0;
    }

    /* Main Pane (contains instructions + event stream) */
    .main-pane {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* System Instructions (inside main pane) */
    .system-instructions {
      flex-shrink: 0;
      background-color: var(--sys-surface);
      border-bottom: 1px solid var(--sys-outline-variant);
    }

    .instructions-header {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 12px 24px;
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
      gap: 12px;
      color: var(--sys-on-surface);
    }

    .instructions-header:hover {
      background-color: var(--sys-surface-container-high);
    }

    .instructions-icon {
      color: var(--sys-on-surface-variant);
    }

    .instructions-label {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
    }

    .expand-icon {
      color: var(--sys-on-surface-variant);
    }

    .instructions-content {
      padding: 0 24px 16px 60px;
      max-height: 200px;
      overflow-y: auto;
    }

    .instructions-text {
      margin: 0;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--sys-on-surface);
      line-height: 1.5;
    }

    .no-instructions {
      margin: 0;
      font-size: 14px;
      color: var(--sys-on-surface-variant);
      font-style: italic;
    }

    /* Event Stream Pane */
    .event-stream-pane {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      padding: 16px 24px;
    }

    .event-stream-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .event-stream-title {
      font-size: 16px;
      font-weight: 500;
      color: var(--sys-on-surface);
    }

    .event-stream-actions {
      display: flex;
      gap: 4px;
    }

    .event-stream-content {
      flex: 1;
      border: 1px solid var(--sys-outline-variant);
      border-radius: 8px;
      background-color: var(--sys-surface);
      overflow: auto;
    }

    /* Control Panel Sidebar */
    .control-panel-sidebar {
      padding: 16px;
      height: 100%;
      box-sizing: border-box;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(SimulationStore);
  private readonly toolFormService = inject(ToolFormService);
  private readonly gateway = inject(SessionGateway);
  private readonly destroyRef = inject(DestroyRef);

  /** Observable stream of route params converted to signal */
  private readonly params = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))));

  /** Current session ID from route parameters */
  readonly sessionId = computed(() => this.params() ?? 'Unknown');

  /**
   * Contents converted to genai format for EventStreamComponent.
   * The store holds proto Content[], but EventStreamComponent expects genai Content[].
   */
  readonly eventStreamContents = computed<Content[]>(() => {
    const protoContents = this.store.contents();
    return protoContents.map((c) => protoContentToGenaiContent(c));
  });

  /** AbortController for the current subscription */
  private abortController: AbortController | null = null;

  constructor() {
    // Set up cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.abortController?.abort();
      this.gateway.cancelSubscription();
    });

    // Reactively subscribe when session ID becomes available
    effect(() => {
      const sessionId = this.sessionId();
      if (sessionId && sessionId !== 'Unknown') {
        // Cancel any existing subscription
        this.abortController?.abort();
        this.abortController = new AbortController();

        void this.subscribeToEvents(sessionId, this.abortController.signal);
      }
    });
  }

  /**
   * Subscribe to session events and feed them to the store.
   */
  private async subscribeToEvents(sessionId: string, signal: AbortSignal): Promise<void> {
    try {
      for await (const event of this.gateway.subscribe(sessionId)) {
        if (signal.aborted) {
          break;
        }

        // Process llmRequest events - feed to store
        if (event.payload.case === 'llmRequest') {
          this.store.receiveRequest(event.payload.value, event.turnId);
        }
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      // Re-throw other errors to be handled by the caller
      throw error;
    }
  }

  /** Agent name for the header (derived from session or placeholder) */
  readonly agentName = computed(() => {
    // In a full implementation, this would come from session metadata
    // For now, use a placeholder that matches the mocks
    return 'TestAgent';
  });

  /** Internal state: whether system instructions are expanded */
  private readonly _instructionsExpanded = signal(false);
  readonly instructionsExpanded = this._instructionsExpanded.asReadonly();

  /** Session status for the status badge */
  readonly sessionStatus = computed<SessionStatus>(() => {
    // Derive status from store state
    if (!this.store.hasRequest()) {
      return 'awaiting';
    }
    // In a full implementation, 'completed' would be based on session state
    return 'active';
  });

  /** Status label for the badge */
  readonly statusLabel = computed(() => {
    const status = this.sessionStatus();
    switch (status) {
      case 'awaiting': {
        return 'Awaiting Query';
      }
      case 'active': {
        return 'Active';
      }
      case 'completed': {
        return 'Completed';
      }
    }
  });

  /** Control panel session status (mapped to its expected type) */
  readonly controlPanelStatus = computed<SessionStatusType>(() => {
    const status = this.sessionStatus();
    if (status === 'completed') return 'completed';
    return 'active';
  });

  /** Available tools from the simulation store */
  readonly availableTools = this.store.availableTools;

  /** System instruction from the current request */
  readonly systemInstruction = this.store.systemInstruction;

  /** System instruction as text */
  readonly systemInstructionText = computed(() => {
    const instruction = this.systemInstruction();
    if (!instruction?.parts || instruction.parts.length === 0) return '';
    // System instruction has parts array with text content
    // Proto Part uses discriminated union: data.case === 'text' means data.value is the text
    return instruction.parts
      .map((p) => (p.data.case === 'text' ? p.data.value : ''))
      .filter(Boolean)
      .join('\n');
  });

  /** Output schema for the final response form (from request config) */
  readonly outputSchema = computed(() => {
    const request = this.store.currentRequest();
    if (!request?.generationConfig?.responseSchema) return null;
    // Convert to JSON Schema if needed - for now return as-is
    return request.generationConfig.responseSchema as unknown as JsonSchema7;
  });

  /**
   * Wrapper function for form config creation.
   * Passes proto FunctionDeclaration directly to ToolFormService which handles
   * the proto → genai → JSON Schema conversion internally.
   */
  readonly boundCreateFormConfig = (tool: ProtoFunctionDeclaration): ToolFormConfig => {
    // Pass proto directly - ToolFormService will detect it's a proto and convert appropriately
    return this.toolFormService.createFormConfig(tool);
  };

  /** Toggle system instructions expanded state */
  toggleInstructions(): void {
    this._instructionsExpanded.update((v) => !v);
  }

  /** Handle tool invocation from control panel */
  onToolInvoke(event: { toolName: string; args: unknown }): void {
    const turnId = this.store.currentTurnId();
    const sessionId = this.sessionId();

    if (!turnId) {
      return;
    }

    // Create the response and submit
    const response = createToolInvocationResponse(
      event.toolName,
      event.args as Record<string, unknown>,
    );

    this.gateway
      .submitDecision(sessionId, turnId, response)
      .then(() => {
        // Advance the queue to handle the next request
        this.store.advanceQueue();
      })
      .catch(() => {
        // Error handling will be added in a future PR
      });
  }

  /** Handle final response from control panel */
  onFinalResponse(
    event: { type: 'text'; data: string } | { type: 'structured'; data: unknown },
  ): void {
    const turnId = this.store.currentTurnId();
    const sessionId = this.sessionId();

    if (!turnId) {
      return;
    }

    // Create the response based on type
    // For now, only handle text responses - structured will be handled in a future PR
    const response =
      event.type === 'text'
        ? createTextResponse(event.data)
        : createTextResponse(JSON.stringify(event.data));

    this.gateway
      .submitDecision(sessionId, turnId, response)
      .then(() => {
        // Advance the queue to handle the next request
        this.store.advanceQueue();
      })
      .catch(() => {
        // Error handling will be added in a future PR
      });
  }

  /** Handle export button click */
  onExportClick(): void {
    // Export functionality will be implemented in a future PR
  }
}
