/**
 * @fileoverview Tool catalog component for displaying available tools.
 *
 * Renders a list of available tools with expandable parameter previews.
 * This is a "dumb" UI component that receives tools via input and emits
 * selection events via output.
 *
 * Features:
 * - Tool cards with name, description, and radio button selection
 * - Collapsible parameters section per tool (collapsed by default)
 * - Parameter display with type badges (STRING, INTEGER, OBJECT, etc.)
 * - Required field indicators (asterisk suffix)
 * - Visual highlight for selected tool
 *
 * @see mddocs/frontend/frontend-tdd.md#toolcatalogcomponent
 * @see mddocs/frontend/sprints/mocks/components/ToolCatalog_Default_default.png
 */

import type { FunctionDeclaration } from '@adk-sim/protos';
import { Type } from '@adk-sim/protos';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';

/**
 * Represents a parameter extracted from a tool's schema.
 */
interface ParameterInfo {
  /** Parameter name */
  name: string;
  /** Parameter type (STRING, INTEGER, etc.) */
  type: string;
  /** Whether the parameter is required */
  required: boolean;
  /** Parameter description */
  description: string;
}

/**
 * Maps proto Type enum values to display strings.
 */
function getTypeDisplayName(type: Type | undefined): string {
  switch (type) {
    case Type.STRING: {
      return 'STRING';
    }
    case Type.NUMBER: {
      return 'NUMBER';
    }
    case Type.INTEGER: {
      return 'INTEGER';
    }
    case Type.BOOLEAN: {
      return 'BOOLEAN';
    }
    case Type.ARRAY: {
      return 'ARRAY';
    }
    case Type.OBJECT: {
      return 'OBJECT';
    }
    case Type.NULL: {
      return 'NULL';
    }
    default: {
      return 'UNKNOWN';
    }
  }
}

/**
 * Extracts parameter information from a FunctionDeclaration's schema.
 */
function extractParameters(tool: FunctionDeclaration): ParameterInfo[] {
  const params: ParameterInfo[] = [];

  // Check parametersJsonSchema first (already JSON Schema format)
  if (tool.parametersJsonSchema) {
    const jsonSchema = tool.parametersJsonSchema as {
      properties?: Record<string, { type?: string; description?: string }>;
      required?: string[];
    };

    if (jsonSchema.properties) {
      const required = jsonSchema.required ?? [];
      for (const [name, prop] of Object.entries(jsonSchema.properties)) {
        params.push({
          name,
          type: (prop.type ?? 'unknown').toUpperCase(),
          required: required.includes(name),
          description: prop.description ?? '',
        });
      }
    }
    return params;
  }

  // Fall back to parameters (proto Schema format)
  if (tool.parameters?.properties) {
    const required = tool.parameters.required;
    for (const [name, prop] of Object.entries(tool.parameters.properties)) {
      params.push({
        name,
        type: getTypeDisplayName(prop.type),
        required: required.includes(name),
        description: prop.description,
      });
    }
  }

  return params;
}

