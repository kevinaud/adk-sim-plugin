/**
 * @fileoverview SmartBlobComponent for rendering text with format toggles.
 *
 * A presentational component that displays text content with automatic
 * format detection and toggleable rendering modes:
 * - JSON: Renders parsed JSON as interactive DataTreeComponent
 * - Markdown: Renders as HTML using the marked library
 * - Raw: Displays unprocessed text preserving whitespace
 *
 * Format detection happens automatically on content change via an effect,
 * selecting the best rendering mode based on content analysis.
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-012 through FR-014
 * @see mddocs/frontend/frontend-tdd.md#smartblobcomponent
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

import { ContentDetectionService } from '../../../util/content-detection';
import { DataTreeComponent } from '../data-tree';
import { MarkdownPipe } from '../markdown-pipe';

/**
 * Display mode for content rendering.
 */
export type SmartBlobMode = 'json' | 'markdown' | 'raw';

/**
 * SmartBlobComponent (FR-012 through FR-014).
 *
 * Renders text content with format detection and mode toggles.
 * Auto-selects the best rendering mode based on content analysis:
 * - JSON strings are displayed as interactive DataTreeComponent
 * - Markdown content is rendered as HTML
 * - Plain text is shown in a preformatted block
 *
 * @example
 * ```html
 * <!-- Basic usage -->
 * <app-smart-blob [content]="someText" />
 *
 * <!-- With explicit initial mode -->
 * <app-smart-blob [content]="jsonString" [initialMode]="'raw'" />
 * ```
 */
