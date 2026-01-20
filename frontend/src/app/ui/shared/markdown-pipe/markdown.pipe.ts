import { inject, Pipe, type PipeTransform } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Pipe that transforms markdown text into sanitized HTML.
 *
 * This pipe is extracted into its own module to avoid circular dependencies
 * between data-tree and smart-blob components.
 *
 * Usage in template:
 * ```html
 * <div [innerHTML]="content | markdown"></div>
 * ```
 *
 * The pipe:
 * 1. Overrides the marked renderer to escape raw HTML tags in the source
 * (e.g., <DATA_TO_EXTRACT> becomes &lt;DATA_TO_EXTRACT&gt;)
 * 2. Parses markdown using the `marked` library
 * 3. Sanitizes the resulting HTML using DOMPurify
 * 4. Bypasses Angular's security for the resulting HTML
 *
 * @see https://marked.js.org/
 * @see https://github.com/cure53/DOMPurify
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

    // Configure a custom renderer to force raw HTML tags to be rendered as text.
    // This fixes issues where content inside custom tags (like <DATA_TO_EXTRACT>)
    // disappears because the browser treats them as unknown HTML elements.
    const renderer = new marked.Renderer();
    renderer.html = (htmlOrObject: string | { text: string }) => {
      // Handle different marked versions where input might be string or object
      const text = typeof htmlOrObject === 'string' ? htmlOrObject : htmlOrObject.text;

      return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    };

    // 1. Parse markdown to HTML using the custom renderer
    const rawHtml = marked.parse(value, {
      renderer: renderer,
      async: false,
      breaks: true, // Convert \n to <br>
      gfm: true, // GitHub Flavored Markdown
    });

    // 2. Sanitize the HTML using DOMPurify
    // Even though we escaped raw HTML tags above, marked still generates HTML
    // for markdown syntax (e.g., **bold** -> <strong>). We must sanitize this.
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);

    // 3. Trust the sanitized output
    return this.sanitizer.bypassSecurityTrustHtml(sanitizedHtml);
  }
}
