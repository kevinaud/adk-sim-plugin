/**
 * @fileoverview Unit tests for DataTreeComponent.
 *
 * Tests cover:
 * - Basic rendering of simple objects
 * - Rendering of nested objects with correct indentation
 * - Rendering of arrays
 * - Display of keys and values
 * - Expansion state based on input
 * - Container info display (object/array with child count)
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-008 through FR-011
 * @see mddocs/frontend/frontend-tdd.md#datatreecomponent
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataTreeComponent } from './data-tree.component';

/**
 * Test host component that wraps DataTreeComponent.
 * Allows testing input binding behavior.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [DataTreeComponent],
  template: `
    <app-data-tree [data]="data()" [expanded]="expanded()" [showThreadLines]="showThreadLines()" />
  `,
})
class TestHostComponent {
  readonly data = signal<unknown>({});
  readonly expanded = signal<boolean>(true);
  readonly showThreadLines = signal<boolean>(true);
}

describe('DataTreeComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, DataTreeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
  });

  /**
   * Helper to get all tree nodes from the DOM.
   */
  function getTreeNodes(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="tree-node"]'));
  }

  /**
   * Helper to get the data-tree container.
   */
  function getDataTreeContainer(): HTMLElement {
    return fixture.nativeElement.querySelector('[data-testid="data-tree"]');
  }

  /**
   * Helper to get node by path.
   */
  function getNodeByPath(path: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-path="${path}"]`);
  }

  describe('component creation', () => {
    it('should create the component', () => {
      fixture.detectChanges();
      const dataTree = fixture.nativeElement.querySelector('app-data-tree');
      expect(dataTree).toBeTruthy();
    });

    it('should render data-tree container with test ID', () => {
      fixture.detectChanges();
      const container = getDataTreeContainer();
      expect(container).toBeTruthy();
      expect(container.getAttribute('data-testid')).toBe('data-tree');
    });
  });

  describe('simple object rendering', () => {
    it('should render simple object with two properties', () => {
      hostComponent.data.set({ name: 'Alice', age: 30 });
      fixture.detectChanges();

      const nodes = getTreeNodes();
      expect(nodes.length).toBe(4); // root + name + age + closing brace
    });

    it('should render keys with quotes and colon', () => {
      hostComponent.data.set({ name: 'Alice' });
      fixture.detectChanges();

      const nameNode = getNodeByPath('$.name');
      expect(nameNode).toBeTruthy();

      // Keys are now rendered as "key" with a separate colon span
      const keySpan = nameNode?.querySelector('.key');
      expect(keySpan?.textContent).toBe('"name"');

      const colonSpan = nameNode?.querySelector('.colon');
      expect(colonSpan?.textContent).toBe(':');
    });

    it('should render string values with quotes', () => {
      hostComponent.data.set({ name: 'Alice' });
      fixture.detectChanges();

      const nameNode = getNodeByPath('$.name');
      const valueSpan = nameNode?.querySelector('.value');
      expect(valueSpan?.textContent).toBe('"Alice"');
    });

    it('should render number values without quotes', () => {
      hostComponent.data.set({ age: 30 });
      fixture.detectChanges();

      const ageNode = getNodeByPath('$.age');
      const valueSpan = ageNode?.querySelector('.value');
      expect(valueSpan?.textContent).toBe('30');
    });

    it('should render boolean values', () => {
      hostComponent.data.set({ active: true, deleted: false });
      fixture.detectChanges();

      const activeNode = getNodeByPath('$.active');
      expect(activeNode?.querySelector('.value')?.textContent).toBe('true');

      const deletedNode = getNodeByPath('$.deleted');
      expect(deletedNode?.querySelector('.value')?.textContent).toBe('false');
    });

    it('should render null values', () => {
      hostComponent.data.set({ nothing: null });
      fixture.detectChanges();

      const nullNode = getNodeByPath('$.nothing');
      expect(nullNode?.querySelector('.value')?.textContent).toBe('null');
    });
  });

  describe('nested object rendering', () => {
    it('should render nested object with correct structure', () => {
      hostComponent.data.set({
        user: {
          name: 'Bob',
          address: {
            city: 'NYC',
          },
        },
      });
      fixture.detectChanges();

      const nodes = getTreeNodes();
      // root + user + name + address + city + 3 closing braces = 8
      expect(nodes.length).toBe(8);
    });

    it('should apply increasing indentation based on depth', () => {
      hostComponent.data.set({
        level1: {
          level2: {
            level3: 'deep',
          },
        },
      });
      fixture.detectChanges();

      const rootNode = getNodeByPath('$');
      const level1Node = getNodeByPath('$.level1');
      const level2Node = getNodeByPath('$.level1.level2');
      const level3Node = getNodeByPath('$.level1.level2.level3');

      // Check padding-left increases with depth (16px per level)
      expect(rootNode?.style.paddingLeft).toBe('0px');
      expect(level1Node?.style.paddingLeft).toBe('16px');
      expect(level2Node?.style.paddingLeft).toBe('32px');
      expect(level3Node?.style.paddingLeft).toBe('48px');
    });
  });

  describe('array rendering', () => {
    it('should render array with indexed children', () => {
      hostComponent.data.set(['a', 'b', 'c']);
      fixture.detectChanges();

      const nodes = getTreeNodes();
      expect(nodes.length).toBe(5); // root + 3 items + closing bracket

      // Check array items have numeric keys
      expect(getNodeByPath('$[0]')).toBeTruthy();
      expect(getNodeByPath('$[1]')).toBeTruthy();
      expect(getNodeByPath('$[2]')).toBeTruthy();
    });

    it('should render array of objects', () => {
      hostComponent.data.set([{ id: 1 }, { id: 2 }]);
      fixture.detectChanges();

      const nodes = getTreeNodes();
      // root + obj1 + id1 + obj2 + id2 + 3 closings = 8
      expect(nodes.length).toBe(8);

      expect(getNodeByPath('$[0].id')).toBeTruthy();
      expect(getNodeByPath('$[1].id')).toBeTruthy();
    });
  });

  describe('bracket display for containers', () => {
    it('should display opening brace for objects when expanded', () => {
      hostComponent.data.set({ a: 1, b: 2, c: 3 });
      fixture.detectChanges();

      const rootNode = getNodeByPath('$');
      const bracket = rootNode?.querySelector('.bracket');
      expect(bracket).toBeTruthy();
      expect(bracket?.textContent).toBe('{');
    });

    it('should display opening bracket for arrays when expanded', () => {
      hostComponent.data.set([1, 2, 3, 4, 5]);
      fixture.detectChanges();

      const rootNode = getNodeByPath('$');
      const bracket = rootNode?.querySelector('.bracket');
      expect(bracket?.textContent).toBe('[');
    });

    it('should display collapsed indicator for objects when collapsed', () => {
      hostComponent.data.set({ a: 1 });
      hostComponent.expanded.set(false);
      fixture.detectChanges();

      const rootNode = getNodeByPath('$');
      const bracket = rootNode?.querySelector('.bracket');
      expect(bracket?.textContent).toBe('{...}');
    });

    it('should display collapsed indicator for arrays when collapsed', () => {
      hostComponent.data.set([1, 2, 3]);
      hostComponent.expanded.set(false);
      fixture.detectChanges();

      const rootNode = getNodeByPath('$');
      const bracket = rootNode?.querySelector('.bracket');
      expect(bracket?.textContent).toBe('[...]');
    });

    it('should not display brackets for primitives', () => {
      hostComponent.data.set({ name: 'test' });
      fixture.detectChanges();

      const nameNode = getNodeByPath('$.name');
      const bracket = nameNode?.querySelector('.bracket');
      expect(bracket).toBeNull();
    });
  });

  describe('expansion state', () => {
    it('should render all nodes when expanded is true (default)', () => {
      hostComponent.data.set({ a: { b: { c: 1 } } });
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      const nodes = getTreeNodes();
      // root + a + b + c + 3 closings = 7
      expect(nodes.length).toBe(7);
    });

    it('should only render root when expanded is false', () => {
      hostComponent.data.set({ a: { b: { c: 1 } } });
      hostComponent.expanded.set(false);
      fixture.detectChanges();

      const nodes = getTreeNodes();
      // Only root (collapsed)
      expect(nodes.length).toBe(1);
    });

    it('should have expanded class on expandable nodes when expanded', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      const rootNode = getNodeByPath('$');
      expect(rootNode?.classList.contains('expandable')).toBe(true);
      expect(rootNode?.classList.contains('expanded')).toBe(true);
    });

    it('should not have expanded class when collapsed', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      hostComponent.expanded.set(false);
      fixture.detectChanges();

      const rootNode = getNodeByPath('$');
      expect(rootNode?.classList.contains('expandable')).toBe(true);
      expect(rootNode?.classList.contains('expanded')).toBe(false);
    });
  });

  describe('showThreadLines input', () => {
    it('should have thread-lines class when showThreadLines is true', () => {
      hostComponent.data.set({ key: 'value' });
      hostComponent.showThreadLines.set(true);
      fixture.detectChanges();

      const container = getDataTreeContainer();
      expect(container.classList.contains('thread-lines')).toBe(true);
    });

    it('should not have thread-lines class when showThreadLines is false', () => {
      hostComponent.data.set({ key: 'value' });
      hostComponent.showThreadLines.set(false);
      fixture.detectChanges();

      const container = getDataTreeContainer();
      expect(container.classList.contains('thread-lines')).toBe(false);
    });
  });

  describe('value type attributes', () => {
    it('should set data-value-type attribute for styling', () => {
      hostComponent.data.set({
        str: 'hello',
        num: 42,
        bool: true,
        nil: null,
        obj: {},
        arr: [],
      });
      fixture.detectChanges();

      expect(getNodeByPath('$.str')?.getAttribute('data-value-type')).toBe('string');
      expect(getNodeByPath('$.num')?.getAttribute('data-value-type')).toBe('number');
      expect(getNodeByPath('$.bool')?.getAttribute('data-value-type')).toBe('boolean');
      expect(getNodeByPath('$.nil')?.getAttribute('data-value-type')).toBe('null');
      expect(getNodeByPath('$.obj')?.getAttribute('data-value-type')).toBe('object');
      expect(getNodeByPath('$.arr')?.getAttribute('data-value-type')).toBe('array');
    });
  });

  describe('empty data handling', () => {
    it('should render empty object with opening brace', () => {
      hostComponent.data.set({});
      fixture.detectChanges();

      const nodes = getTreeNodes();
      expect(nodes.length).toBe(1);

      // Empty expanded object still shows opening brace
      const bracket = getNodeByPath('$')?.querySelector('.bracket');
      expect(bracket?.textContent).toBe('{');
    });

    it('should render empty array with opening bracket', () => {
      hostComponent.data.set([]);
      fixture.detectChanges();

      const nodes = getTreeNodes();
      expect(nodes.length).toBe(1);

      // Empty expanded array still shows opening bracket
      const bracket = getNodeByPath('$')?.querySelector('.bracket');
      expect(bracket?.textContent).toBe('[');
    });
  });

  describe('data change reactivity', () => {
    it('should update when data changes', () => {
      hostComponent.data.set({ a: 1 });
      fixture.detectChanges();
      expect(getTreeNodes().length).toBe(3); // root + a + closing

      hostComponent.data.set({ a: 1, b: 2, c: 3 });
      fixture.detectChanges();
      expect(getTreeNodes().length).toBe(5); // root + a + b + c + closing
    });

    it('should update when expanded changes', () => {
      hostComponent.data.set({ nested: { deep: { value: 1 } } });
      hostComponent.expanded.set(true);
      fixture.detectChanges();
      expect(getTreeNodes().length).toBe(7); // root + nested + deep + value + 3 closings

      hostComponent.expanded.set(false);
      fixture.detectChanges();
      expect(getTreeNodes().length).toBe(1);
    });
  });

  describe('toggle button rendering', () => {
    /**
     * Helper to get all toggle buttons from the DOM.
     */
    function getToggleButtons(): HTMLButtonElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="expand-toggle"]'));
    }

    /**
     * Helper to get toggle button for a specific node.
     */
    function getToggleForPath(path: string): HTMLButtonElement | null {
      const node = getNodeByPath(path);
      return node?.querySelector('[data-testid="expand-toggle"]') ?? null;
    }

    /**
     * Helper to get the icon name from a mat-icon element.
     */
    function getIconName(button: HTMLButtonElement | null): string | null {
      const icon = button?.querySelector('mat-icon');
      return icon?.textContent?.trim() ?? null;
    }

    it('should render toggle button for expandable nodes', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      fixture.detectChanges();

      // Root and nested are expandable objects
      const toggles = getToggleButtons();
      expect(toggles.length).toBe(2); // root + nested
    });

    it('should not render toggle button for primitive nodes', () => {
      hostComponent.data.set({ name: 'Alice', age: 30 });
      fixture.detectChanges();

      // Only root is expandable, name and age are primitives
      const toggles = getToggleButtons();
      expect(toggles.length).toBe(1); // Only root
    });

    it('should show expand_more icon when node is expanded', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      const rootToggle = getToggleForPath('$');
      expect(getIconName(rootToggle)).toBe('expand_more');
    });

    it('should show chevron_right icon when node is collapsed', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      hostComponent.expanded.set(false);
      fixture.detectChanges();

      const rootToggle = getToggleForPath('$');
      expect(getIconName(rootToggle)).toBe('chevron_right');
    });

    it('should render toggle buttons for arrays', () => {
      hostComponent.data.set([{ id: 1 }, { id: 2 }]);
      fixture.detectChanges();

      // root array + 2 nested objects = 3 toggles
      const toggles = getToggleButtons();
      expect(toggles.length).toBe(3);
    });
  });

  describe('expand all / collapse all buttons', () => {
    /**
     * Helper to get the tree header element.
     */
    function getTreeHeader(): HTMLElement | null {
      return fixture.nativeElement.querySelector('[data-testid="tree-header"]');
    }

    /**
     * Helper to get the expand all button.
     */
    function getExpandAllButton(): HTMLButtonElement | null {
      return fixture.nativeElement.querySelector('[data-testid="expand-all"]');
    }

    /**
     * Helper to get the collapse all button.
     */
    function getCollapseAllButton(): HTMLButtonElement | null {
      return fixture.nativeElement.querySelector('[data-testid="collapse-all"]');
    }

    /**
     * Helper to check if a node is expanded based on its CSS class.
     */
    function isNodeExpanded(path: string): boolean {
      const node = getNodeByPath(path);
      return node?.classList.contains('expanded') ?? false;
    }

    it('should show tree header when tree has expandable nodes', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      fixture.detectChanges();

      expect(getTreeHeader()).toBeTruthy();
      expect(getExpandAllButton()).toBeTruthy();
      expect(getCollapseAllButton()).toBeTruthy();
    });

    it('should not show tree header when tree has no expandable nodes', () => {
      // Only a primitive value - no expandable nodes
      hostComponent.data.set('just a string');
      fixture.detectChanges();

      expect(getTreeHeader()).toBeNull();
      expect(getExpandAllButton()).toBeNull();
      expect(getCollapseAllButton()).toBeNull();
    });

    it('should have correct icons on buttons', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      fixture.detectChanges();

      const expandAllBtn = getExpandAllButton();
      const collapseAllBtn = getCollapseAllButton();

      expect(expandAllBtn?.querySelector('mat-icon')?.textContent?.trim()).toBe('unfold_more');
      expect(collapseAllBtn?.querySelector('mat-icon')?.textContent?.trim()).toBe('unfold_less');
    });

    it('should have correct title attributes on buttons', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      fixture.detectChanges();

      expect(getExpandAllButton()?.getAttribute('title')).toBe('Expand all nodes');
      expect(getCollapseAllButton()?.getAttribute('title')).toBe('Collapse all nodes');
    });

    it('should collapse all nodes when clicking collapse all button', () => {
      hostComponent.data.set({
        a: { x: 1 },
        b: { y: 2 },
      });
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      // All expanded initially: root + a + x + b + y + 3 closings = 8
      expect(getTreeNodes().length).toBe(8);

      // Click collapse all
      getCollapseAllButton()?.click();
      fixture.detectChanges();

      // Only root should be visible
      expect(getTreeNodes().length).toBe(1);
      expect(isNodeExpanded('$')).toBe(false);
    });

    it('should expand all nodes when clicking expand all button', () => {
      hostComponent.data.set({
        a: { x: 1 },
        b: { y: 2 },
      });
      hostComponent.expanded.set(false);
      fixture.detectChanges();

      // All collapsed initially: only root
      expect(getTreeNodes().length).toBe(1);

      // Click expand all
      getExpandAllButton()?.click();
      fixture.detectChanges();

      // All nodes visible: root + a + x + a:closing + b + y + b:closing + root:closing = 8
      expect(getTreeNodes().length).toBe(8);
      expect(isNodeExpanded('$')).toBe(true);
      expect(isNodeExpanded('$.a')).toBe(true);
      expect(isNodeExpanded('$.b')).toBe(true);
    });

    it('should expand all after manual collapse', () => {
      hostComponent.data.set({
        a: { x: 1 },
        b: { y: 2 },
      });
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      // Manually collapse 'a'
      const nodeA = getNodeByPath('$.a');
      const toggleA = nodeA?.querySelector('[data-testid="expand-toggle"]') as HTMLButtonElement;
      toggleA?.click();
      fixture.detectChanges();

      // Should be 6 nodes now (x and a:closing hidden, but root:closing still there)
      // root + a + b + y + b:closing + root:closing = 6
      expect(getTreeNodes().length).toBe(6);

      // Click expand all
      getExpandAllButton()?.click();
      fixture.detectChanges();

      // All 8 nodes visible again
      expect(getTreeNodes().length).toBe(8);
    });

    it('should collapse all after partial expansion', () => {
      hostComponent.data.set({
        a: { x: 1 },
        b: { y: 2 },
      });
      hostComponent.expanded.set(false);
      fixture.detectChanges();

      // Start with only root
      expect(getTreeNodes().length).toBe(1);

      // Manually expand root
      const rootNode = getNodeByPath('$');
      const rootToggle = rootNode?.querySelector(
        '[data-testid="expand-toggle"]',
      ) as HTMLButtonElement;
      rootToggle?.click();
      fixture.detectChanges();

      // Root expanded, showing a and b (collapsed) + root:closing
      expect(getTreeNodes().length).toBe(4);

      // Click collapse all
      getCollapseAllButton()?.click();
      fixture.detectChanges();

      // Back to only root
      expect(getTreeNodes().length).toBe(1);
    });

    it('should work with arrays', () => {
      hostComponent.data.set([{ id: 1 }, { id: 2 }]);
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      // root + [0] + id + [0]:closing + [1] + id + [1]:closing + root:closing = 8
      expect(getTreeNodes().length).toBe(8);

      // Collapse all
      getCollapseAllButton()?.click();
      fixture.detectChanges();

      expect(getTreeNodes().length).toBe(1);

      // Expand all
      getExpandAllButton()?.click();
      fixture.detectChanges();

      expect(getTreeNodes().length).toBe(8);
    });

    it('should show buttons for empty objects (which are expandable)', () => {
      hostComponent.data.set({});
      fixture.detectChanges();

      // Empty object is still expandable (has child count 0)
      expect(getTreeHeader()).toBeTruthy();
    });
  });

  describe('expand/collapse toggle behavior', () => {
    /**
     * Helper to click toggle button for a specific node.
     */
    function clickToggle(path: string): void {
      const node = getNodeByPath(path);
      const toggle = node?.querySelector('[data-testid="expand-toggle"]') as HTMLButtonElement;
      toggle?.click();
      fixture.detectChanges();
    }

    /**
     * Helper to check if a node is expanded based on its CSS class.
     */
    function isNodeExpanded(path: string): boolean {
      const node = getNodeByPath(path);
      return node?.classList.contains('expanded') ?? false;
    }

    it('should collapse node when clicking toggle on expanded node', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      // Verify initially expanded: root + nested + value + nested:closing + root:closing = 5
      expect(getTreeNodes().length).toBe(5);

      // Click root toggle to collapse
      clickToggle('$');

      // Children should be hidden
      expect(getTreeNodes().length).toBe(1); // Only root
      expect(isNodeExpanded('$')).toBe(false);
    });

    it('should expand node when clicking toggle on collapsed node', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      hostComponent.expanded.set(false);
      fixture.detectChanges();

      // Verify initially collapsed
      expect(getTreeNodes().length).toBe(1); // Only root

      // Click root toggle to expand
      clickToggle('$');

      // Children should be visible
      expect(getTreeNodes().length).toBeGreaterThan(1);
      expect(isNodeExpanded('$')).toBe(true);
    });

    it('should toggle individual nested nodes independently', () => {
      hostComponent.data.set({
        a: { x: 1 },
        b: { y: 2 },
      });
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      // All expanded: root + a + x + a:closing + b + y + b:closing + root:closing = 8
      expect(getTreeNodes().length).toBe(8);

      // Collapse only 'a'
      clickToggle('$.a');

      // Should hide 'x' and 'a:closing' but keep 'b.y' visible
      // root + a + b + y + b:closing + root:closing = 6
      expect(getTreeNodes().length).toBe(6);
      expect(isNodeExpanded('$.a')).toBe(false);
      expect(isNodeExpanded('$.b')).toBe(true);
    });

    it('should hide nested children when collapsing parent', () => {
      hostComponent.data.set({
        level1: {
          level2: {
            level3: 'deep',
          },
        },
      });
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      // All expanded: root + level1 + level2 + level3 + 3 closings = 7
      expect(getTreeNodes().length).toBe(7);

      // Collapse level1 - should hide level2, level3, and their closings
      clickToggle('$.level1');

      // Only root + level1 + root:closing visible
      expect(getTreeNodes().length).toBe(3);
      expect(getNodeByPath('$.level1.level2')).toBeNull();
      expect(getNodeByPath('$.level1.level2.level3')).toBeNull();
    });

    it('should change icon when toggling', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      const node = getNodeByPath('$');
      const getIcon = () => node?.querySelector('mat-icon')?.textContent?.trim();

      expect(getIcon()).toBe('expand_more');

      clickToggle('$');
      expect(getIcon()).toBe('chevron_right');

      clickToggle('$');
      expect(getIcon()).toBe('expand_more');
    });

    it('should work with arrays', () => {
      hostComponent.data.set([{ a: 1 }, { b: 2 }]);
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      // root + [0] + a + [0]:closing + [1] + b + [1]:closing + root:closing = 8
      expect(getTreeNodes().length).toBe(8);

      // Collapse first array element
      clickToggle('$[0]');

      // root + [0] + [1] + b + [1]:closing + root:closing = 6
      expect(getTreeNodes().length).toBe(6);
      expect(getNodeByPath('$[0].a')).toBeNull();
      expect(getNodeByPath('$[1].b')).toBeTruthy();
    });
  });
});