@Component({
  selector: 'app-smart-blob',
  standalone: true,
  imports: [DataTreeComponent, MarkdownPipe],
  template: `
    <div class="smart-blob" data-testid="smart-blob">
      <div class="blob-controls" data-testid="blob-controls">
        @if (isJson()) {
          <button
            type="button"
            class="mode-toggle"
            [class.active]="mode() === 'json'"
            (click)="setMode('json')"
            data-testid="json-toggle"
          >
            [JSON]
          </button>
        }
        @if (isMarkdown()) {
          <button
            type="button"
            class="mode-toggle"
            [class.active]="mode() === 'markdown'"
            (click)="setMode('markdown')"
            data-testid="markdown-toggle"
          >
            [MD]
          </button>
        }
        <button
          type="button"
          class="mode-toggle"
          [class.active]="mode() === 'raw'"
          (click)="setMode('raw')"
          data-testid="raw-toggle"
        >
          [RAW]
        </button>
      </div>
      <div class="blob-content" data-testid="blob-content">
        @switch (mode()) {
          @case ('json') {
            <app-data-tree [data]="parsedJson()" data-testid="json-view" />
          }
          @case ('markdown') {
            <div
              class="markdown-content"
              [innerHTML]="content() | markdown"
              data-testid="markdown-view"
            ></div>
          }
          @case ('raw') {
            <pre class="raw-content" data-testid="raw-view">{{ content() }}</pre>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .smart-blob {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .blob-controls {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .mode-toggle {
      padding: 2px 8px;
      font-size: 11px;
      font-family: 'Roboto Mono', monospace;
      font-weight: 500;
      border: 1px solid var(--mat-sys-outline-variant, #cac4d0);
      border-radius: 4px;
      background-color: var(--mat-sys-surface, #fff);
      color: var(--mat-sys-on-surface-variant, #49454f);
      cursor: pointer;
      transition:
        background-color 0.15s,
        border-color 0.15s,
        color 0.15s;
    }

    .mode-toggle:hover {
      background-color: var(--mat-sys-surface-container-high, #e6e0e9);
    }

    .mode-toggle.active {
      background-color: var(--mat-sys-primary-container, #eaddff);
      border-color: var(--mat-sys-primary, #6750a4);
      color: var(--mat-sys-on-primary-container, #21005d);
    }

    .blob-content {
      padding: 12px;
      background-color: var(--mat-sys-surface-container, #f3edf7);
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant, #cac4d0);
      overflow: auto;
    }

    .raw-content {
      margin: 0;
      font-family: 'Roboto Mono', monospace;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--mat-sys-on-surface, #1c1b1f);
    }

    /* Markdown content styling */
    .markdown-content {
      font-size: 14px;
      line-height: 1.6;
      color: var(--mat-sys-on-surface, #1c1b1f);
    }

    .markdown-content h1,
    .markdown-content h2,
    .markdown-content h3,
    .markdown-content h4,
    .markdown-content h5,
    .markdown-content h6 {
      margin-top: 16px;
      margin-bottom: 8px;
      font-weight: 600;
      line-height: 1.25;
    }

    .markdown-content h1 {
      font-size: 1.5em;
    }
    .markdown-content h2 {
      font-size: 1.25em;
    }
    .markdown-content h3 {
      font-size: 1.1em;
    }

    .markdown-content p {
      margin-top: 0;
      margin-bottom: 12px;
    }

    .markdown-content code {
      padding: 2px 6px;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.9em;
      background-color: var(--mat-sys-surface-container-highest, #e6e0e9);
      border-radius: 4px;
    }

    .markdown-content pre {
      padding: 12px;
      margin: 12px 0;
      overflow: auto;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.9em;
      background-color: var(--mat-sys-surface-container-highest, #e6e0e9);
      border-radius: 6px;
    }

    .markdown-content pre code {
      padding: 0;
      background-color: transparent;
    }

    .markdown-content ul,
    .markdown-content ol {
      margin-top: 0;
      margin-bottom: 12px;
      padding-left: 24px;
    }

    .markdown-content li {
      margin-bottom: 4px;
    }

    .markdown-content blockquote {
      margin: 12px 0;
      padding: 8px 16px;
      border-left: 4px solid var(--mat-sys-primary, #6750a4);
      background-color: var(--mat-sys-surface-container-highest, #e6e0e9);
    }

    .markdown-content a {
      color: var(--mat-sys-primary, #6750a4);
      text-decoration: none;
    }

    .markdown-content a:hover {
      text-decoration: underline;
    }

    .markdown-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }

    .markdown-content th,
    .markdown-content td {
      padding: 8px;
      border: 1px solid var(--mat-sys-outline-variant, #cac4d0);
      text-align: left;
    }

    .markdown-content th {
      background-color: var(--mat-sys-surface-container-highest, #e6e0e9);
      font-weight: 600;
    }

    .markdown-content hr {
      border: none;
      border-top: 1px solid var(--mat-sys-outline-variant, #cac4d0);
      margin: 16px 0;
    }

    .markdown-content img {
      max-width: 100%;
      height: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmartBlobComponent {
  private readonly detectionService = inject(ContentDetectionService);

  /**
   * Input signal for the text content to render.
   * Required input - component won't function without content.
   */
  readonly content = input.required<string>();

  /**
   * Optional initial mode override.
   * If not provided, mode is auto-detected from content.
   */
  readonly initialMode = input<SmartBlobMode>();

  /**
   * Current display mode (writable signal).
   * Can be changed by user clicking toggle buttons.
   */
  private readonly _mode = signal<SmartBlobMode>('raw');
  readonly mode = this._mode.asReadonly();

  /**
   * Computed signal: whether content is valid JSON.
   */
  readonly isJson = computed(() => this.detectionService.isJson(this.content()));

  /**
   * Computed signal: whether content contains markdown.
   */
  readonly isMarkdown = computed(() => this.detectionService.isMarkdown(this.content()));

  /**
   * Computed signal: parsed JSON object for DataTreeComponent.
   * Returns the parsed object if valid, otherwise null.
   */
  readonly parsedJson = computed(() => {
    return this.detectionService.parseJson(this.content());
  });

  constructor() {
    // Effect to auto-select best mode when content changes
    effect(() => {
      const contentValue = this.content();
      const initial = this.initialMode();

      // Use untracked to avoid re-running when mode changes
      untracked(() => {
        if (initial) {
          // Use provided initial mode
          this._mode.set(initial);
        } else {
          // Auto-detect best mode
          const bestMode = this.detectionService.detectBestMode(contentValue);
          this._mode.set(bestMode);
        }
      });
    });
  }

  /**
   * Set the display mode.
   * Called when user clicks a toggle button.
   *
   * @param newMode - The mode to switch to
   */
  setMode(newMode: SmartBlobMode): void {
    this._mode.set(newMode);
  }
}
