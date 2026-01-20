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
      expect(nodes.length).toBe(3); // root + name + age
    });

    it('should render keys with colon suffix', () => {
      hostComponent.data.set({ name: 'Alice' });
      fixture.detectChanges();

      const nameNode = getNodeByPath('root.name');
      expect(nameNode).toBeTruthy();

      const keySpan = nameNode?.querySelector('.key');
      expect(keySpan?.textContent).toBe('name:');
    });

    it('should render string values with quotes', () => {
      hostComponent.data.set({ name: 'Alice' });
      fixture.detectChanges();

      const nameNode = getNodeByPath('root.name');
      const valueSpan = nameNode?.querySelector('.value');
      expect(valueSpan?.textContent).toBe('"Alice"');
    });

    it('should render number values without quotes', () => {
      hostComponent.data.set({ age: 30 });
      fixture.detectChanges();

      const ageNode = getNodeByPath('root.age');
      const valueSpan = ageNode?.querySelector('.value');
      expect(valueSpan?.textContent).toBe('30');
    });

    it('should render boolean values', () => {
      hostComponent.data.set({ active: true, deleted: false });
      fixture.detectChanges();

      const activeNode = getNodeByPath('root.active');
      expect(activeNode?.querySelector('.value')?.textContent).toBe('true');

      const deletedNode = getNodeByPath('root.deleted');
      expect(deletedNode?.querySelector('.value')?.textContent).toBe('false');
    });

    it('should render null values', () => {
      hostComponent.data.set({ nothing: null });
      fixture.detectChanges();

      const nullNode = getNodeByPath('root.nothing');
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
      // root + user + name + address + city = 5
      expect(nodes.length).toBe(5);
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

      const rootNode = getNodeByPath('root');
      const level1Node = getNodeByPath('root.level1');
      const level2Node = getNodeByPath('root.level1.level2');
      const level3Node = getNodeByPath('root.level1.level2.level3');

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
      expect(nodes.length).toBe(4); // root + 3 items

      // Check array items have numeric keys
      expect(getNodeByPath('root[0]')).toBeTruthy();
      expect(getNodeByPath('root[1]')).toBeTruthy();
      expect(getNodeByPath('root[2]')).toBeTruthy();
    });

    it('should render array of objects', () => {
      hostComponent.data.set([{ id: 1 }, { id: 2 }]);
      fixture.detectChanges();

      const nodes = getTreeNodes();
      // root + obj1 + id1 + obj2 + id2 = 5
      expect(nodes.length).toBe(5);

      expect(getNodeByPath('root[0].id')).toBeTruthy();
      expect(getNodeByPath('root[1].id')).toBeTruthy();
    });
  });

  describe('container info display', () => {
    it('should display child count for objects', () => {
      hostComponent.data.set({ a: 1, b: 2, c: 3 });
      fixture.detectChanges();

      const rootNode = getNodeByPath('root');
      const containerInfo = rootNode?.querySelector('.container-info');
      expect(containerInfo).toBeTruthy();

      const childCount = rootNode?.querySelector('.child-count');
      expect(childCount?.textContent).toBe('3');

      // Check for object indicators
      const typeIndicators = rootNode?.querySelectorAll('.type-indicator');
      expect(typeIndicators?.length).toBe(2);
      expect(typeIndicators?.[0]?.textContent).toBe('{');
      expect(typeIndicators?.[1]?.textContent).toBe('}');
    });

    it('should display child count for arrays', () => {
      hostComponent.data.set([1, 2, 3, 4, 5]);
      fixture.detectChanges();

      const rootNode = getNodeByPath('root');
      const childCount = rootNode?.querySelector('.child-count');
      expect(childCount?.textContent).toBe('5');

      // Check for array indicators
      const typeIndicators = rootNode?.querySelectorAll('.type-indicator');
      expect(typeIndicators?.[0]?.textContent).toBe('[');
      expect(typeIndicators?.[1]?.textContent).toBe(']');
    });

    it('should not display container info for primitives', () => {
      hostComponent.data.set({ name: 'test' });
      fixture.detectChanges();

      const nameNode = getNodeByPath('root.name');
      const containerInfo = nameNode?.querySelector('.container-info');
      expect(containerInfo).toBeNull();
    });
  });

  describe('expansion state', () => {
    it('should render all nodes when expanded is true (default)', () => {
      hostComponent.data.set({ a: { b: { c: 1 } } });
      hostComponent.expanded.set(true);
      fixture.detectChanges();

      const nodes = getTreeNodes();
      // root + a + b + c = 4
      expect(nodes.length).toBe(4);
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

      const rootNode = getNodeByPath('root');
      expect(rootNode?.classList.contains('expandable')).toBe(true);
      expect(rootNode?.classList.contains('expanded')).toBe(true);
    });

    it('should not have expanded class when collapsed', () => {
      hostComponent.data.set({ nested: { value: 1 } });
      hostComponent.expanded.set(false);
      fixture.detectChanges();

      const rootNode = getNodeByPath('root');
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

      expect(getNodeByPath('root.str')?.getAttribute('data-value-type')).toBe('string');
      expect(getNodeByPath('root.num')?.getAttribute('data-value-type')).toBe('number');
      expect(getNodeByPath('root.bool')?.getAttribute('data-value-type')).toBe('boolean');
      expect(getNodeByPath('root.nil')?.getAttribute('data-value-type')).toBe('null');
      expect(getNodeByPath('root.obj')?.getAttribute('data-value-type')).toBe('object');
      expect(getNodeByPath('root.arr')?.getAttribute('data-value-type')).toBe('array');
    });
  });

  describe('empty data handling', () => {
    it('should render empty object with zero child count', () => {
      hostComponent.data.set({});
      fixture.detectChanges();

      const nodes = getTreeNodes();
      expect(nodes.length).toBe(1);

      const childCount = getNodeByPath('root')?.querySelector('.child-count');
      expect(childCount?.textContent).toBe('0');
    });

    it('should render empty array with zero child count', () => {
      hostComponent.data.set([]);
      fixture.detectChanges();

      const nodes = getTreeNodes();
      expect(nodes.length).toBe(1);

      const childCount = getNodeByPath('root')?.querySelector('.child-count');
      expect(childCount?.textContent).toBe('0');
    });
  });

  describe('data change reactivity', () => {
    it('should update when data changes', () => {
      hostComponent.data.set({ a: 1 });
      fixture.detectChanges();
      expect(getTreeNodes().length).toBe(2);

      hostComponent.data.set({ a: 1, b: 2, c: 3 });
      fixture.detectChanges();
      expect(getTreeNodes().length).toBe(4);
    });

    it('should update when expanded changes', () => {
      hostComponent.data.set({ nested: { deep: { value: 1 } } });
      hostComponent.expanded.set(true);
      fixture.detectChanges();
      expect(getTreeNodes().length).toBe(4);

      hostComponent.expanded.set(false);
      fixture.detectChanges();
      expect(getTreeNodes().length).toBe(1);
    });
  });
});
