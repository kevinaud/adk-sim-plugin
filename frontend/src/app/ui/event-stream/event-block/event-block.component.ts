/**
 * @fileoverview Event block component for rendering conversation turns.
 *
 * Renders a single conversation turn (Content) with role-based styling.
 * Implements FR-007: Conversation history rendered as structured stream
 * of distinct blocks (User Input, Agent Response, Tool Call, Tool Response).
 *
 * Block type determination:
 * - 'user' role -> 'user' type (unless contains functionResponse)
 * - 'model' role with functionCall in parts -> 'tool-call' type
 * - 'model' role without functionCall -> 'model' type
 * - 'user' role with functionResponse -> 'tool-response' type (function results)
 *
 * Both tool-call and tool-response use 'tool' CSS type for orange accent styling,
 * but have distinct icons and labels for visual differentiation:
 * - Tool Call: call_made icon, "Tool Call" label
 * - Tool Response: call_received icon, "Tool Response" label
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-007
 * @see mddocs/frontend/frontend-tdd.md#eventblockcomponent
 */

import type { Content, Part } from '@adk-sim/converters';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Block type enum for styling differentiation.
 * Uses 'tool-call' and 'tool-response' for distinct tool sub-types.
 */
export type BlockType = 'user' | 'model' | 'tool-call' | 'tool-response';

/**
 * CSS type for styling - maps sub-types to parent category.
 * Both tool-call and tool-response map to 'tool' for CSS styling.
 */
export type CssBlockType = 'user' | 'model' | 'tool';

/**
 * Configuration for each block type.
 */
interface BlockConfig {
  icon: string;
  label: string;
  cssType: CssBlockType;
}

/**
 * Map of block type to display configuration.
 */
const BLOCK_CONFIG: Record<BlockType, BlockConfig> = {
  user: {
    icon: 'person',
    label: 'User Input',
    cssType: 'user',
  },
  model: {
    icon: 'smart_toy',
    label: 'Agent Response',
    cssType: 'model',
  },
  'tool-call': {
    icon: 'call_made',
    label: 'Tool Call',
    cssType: 'tool',
  },
  'tool-response': {
    icon: 'call_received',
    label: 'Tool Response',
    cssType: 'tool',
  },
};

/**
 * Event block component (FR-007).
 *
 * Renders a single conversation turn with appropriate styling based on
 * the content's role and parts. Uses computed signals for derived state.
 *
 * @example
 * ```html
 * <app-event-block [content]="contentItem" />
 * ```
 */
@Component({
  selector: 'app-event-block',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="event-block" [attr.data-type]="cssType()" data-testid="event-block">
      <div class="block-header">
        <mat-icon>{{ icon() }}</mat-icon>
        <span class="block-label">{{ label() }}</span>
      </div>
      <div class="block-content">
        @for (part of parts(); track $index) {
          @if (part.text) {
            <div class="text-part" data-testid="text-part">
              <pre class="text-content">{{ part.text }}</pre>
            </div>
          }
          @if (part.functionCall) {
            <div class="function-call" data-testid="function-call">
              <span class="function-name">{{ part.functionCall.name }}</span>
              <pre class="function-args">{{ formatArgs(part.functionCall.args) }}</pre>
            </div>
          }
          @if (part.functionResponse) {
            <div class="function-response" data-testid="function-response">
              <span class="function-name">{{ part.functionResponse.name }}</span>
              <pre class="function-result">{{ formatArgs(part.functionResponse.response) }}</pre>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .event-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px;
      background-color: var(--mat-sys-surface-container, #fafafa);
      border-radius: 8px;
      border-left: 4px solid var(--mat-sys-primary, #6750a4);
    }

    .event-block[data-type='user'] {
      border-left-color: #2196f3;
      background-color: rgba(33, 150, 243, 0.05);
    }

    .event-block[data-type='model'] {
      border-left-color: #4caf50;
      background-color: rgba(76, 175, 80, 0.05);
    }

    .event-block[data-type='tool'] {
      border-left-color: #ff9800;
      background-color: rgba(255, 152, 0, 0.05);
    }

    .block-header {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--mat-sys-on-surface, #1c1b1f);
    }

    mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .block-label {
      font-weight: 500;
      font-size: 14px;
    }

    .block-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .text-part {
      padding: 8px;
      background-color: var(--mat-sys-surface, #fff);
      border-radius: 4px;
    }

    .text-content {
      margin: 0;
      font-family: inherit;
      font-size: 14px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .function-call,
    .function-response {
      padding: 8px;
      background-color: var(--mat-sys-surface, #fff);
      border-radius: 4px;
      border: 1px solid var(--mat-sys-outline-variant, #cac4d0);
    }

    .function-name {
      display: block;
      font-weight: 600;
      font-size: 13px;
      color: var(--mat-sys-primary, #6750a4);
      margin-bottom: 4px;
    }

    .function-args,
    .function-result {
      margin: 0;
      font-family: 'Roboto Mono', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--mat-sys-on-surface-variant, #49454f);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventBlockComponent {
  /**
   * Input signal for the Content item to render.
   */
  readonly content = input.required<Content>();

  /**
   * Computed signal that determines the block type based on role and parts.
   *
   * Logic:
   * - 'user' role with functionResponse parts -> 'tool-response' (function results)
   * - 'user' role without functionResponse -> 'user'
   * - 'model' role with functionCall parts -> 'tool-call' (function calls)
   * - 'model' role without functionCall -> 'model'
   */
  readonly blockType = computed<BlockType>(() => {
    const c = this.content();
    const role = c.role ?? '';

    if (role === 'user') {
      // Check if it contains function response (tool result)
      const hasFunctionResponse = c.parts?.some((p: Part) => p.functionResponse);
      return hasFunctionResponse ? 'tool-response' : 'user';
    }

    // Model role
    const hasFunctionCall = c.parts?.some((p: Part) => p.functionCall);
    return hasFunctionCall ? 'tool-call' : 'model';
  });

  /**
   * Computed signal that maps block type to CSS type for styling.
   * Both tool-call and tool-response map to 'tool' for CSS styling.
   */
  readonly cssType = computed<CssBlockType>(() => BLOCK_CONFIG[this.blockType()].cssType);

  /**
   * Computed signal that extracts the parts array from content.
   * Returns empty array if parts is undefined.
   */
  readonly parts = computed<Part[]>(() => this.content().parts ?? []);

  /**
   * Computed signal that maps block type to Material icon name.
   */
  readonly icon = computed<string>(() => BLOCK_CONFIG[this.blockType()].icon);

  /**
   * Computed signal that maps block type to display label.
   */
  readonly label = computed<string>(() => BLOCK_CONFIG[this.blockType()].label);

  /**
   * Format function arguments or response for display.
   *
   * @param args - The arguments or response object to format
   * @returns JSON-formatted string or empty string if undefined
   */
  formatArgs(args: Record<string, unknown> | undefined): string {
    if (!args) return '';
    try {
      return JSON.stringify(args, null, 2);
    } catch {
      return '[unable to format]';
    }
  }
}
