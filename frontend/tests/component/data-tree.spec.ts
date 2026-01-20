/**
 * @fileoverview Component tests for DataTreeComponent.
 *
 * Tests the visual appearance and functional behavior of the data tree component
 * across different data types, nesting levels, and expansion states.
 *
 * Uses visual regression testing with screenshots to verify the component
 * renders correctly with proper indentation, thread lines, and syntax coloring.
 *
 * Uses the theme fixture to automatically run tests in both light and dark modes,
 * generating separate snapshots for each theme variant.
 *
 * @see frontend/src/app/ui/event-stream/data-tree/data-tree.component.ts
 */

import { expect, test } from './fixtures/theme.fixture';

import { DataTreeComponent } from '../../src/app/ui/event-stream';

// =============================================================================
// Test Data
// =============================================================================

/** Simple flat object with 3-4 keys */
const simpleFlatObject = {
  name: 'Alice',
  age: 30,
  active: true,
  email: 'alice@example.com',
};

/** Nested object with 2-3 levels */
const nestedObject = {
  user: {
    name: 'Bob',
    email: 'bob@example.com',
    profile: {
      bio: 'Software developer',
      location: 'NYC',
    },
  },
  settings: {
    theme: 'dark',
    notifications: true,
  },
};

/** Array of primitives */
const arrayOfPrimitives = {
  numbers: [1, 2, 3, 4, 5],
  strings: ['apple', 'banana', 'cherry'],
};

/** Array of objects */
const arrayOfObjects = {
  users: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ],
};

/** Mixed types (string, number, boolean, null, object, array) */
const mixedTypes = {
  string: 'hello world',
  number: 42,
  float: 3.14159,
  boolean: true,
  nullValue: null,
  array: [1, 2, 3],
  object: { nested: true },
};

/** Empty object */
const emptyObject = {};

/** Empty array wrapped in object (root must be object for meaningful display) */
const emptyArrayWrapper = { items: [] };

/** Deeply nested object (5+ levels) */
const deeplyNested = {
  level1: {
    level2: {
      level3: {
        level4: {
          level5: {
            level6: {
              value: 'deep',
            },
          },
        },
      },
    },
  },
};

/** Large array (10+ items) */
const largeArray = {
  items: Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    value: `Item ${String(i + 1)}`,
  })),
};

/** Long string values */
const longStrings = {
  shortKey: 'short',
  longDescription:
    'This is a very long string value that might need to be truncated or wrapped when displayed in the tree view to maintain readability and proper layout.',
  anotherLong:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
};

/** Unicode keys and values */
const unicodeData = {
  emoji: '🎉 Party!',
  japanese: '日本語',
  chinese: '中文',
  arabic: 'العربية',
  special: '€£¥₹',
  キー: 'value with unicode key',
  user: {
    name: '山田太郎',
    greeting: 'こんにちは！',
  },
};

/** Special characters in strings */
const specialCharacters = {
  quotes: 'He said "Hello"',
  singleQuotes: "It's working",
  backslash: 'path\\to\\file',
  newline: 'line1\nline2',
  tab: 'col1\tcol2',
  mixed: 'Quote: "test" and \\escape\\',
};

// =============================================================================
// Functional Tests (NOT skipped)
// =============================================================================

