/**
 * @fileoverview Component tests for SmartBlobComponent.
 *
 * Tests the visual appearance of the smart blob component
 * across different content types and rendering modes.
 *
 * Uses visual regression testing with screenshots to verify the
 * component renders correctly with proper styling for each mode.
 *
 * Uses the theme fixture to automatically run tests in both light and dark modes,
 * generating separate snapshots for each theme variant.
 *
 * @see frontend/src/app/ui/shared/smart-blob/smart-blob.component.ts
 */

import { expect, test } from './fixtures/theme.fixture';

import { SmartBlobComponent } from '../../src/app/ui/shared/smart-blob';

test.describe('SmartBlobComponent', () => {
  test.describe('renders correctly for each content type', () => {
    test('displays JSON content with DataTree view and JSON toggle', async ({ mount, page }) => {
      const content = JSON.stringify({ name: 'Test User', age: 25, active: true }, null, 0);

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      // Verify JSON toggle is visible
      const jsonToggle = page.locator('[data-testid="json-toggle"]');
      await expect(jsonToggle).toBeVisible();
      await expect(jsonToggle).toContainText('[JSON]');

      // Verify RAW toggle is always visible
      const rawToggle = page.locator('[data-testid="raw-toggle"]');
      await expect(rawToggle).toBeVisible();

      // Verify JSON view is shown by default (auto-detected) as DataTree
      const jsonView = page.locator('[data-testid="json-view"]');
      await expect(jsonView).toBeVisible();

      // Verify DataTree renders tree nodes with values
      const treeNodes = page.locator('[data-testid="tree-node"]');
      await expect(treeNodes.first()).toBeVisible();
      await expect(jsonView).toContainText('Test User');
    });

    test('displays markdown content with rendered HTML and MD toggle', async ({ mount, page }) => {
      const content = `# Welcome

This is **bold** and this is *italic*.

- List item 1
- List item 2

Check out [this link](https://example.com)`;

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      // Verify MD toggle is visible
      const mdToggle = page.locator('[data-testid="markdown-toggle"]');
      await expect(mdToggle).toBeVisible();
      await expect(mdToggle).toContainText('[MD]');

      // Verify RAW toggle is always visible
      const rawToggle = page.locator('[data-testid="raw-toggle"]');
      await expect(rawToggle).toBeVisible();

      // Verify markdown view is shown by default (auto-detected)
      const mdView = page.locator('[data-testid="markdown-view"]');
      await expect(mdView).toBeVisible();

      // Verify markdown is rendered as HTML
      await expect(mdView.locator('h1')).toBeVisible();
      await expect(mdView.locator('strong')).toContainText('bold');
      await expect(mdView.locator('em')).toContainText('italic');
      await expect(mdView.locator('li')).toHaveCount(2);
    });

    test('displays plain text with raw view only', async ({ mount, page }) => {
      const content = 'Just plain text without any special formatting.';

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      // Verify only RAW toggle is visible (no JSON or MD)
      const jsonToggle = page.locator('[data-testid="json-toggle"]');
      const mdToggle = page.locator('[data-testid="markdown-toggle"]');
      const rawToggle = page.locator('[data-testid="raw-toggle"]');

      await expect(jsonToggle).not.toBeVisible();
      await expect(mdToggle).not.toBeVisible();
      await expect(rawToggle).toBeVisible();

      // Verify raw view is shown
      const rawView = page.locator('[data-testid="raw-view"]');
      await expect(rawView).toBeVisible();
      await expect(rawView).toContainText('Just plain text');
    });

    test('handles mode switching correctly', async ({ mount, page }) => {
      const content = '{"key": "value", "number": 42}';

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      // Should start in JSON mode (auto-detected) with DataTree
      await expect(page.locator('[data-testid="json-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="data-tree"]')).toBeVisible();

      // Click RAW toggle
      await page.locator('[data-testid="raw-toggle"]').click();

      // Should now show raw view
      await expect(page.locator('[data-testid="raw-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="json-view"]')).not.toBeVisible();

      // RAW toggle should be active
      const rawToggle = page.locator('[data-testid="raw-toggle"]');
      await expect(rawToggle).toHaveClass(/active/);

      // Click JSON toggle to go back
      await page.locator('[data-testid="json-toggle"]').click();

      // Should show JSON view again with DataTree
      await expect(page.locator('[data-testid="json-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="data-tree"]')).toBeVisible();
    });
  });

  // Screenshots captured for documentation but not enforced (maxDiffPixelRatio: 1)
  // See: https://github.com/kevinaud/adk-sim-plugin/issues/203
  test.describe('visual regression', () => {
    test('JSON content visual appearance', async ({ mount }) => {
      const content = JSON.stringify(
        {
          user: { name: 'Alice', email: 'alice@example.com' },
          settings: { theme: 'dark', notifications: true },
          roles: ['admin', 'editor'],
        },
        null,
        0,
      );

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      await expect(component).toHaveScreenshot('smart-blob-json.png');
    });

    test('Markdown content visual appearance', async ({ mount }) => {
      const content = `# Project Documentation

## Overview

This project provides a **smart blob component** for rendering text content.

### Features

- Auto-detection of content types
- Toggleable rendering modes
- Support for \`JSON\`, *Markdown*, and plain text

> Note: This component is part of the shared UI library.

\`\`\`typescript
const example = 'code block';
\`\`\``;

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      await expect(component).toHaveScreenshot('smart-blob-markdown.png');
    });

    test('Plain text (raw) visual appearance', async ({ mount }) => {
      const content = `This is plain text content.
It preserves whitespace and newlines.

    Indented text is preserved too.

No special formatting is applied.`;

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      await expect(component).toHaveScreenshot('smart-blob-raw.png');
    });

    test('JSON toggle active state', async ({ mount, page }) => {
      const content = '{"status": "active", "count": 5}';

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      // JSON should be auto-selected and toggle should be active
      const jsonToggle = page.locator('[data-testid="json-toggle"]');
      await expect(jsonToggle).toHaveClass(/active/);

      await expect(component).toHaveScreenshot('smart-blob-json-active.png');
    });

    test('RAW toggle active state after switching', async ({ mount, page }) => {
      const content = '{"status": "active"}';

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      // Click RAW toggle
      await page.locator('[data-testid="raw-toggle"]').click();

      await expect(component).toHaveScreenshot('smart-blob-raw-active.png');
    });

    test('Markdown with code blocks', async ({ mount }) => {
      const content = `# Code Example

Here is some inline \`code\` and a block:

\`\`\`javascript
function hello() {
  console.log('Hello, world!');
}
\`\`\`

And some more text after.`;

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      await expect(component).toHaveScreenshot('smart-blob-markdown-code.png');
    });

    test('Markdown with table', async ({ mount }) => {
      const content = `# Data Table

| Name | Age | Role |
|------|-----|------|
| Alice | 30 | Admin |
| Bob | 25 | User |
| Carol | 28 | Editor |

End of table.`;

      const component = await mount(SmartBlobComponent, {
        props: { content },
      });

      await expect(component).toHaveScreenshot('smart-blob-markdown-table.png');
    });
  });
});
