/**
 * @fileoverview Content detection service for SmartBlobComponent.
 *
 * Provides utilities to detect whether a string contains valid JSON
 * or markdown content, enabling the SmartBlobComponent to auto-select
 * the best rendering mode.
 *
 * Detection heuristics:
 * - JSON: Validates by attempting to parse with JSON.parse()
 * - Markdown: Detects common markdown patterns (headers, links, lists, code blocks)
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-012 through FR-014
 * @see mddocs/frontend/frontend-tdd.md#smartblobcomponent
 */

import { Injectable } from '@angular/core';

/**
 * Service for detecting content types in strings.
 *
 * Used by SmartBlobComponent to determine which rendering modes
 * should be available for a given content string.
 *
 * @example
 * ```typescript
 * const service = inject(ContentDetectionService);
 * if (service.isJson('{"key": "value"}')) {
 *   // Show JSON toggle
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ContentDetectionService {
  /**
   * Regular expressions for detecting markdown patterns.
   * Content is considered markdown if it matches at least one pattern.
   */
  private readonly markdownPatterns: RegExp[] = [
    // Headers: # Header, ## Header, etc.
    /^#{1,6}\s+.+$/m,
    // Bold: **text** or __text__
    /\*\*[^*]+\*\*|__[^_]+__/,
    // Italic: *text* or _text_ (excluding file paths like _foo_bar)
    /(?<!\w)\*[^*\s][^*]*\*(?!\w)|(?<![\w/])_[^_\s][^_]*_(?![\w/])/,
    // Links: [text](url) or [text][ref]
    /\[[^\]]+\]\([^)]+\)|\[[^\]]+\]\[[^\]]*\]/,
    // Images: ![alt](url)
    /!\[[^\]]*\]\([^)]+\)/,
    // Code blocks: ```lang or indented by 4 spaces
    /^```[\s\S]*?^```|^ {4,}\S/m,
    // Inline code: `code`
    /`[^`]+`/,
    // Lists: - item, * item, + item, 1. item
    /^[\s]*[-*+]\s+.+$|^[\s]*\d+\.\s+.+$/m,
    // Blockquotes: > text
    /^>\s+.+$/m,
    // Horizontal rules: ---, ***, ___
    /^[-*_]{3,}$/m,
    // Tables: | col | col |
    /^\|.+\|$/m,
  ];

  /**
   * Minimum number of markdown patterns that must match
   * for content to be considered markdown.
   * This helps avoid false positives on plain text.
   */
  private readonly minMarkdownPatterns = 1;

  /**
   * Checks if the content is valid JSON.
   *
   * Content is considered JSON if:
   * - It parses successfully with JSON.parse()
   * - The result is an object or array (not a primitive)
   *
   * This excludes strings like "null", "true", "123" which are
   * technically valid JSON but not useful for tree display.
   *
   * @param content - The string to check
   * @returns true if content is valid JSON object or array
   */
  isJson(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const trimmed = content.trim();

    // Quick check: must start with { or [
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return false;
    }

    try {
      const parsed: unknown = JSON.parse(trimmed);
      // Only consider objects and arrays as "JSON" for display purposes
      return parsed !== null && typeof parsed === 'object';
    } catch {
      return false;
    }
  }

  /**
   * Parses JSON content and returns the parsed object.
   *
   * @param content - The JSON string to parse
   * @returns The parsed JSON object, or null if parsing fails
   */
  parseJson(content: string): unknown {
    try {
      return JSON.parse(content.trim()) as unknown;
    } catch {
      return null;
    }
  }

  /**
   * Checks if the content contains markdown formatting.
   *
   * Detection uses pattern matching against common markdown syntax.
   * To reduce false positives, at least one pattern must match.
   *
   * @param content - The string to check
   * @returns true if content appears to contain markdown
   */
  isMarkdown(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    // Count matching patterns
    let matchCount = 0;
    for (const pattern of this.markdownPatterns) {
      if (pattern.test(content)) {
        matchCount++;
        if (matchCount >= this.minMarkdownPatterns) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Determines the best default mode for displaying content.
   *
   * Priority order:
   * 1. JSON (if valid JSON object/array)
   * 2. Markdown (if contains markdown patterns)
   * 3. Raw (fallback)
   *
   * @param content - The string to analyze
   * @returns The recommended display mode
   */
  detectBestMode(content: string): 'json' | 'markdown' | 'raw' {
    if (this.isJson(content)) {
      return 'json';
    }
    if (this.isMarkdown(content)) {
      return 'markdown';
    }
    return 'raw';
  }
}