test.describe('DataTreeComponent', () => {
  test.describe('functional behavior', () => {
    // =========================================================================
    // The following tests involve clicking buttons and expecting signal-based
    // state changes to update the DOM. Due to a known issue with Playwright CT
    // and Angular zoneless change detection, these tests are skipped.
    // See: implementation-tips.md#playwright-ct-signal-updates-may-not-trigger-angular-change-detection
    // The functionality is verified via unit tests in data-tree.component.spec.ts
    // =========================================================================

    test.skip('expand all button expands all nodes', async ({ mount, page }) => {
      const component = await mount(DataTreeComponent, {
        props: {
          data: nestedObject,
          expanded: false, // Start collapsed
        },
      });

      // Initially collapsed - should show fewer nodes
      const initialNodes = await page.locator('[data-testid="tree-node"]').count();

      // Click expand all
      const expandAllBtn = page.locator('[data-testid="expand-all"]');
      await expect(expandAllBtn).toBeVisible();
      await expandAllBtn.click();

      // After expand all - should show more nodes
      const expandedNodes = await page.locator('[data-testid="tree-node"]').count();
      expect(expandedNodes).toBeGreaterThan(initialNodes);
    });

    test.skip('collapse all button collapses all nodes', async ({ mount, page }) => {
      const component = await mount(DataTreeComponent, {
        props: {
          data: nestedObject,
          expanded: true, // Start expanded
        },
      });

      // Initially expanded - count nodes
      const initialNodes = await page.locator('[data-testid="tree-node"]').count();
      expect(initialNodes).toBeGreaterThan(1);

      // Click collapse all
      const collapseAllBtn = page.locator('[data-testid="collapse-all"]');
      await expect(collapseAllBtn).toBeVisible();
      await collapseAllBtn.click();

      // After collapse all - should show only root level nodes
      const collapsedNodes = await page.locator('[data-testid="tree-node"]').count();
      expect(collapsedNodes).toBeLessThan(initialNodes);
    });

    test('toggle buttons appear for expandable nodes', async ({ mount, page }) => {
      await mount(DataTreeComponent, {
        props: { data: nestedObject },
      });

      // Should have toggle buttons for expandable nodes (objects/arrays)
      const toggleButtons = page.locator('[data-testid="expand-toggle"]');
      await expect(toggleButtons.first()).toBeVisible();

      const toggleCount = await toggleButtons.count();
      expect(toggleCount).toBeGreaterThan(0);
    });

    test.skip('clicking toggle button collapses node and hides children', async ({
      mount,
      page,
    }) => {
      await mount(DataTreeComponent, {
        props: {
          data: {
            parent: {
              child1: 'value1',
              child2: 'value2',
            },
          },
        },
      });

      // Initially all expanded - should see child nodes
      const initialNodes = await page.locator('[data-testid="tree-node"]').count();
      expect(initialNodes).toBe(4); // root, parent, child1, child2

      // Click the first toggle (root object)
      const toggleButton = page.locator('[data-testid="expand-toggle"]').first();
      await toggleButton.click();

      // After collapse - should see fewer nodes
      const collapsedNodes = await page.locator('[data-testid="tree-node"]').count();
      expect(collapsedNodes).toBeLessThan(initialNodes);
    });

    test('renders correct number of nodes for flat object', async ({ mount, page }) => {
      await mount(DataTreeComponent, {
        props: { data: simpleFlatObject },
      });

      // Should have 5 nodes: root + 4 properties
      const nodes = await page.locator('[data-testid="tree-node"]').count();
      expect(nodes).toBe(5);
    });

    test('renders correct number of nodes for nested object', async ({ mount, page }) => {
      await mount(DataTreeComponent, {
        props: { data: nestedObject },
      });

      // root(1) + user(1) + user.name(1) + user.email(1) + user.profile(1)
      // + profile.bio(1) + profile.location(1) + settings(1)
      // + settings.theme(1) + settings.notifications(1) = 10
      const nodes = await page.locator('[data-testid="tree-node"]').count();
      expect(nodes).toBe(10);
    });

    test('expand/collapse all buttons visible when tree has expandable nodes', async ({
      mount,
      page,
    }) => {
      await mount(DataTreeComponent, {
        props: {
          data: {
            a: 1,
            b: 2,
            c: 3,
          },
        },
      });

      // Root object is expandable, so buttons should be visible
      const expandAllBtn = page.locator('[data-testid="expand-all"]');
      const collapseAllBtn = page.locator('[data-testid="collapse-all"]');
      await expect(expandAllBtn).toBeVisible();
      await expect(collapseAllBtn).toBeVisible();
    });

    test('empty object renders without errors', async ({ mount, page }) => {
      await mount(DataTreeComponent, {
        props: { data: emptyObject },
      });

      const tree = page.locator('[data-testid="data-tree"]');
      await expect(tree).toBeVisible();

      // Empty object should have at least the root node
      const nodes = await page.locator('[data-testid="tree-node"]').count();
      expect(nodes).toBeGreaterThanOrEqual(1);
    });

    test('thread lines class applied when showThreadLines is true', async ({ mount, page }) => {
      await mount(DataTreeComponent, {
        props: {
          data: nestedObject,
          showThreadLines: true,
        },
      });

      const tree = page.locator('[data-testid="data-tree"]');
      await expect(tree).toHaveClass(/thread-lines/);
    });

    test('thread lines class not applied when showThreadLines is false', async ({
      mount,
      page,
    }) => {
      await mount(DataTreeComponent, {
        props: {
          data: nestedObject,
          showThreadLines: false,
        },
      });

      const tree = page.locator('[data-testid="data-tree"]');
      await expect(tree).not.toHaveClass(/thread-lines/);
    });
  });

  // ===========================================================================
  // Visual Regression Tests
  // Screenshots captured for documentation but not enforced (maxDiffPixelRatio: 1)
  // See: https://github.com/kevinaud/adk-sim-plugin/issues/203
  // ===========================================================================

  test.describe('visual regression', () => {
    test('simple flat object (3-4 keys)', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: simpleFlatObject },
      });

      await expect(component).toHaveScreenshot('data-tree-simple-flat.png');
    });

    test('nested object (2-3 levels)', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: nestedObject },
      });

      await expect(component).toHaveScreenshot('data-tree-nested.png');
    });

    test('array of primitives', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: arrayOfPrimitives },
      });

      await expect(component).toHaveScreenshot('data-tree-array-primitives.png');
    });

    test('array of objects', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: arrayOfObjects },
      });

      await expect(component).toHaveScreenshot('data-tree-array-objects.png');
    });

    test('mixed types (string, number, boolean, null, object, array)', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: mixedTypes },
      });

      await expect(component).toHaveScreenshot('data-tree-mixed-types.png');
    });

    test('empty object {}', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: emptyObject },
      });

      await expect(component).toHaveScreenshot('data-tree-empty-object.png');
    });

    test('empty array []', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: emptyArrayWrapper },
      });

      await expect(component).toHaveScreenshot('data-tree-empty-array.png');
    });

    test('deeply nested object (5+ levels)', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: deeplyNested },
      });

      await expect(component).toHaveScreenshot('data-tree-deeply-nested.png');
    });

    test('large array (10+ items)', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: largeArray },
      });

      await expect(component).toHaveScreenshot('data-tree-large-array.png');
    });

    test('long string values (truncation behavior)', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: longStrings },
      });

      await expect(component).toHaveScreenshot('data-tree-long-strings.png');
    });

    test('collapsed state (parent collapsed, children hidden)', async ({ mount, page }) => {
      const component = await mount(DataTreeComponent, {
        props: {
          data: nestedObject,
          expanded: false,
        },
      });

      await expect(component).toHaveScreenshot('data-tree-collapsed.png');
    });

    test('partially collapsed (some nodes expanded, some collapsed)', async ({ mount, page }) => {
      const component = await mount(DataTreeComponent, {
        props: {
          data: nestedObject,
          expanded: true,
        },
      });

      // Collapse the first expandable node (user)
      const toggleButtons = page.locator('[data-testid="expand-toggle"]');
      await toggleButtons.first().click();

      await expect(component).toHaveScreenshot('data-tree-partially-collapsed.png');
    });

    test('thread lines visible', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: {
          data: nestedObject,
          showThreadLines: true,
        },
      });

      await expect(component).toHaveScreenshot('data-tree-thread-lines.png');
    });

    test('thread lines disabled (showThreadLines=false)', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: {
          data: nestedObject,
          showThreadLines: false,
        },
      });

      await expect(component).toHaveScreenshot('data-tree-no-thread-lines.png');
    });

    test('unicode keys and values', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: unicodeData },
      });

      await expect(component).toHaveScreenshot('data-tree-unicode.png');
    });

    test('special characters in strings (quotes, backslashes)', async ({ mount }) => {
      const component = await mount(DataTreeComponent, {
        props: { data: specialCharacters },
      });

      await expect(component).toHaveScreenshot('data-tree-special-chars.png');
    });
  });
});