/**
 * Tool catalog component for displaying and selecting tools (FR-016).
 *
 * Renders a list of available tools with expandable parameter sections.
 * Follows the mock design in tool-selection.png and ToolCatalog_Default_default.png.
 *
 * @example
 * ```html
 * <app-tool-catalog
 *   [tools]="availableTools()"
 *   [selectedTool]="selectedTool()"
 *   (selectTool)="onToolSelect($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-tool-catalog',
  standalone: true,
  imports: [MatIconModule, MatRadioModule, MatButtonModule],
  template: `
    <div class="tool-catalog" data-testid="tool-catalog">
      <!-- Header -->
      <div class="catalog-header" data-testid="catalog-header">
        <mat-icon class="header-icon">build</mat-icon>
        <span class="header-title">Tools ({{ tools().length }})</span>
        <button
          type="button"
          class="collapse-toggle"
          (click)="toggleAllCollapsed()"
          data-testid="collapse-toggle"
        >
          <mat-icon>{{ allCollapsed() ? 'expand_more' : 'expand_less' }}</mat-icon>
        </button>
      </div>

      <!-- Tool cards -->
      @for (tool of tools(); track tool.name) {
        <div
          class="tool-card"
          [class.selected]="isSelected(tool)"
          data-testid="tool-card"
          [attr.data-tool-name]="tool.name"
        >
          <!-- Tool header row -->
          <div
            class="tool-header"
            tabindex="0"
            role="button"
            (click)="onToolClick(tool)"
            (keydown.enter)="onToolClick(tool)"
            (keydown.space)="onToolClick(tool)"
          >
            <mat-icon class="tool-icon">build</mat-icon>
            <span class="tool-name" data-testid="tool-name">{{ tool.name }}</span>
            <mat-radio-button
              [checked]="isSelected(tool)"
              (click)="$event.stopPropagation()"
              (change)="onToolClick(tool)"
              class="tool-radio"
              data-testid="tool-radio"
            />
          </div>

          <!-- Tool description -->
          @if (tool.description) {
            <p class="tool-description" data-testid="tool-description">
              {{ tool.description }}
            </p>
          }

          <!-- Parameters section -->
          @if (getParameters(tool).length > 0) {
            <div class="parameters-section">
              <button
                type="button"
                class="parameters-header"
                (click)="toggleParameters($event, tool.name)"
                data-testid="parameters-toggle"
              >
                <span class="parameters-icon">{{ '{}' }}</span>
                <span class="parameters-label">Parameters</span>
                <mat-icon class="expand-icon">
                  {{ isParametersExpanded(tool.name) ? 'expand_less' : 'expand_more' }}
                </mat-icon>
              </button>

              @if (isParametersExpanded(tool.name)) {
                <div class="parameters-list" data-testid="parameters-list">
                  @for (param of getParameters(tool); track param.name) {
                    <div class="parameter-item" data-testid="parameter-item">
                      <div class="parameter-header">
                        <span class="parameter-name">
                          {{ param.name }}{{ param.required ? '*' : '' }}:
                        </span>
                        <span class="type-badge" [attr.data-type]="param.type">
                          {{ param.type }}
                        </span>
                      </div>
                      @if (param.description) {
                        <p class="parameter-description">{{ param.description }}</p>
                      }
                    </div>
                  }

                  @if (hasRequiredParameters(tool)) {
                    <p class="required-footer" data-testid="required-footer">* required</p>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Empty state -->
      @if (tools().length === 0) {
        <div class="empty-state" data-testid="empty-state">
          <mat-icon>build_circle</mat-icon>
          <p>No tools available</p>
        </div>
      }

      <!-- Select tool button -->
      <button
        mat-flat-button
        color="primary"
        class="select-button"
        [disabled]="!hasSelection()"
        (click)="onSelectToolClick()"
        data-testid="select-tool-button"
      >
        <mat-icon>arrow_forward</mat-icon>
        SELECT TOOL
      </button>
    </div>
  `,
  styles: `
    .tool-catalog {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 0;
    }

    .catalog-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
    }

    .header-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--sys-on-surface-variant);
    }

    .header-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--sys-on-surface);
      flex: 1;
    }

    .collapse-toggle {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: var(--sys-on-surface-variant);
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background-color: var(--sys-surface-variant);
        border-radius: 50%;
      }
    }

    .tool-card {
      border: 1px solid var(--sys-outline-variant);
      border-radius: 8px;
      padding: 16px;
      background: var(--sys-surface);
      transition:
        border-color 0.2s,
        box-shadow 0.2s;

      &:hover {
        border-color: var(--sys-outline);
      }

      &.selected {
        border-color: var(--sys-primary);
        box-shadow: 0 0 0 1px var(--sys-primary);
      }
    }

    .tool-header {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .tool-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--sys-primary);
    }

    .tool-name {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
      color: var(--sys-primary);
      font-family: 'Roboto Mono', monospace;
    }

    .tool-radio {
      margin: 0;
    }

    .tool-description {
      margin: 8px 0 0 0;
      font-size: 13px;
      color: var(--sys-on-surface-variant);
      line-height: 1.5;
    }

    .parameters-section {
      margin-top: 12px;
      border-top: 1px solid var(--sys-outline-variant);
      padding-top: 12px;
    }

    .parameters-header {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      background: none;
      border: none;
      padding: 4px 0;
      cursor: pointer;
      color: var(--sys-on-surface);
      font-size: 13px;
      font-weight: 500;

      &:hover {
        color: var(--sys-primary);
      }
    }

    .parameters-icon {
      font-size: 13px;
      font-family: 'Roboto Mono', monospace;
      color: var(--sys-on-surface-variant);
    }

    .parameters-label {
      flex: 1;
      text-align: left;
    }

    .expand-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .parameters-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 8px;
    }

    .parameter-item {
      padding-left: 4px;
    }

    .parameter-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .parameter-name {
      font-size: 13px;
      font-family: 'Roboto Mono', monospace;
      color: var(--sys-primary);
    }

    .type-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 500;
      font-family: 'Roboto Mono', monospace;
      border-radius: 4px;
      background-color: var(--sys-primary);
      color: var(--sys-on-primary);
      text-transform: uppercase;
    }

    .parameter-description {
      margin: 4px 0 0 16px;
      font-size: 12px;
      color: var(--sys-on-surface-variant);
      line-height: 1.4;
    }

    .required-footer {
      margin: 8px 0 0 0;
      font-size: 11px;
      font-style: italic;
      color: var(--sys-on-surface-variant);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      color: var(--sys-on-surface-variant);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
        opacity: 0.5;
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }

    .select-button {
      display: flex;
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
export class ToolCatalogComponent {
  /**
   * List of available tools to display.
   */
  readonly tools = input<FunctionDeclaration[]>([]);

  /**
   * Currently selected tool (for highlighting).
   */
  readonly selectedTool = input<FunctionDeclaration | null>(null);

  /**
   * Emits when the user selects a tool (final selection via button).
   */
  readonly selectTool = output<FunctionDeclaration>();

  /**
   * Tracks which tool parameters sections are expanded.
   */
  private readonly expandedParameters = signal<Set<string>>(new Set());

  /**
   * Tracks the internally selected tool (before final selection).
   */
  private readonly internalSelection = signal<FunctionDeclaration | null>(null);

  /**
   * Computed signal for whether all parameters are collapsed.
   */
  readonly allCollapsed = computed(() => this.expandedParameters().size === 0);

  /**
   * Computed signal for whether any tool is selected (internal or external).
   */
  readonly hasSelection = computed(
    () => this.selectedTool() !== null || this.internalSelection() !== null,
  );

  /**
   * Cache for extracted parameters to avoid recomputation.
   */
  private readonly parametersCache = new Map<string, ParameterInfo[]>();

  /**
   * Gets the effective selected tool (external input takes precedence).
   */
  private getEffectiveSelection(): FunctionDeclaration | null {
    return this.selectedTool() ?? this.internalSelection();
  }

  /**
   * Checks if a tool is currently selected.
   */
  isSelected(tool: FunctionDeclaration): boolean {
    const selection = this.getEffectiveSelection();
    return selection?.name === tool.name;
  }

  /**
   * Gets parameters for a tool (cached).
   */
  getParameters(tool: FunctionDeclaration): ParameterInfo[] {
    if (!this.parametersCache.has(tool.name)) {
      this.parametersCache.set(tool.name, extractParameters(tool));
    }
    // The cache always has the value at this point because we just set it
    const cachedValue = this.parametersCache.get(tool.name);
    return cachedValue ?? [];
  }

  /**
   * Checks if a tool has required parameters.
   */
  hasRequiredParameters(tool: FunctionDeclaration): boolean {
    return this.getParameters(tool).some((p) => p.required);
  }

  /**
   * Checks if parameters section is expanded for a tool.
   */
  isParametersExpanded(toolName: string): boolean {
    return this.expandedParameters().has(toolName);
  }

  /**
   * Toggles the parameters section for a tool.
   */
  toggleParameters(event: Event, toolName: string): void {
    event.stopPropagation();
    this.expandedParameters.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(toolName)) {
        newSet.delete(toolName);
      } else {
        newSet.add(toolName);
      }
      return newSet;
    });
  }

  /**
   * Toggles all parameters sections collapsed/expanded.
   */
  toggleAllCollapsed(): void {
    if (this.allCollapsed()) {
      // Expand all
      const allToolNames = this.tools().map((t) => t.name);
      this.expandedParameters.set(new Set(allToolNames));
    } else {
      // Collapse all
      this.expandedParameters.set(new Set());
    }
  }

  /**
   * Handles tool card click - selects the tool internally.
   */
  onToolClick(tool: FunctionDeclaration): void {
    this.internalSelection.set(tool);
  }

  /**
   * Handles the SELECT TOOL button click - emits the final selection.
   */
  onSelectToolClick(): void {
    const selection = this.getEffectiveSelection();
    if (selection) {
      this.selectTool.emit(selection);
    }
  }
}
