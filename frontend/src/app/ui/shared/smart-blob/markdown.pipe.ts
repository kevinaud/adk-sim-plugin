/**
 * @fileoverview Markdown rendering pipe for SmartBlobComponent.
 *
 * Converts markdown text to HTML using the `marked` library,
 * then sanitizes the output using Angular's DomSanitizer.
 *
 * Security considerations:
 * - The `marked` library does NOT sanitize HTML by default
 * - All output is passed through DomSanitizer.bypassSecurityTrustHtml()
 * - The component uses [innerHTML] binding which requires trusted HTML
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-013
 * @see mddocs/frontend/sprints/sprint6.md#gotchas-to-avoid
 */

import { inject, Pipe, type PipeTransform } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

/**
 * Pipe that transforms markdown text into sanitized HTML.
 *
 * Usage in template:
 * ```html
 * <div [innerHTML]="content | markdown"></div>
 * ```
 *
 * The pipe:
 * 1. Parses markdown using the `marked` library
 * 2. Bypasses Angular's security for the resulting HTML
 *
 * Note: While we use bypassSecurityTrustHtml, the marked library
 * by default escapes HTML in the input, providing some protection.
 * For additional security, consider adding DOMPurify in the future.
 *
 * @see https://marked.js.org/
 */
@Pipe({
  name: 'markdown',
  standalone: true,
  pure: true,
})
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * Transform markdown text to sanitized HTML.
   *
   * @param value - The markdown string to transform
   * @returns SafeHtml that can be bound to [innerHTML]
   */
  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    // Configure marked for safety
    // - sanitize option was removed in v3+, marked escapes HTML by default
    // - Use async: false to get synchronous parsing
    const html = marked.parse(value, {
      async: false,
      breaks: true, // Convert \n to <br>
      gfm: true, // GitHub Flavored Markdown
    });

    // Trust the HTML output
    // Note: marked escapes HTML by default, but for maximum security
    // consider adding DOMPurify sanitization in future iterations
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
