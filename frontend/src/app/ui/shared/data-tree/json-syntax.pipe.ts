/**
 * @fileoverview Pipe for syntax highlighting JSON values.
 *
 * Converts a parsed JSON value into HTML with span elements for syntax
 * highlighting. Uses the same color scheme as the DataTreeComponent to
 * maintain visual consistency.
 *
 * @see data-tree.component.ts for color definitions
 */

import { inject, Pipe, type PipeTransform } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

/**
 * Indentation width in spaces per depth level.
 */
const INDENT_SPACES = 2;

/**
 * Escapes HTML special characters to prevent XSS.
 *
 * @param str - The string to escape
 * @returns The escaped string
 */
function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * CSS classes for syntax highlighting.
 * Using classes instead of inline styles for better compatibility.
 */
const CSS_CLASSES = {
  key: 'json-key',
  string: 'json-string',
  number: 'json-number',
  boolean: 'json-boolean',
  null: 'json-null',
  bracket: 'json-bracket',
};

/**
 * Formats a JSON value with syntax highlighting spans.
 *
 * @param value - The value to format
 * @param depth - Current indentation depth
 * @returns HTML string with syntax highlighting
 */
function formatValue(value: unknown, depth: number): string {
  const indent = ' '.repeat(depth * INDENT_SPACES);
  const nextIndent = ' '.repeat((depth + 1) * INDENT_SPACES);

  if (value === null) {
    return `<span class="${CSS_CLASSES.null}">null</span>`;
  }

  if (typeof value === 'boolean') {
    return `<span class="${CSS_CLASSES.boolean}">${String(value)}</span>`;
  }

  if (typeof value === 'number') {
    return `<span class="${CSS_CLASSES.number}">${String(value)}</span>`;
  }

  if (typeof value === 'string') {
    return `<span class="${CSS_CLASSES.string}">"${escapeHtml(value)}"</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `<span class="${CSS_CLASSES.bracket}">[]</span>`;
    }

    const items = value.map((item, index) => {
      const formattedItem = formatValue(item, depth + 1);
      const comma = index < value.length - 1 ? ',' : '';
      return `${nextIndent}${formattedItem}${comma}`;
    });

    return [
      `<span class="${CSS_CLASSES.bracket}">[</span>`,
      ...items,
      `${indent}<span class="${CSS_CLASSES.bracket}">]</span>`,
    ].join('\n');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      return `<span class="${CSS_CLASSES.bracket}">{}</span>`;
    }

    const items = entries.map(([key, val], index) => {
      const formattedKey = `<span class="${CSS_CLASSES.key}">"${escapeHtml(key)}"</span>`;
      const formattedValue = formatValue(val, depth + 1);
      const comma = index < entries.length - 1 ? ',' : '';
      return `${nextIndent}${formattedKey}: ${formattedValue}${comma}`;
    });

    return [
      `<span class="${CSS_CLASSES.bracket}">{</span>`,
      ...items,
      `${indent}<span class="${CSS_CLASSES.bracket}">}</span>`,
    ].join('\n');
  }

  // Fallback for undefined or other types
  return `<span class="${CSS_CLASSES.null}">null</span>`;
}

/**
 * Pipe that transforms a parsed JSON value into syntax-highlighted HTML.
 *
 * Uses the same CSS classes as DataTreeComponent for consistent styling:
 * - `.key` - Purple/magenta for object keys
 * - `.value.string` - Green for strings
 * - `.value.number` - Teal/cyan for numbers
 * - `.value.boolean` - Blue for booleans
 * - `.value.null` - Blue italic for null
 * - `.bracket` - Default color for braces/brackets
 *
 * Usage in template:
 * ```html
 * <pre [innerHTML]="parsedJson | jsonSyntax"></pre>
 * ```
 *
 * @example
 * // Input: { "model": "gemini-1.5-pro", "temperature": 0.7 }
 * // Output (HTML):
 * // <span class="bracket">{</span>
 * //   <span class="key">"model"</span>: <span class="value string">"gemini-1.5-pro"</span>,
 * //   <span class="key">"temperature"</span>: <span class="value number">0.7</span>
 * // <span class="bracket">}</span>
 */
@Pipe({
  name: 'jsonSyntax',
  standalone: true,
  pure: true,
})
export class JsonSyntaxPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * Transform a parsed JSON value to syntax-highlighted HTML.
   *
   * @param value - The parsed JSON value to transform
   * @returns SafeHtml that can be bound to [innerHTML]
   */
  transform(value: unknown): SafeHtml {
    if (value === undefined) {
      return '';
    }

    // Format the value with syntax highlighting
    const html = formatValue(value, 0);

    // We control all output (only span tags with class names and escaped text),
    // so we can bypass sanitization. The formatValue function ensures all text
    // content is properly escaped via escapeHtml().
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
