/**
 * @fileoverview Unit tests for flattenTree utility function.
 *
 * Tests cover:
 * - Empty objects and arrays
 * - Flat objects with primitives
 * - Nested objects
 * - Arrays of primitives and objects
 * - Mixed types
 * - Deeply nested structures (5+ levels)
 * - Expansion state with expandedPaths parameter
 * - Edge cases (null, undefined, max depth)
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-008 through FR-011
 */

import { flattenTree } from './flatten-tree.util';
import { TreeNode, ValueType } from './tree-node.types';

describe('flattenTree', () => {
  describe('empty containers', () => {
    it('should handle empty object', () => {
      const result = flattenTree({});

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: '$',
        depth: 0,
        key: '',
        displayValue: null,
        valueType: ValueType.Object,
        expandable: true,
        expanded: true,
        childCount: 0,
        isClosingBrace: false,
        isRoot: true,
      });
    });

    it('should handle empty array', () => {
      const result = flattenTree([]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: '$',
        depth: 0,
        key: '',
        displayValue: null,
        valueType: ValueType.Array,
        expandable: true,
        expanded: true,
        childCount: 0,
        isClosingBrace: false,
        isRoot: true,
      });
    });
  });

  describe('primitives at root', () => {
    it('should handle string', () => {
      const result = flattenTree('hello');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: '$',
        depth: 0,
        key: '',
        displayValue: '"hello"',
        valueType: ValueType.String,
        expandable: false,
        expanded: false,
        childCount: 0,
        isRoot: true,
      });
    });

    it('should handle number', () => {
      const result = flattenTree(42);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        displayValue: '42',
        valueType: ValueType.Number,
        expandable: false,
      });
    });

    it('should handle boolean true', () => {
      const result = flattenTree(true);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        displayValue: 'true',
        valueType: ValueType.Boolean,
        expandable: false,
      });
    });

    it('should handle boolean false', () => {
      const result = flattenTree(false);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        displayValue: 'false',
        valueType: ValueType.Boolean,
        expandable: false,
      });
    });

    it('should handle null', () => {
      const result = flattenTree(null);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        displayValue: 'null',
        valueType: ValueType.Null,
        expandable: false,
      });
    });

    it('should return empty array for undefined', () => {
      const result = flattenTree(undefined);

      expect(result).toHaveLength(0);
    });
  });

  describe('simple flat object', () => {
    it('should flatten object with string and number', () => {
      const data = { a: 1, b: 'hello' };
      const result = flattenTree(data);

      expect(result).toHaveLength(4); // root + 2 properties + closing brace

      // Root node (no key, represents the object itself)
      expect(result[0]).toMatchObject({
        path: '$',
        depth: 0,
        key: '',
        valueType: ValueType.Object,
        expandable: true,
        expanded: true,
        childCount: 2,
        isRoot: true,
      });

      // Property 'a'
      expect(result[1]).toMatchObject({
        path: '$.a',
        depth: 1,
        key: 'a',
        displayValue: '1',
        valueType: ValueType.Number,
        expandable: false,
        isArrayIndex: false,
      });

      // Property 'b'
      expect(result[2]).toMatchObject({
        path: '$.b',
        depth: 1,
        key: 'b',
        displayValue: '"hello"',
        valueType: ValueType.String,
        expandable: false,
        isArrayIndex: false,
      });

      // Closing brace
      expect(result[3]).toMatchObject({
        path: '$:closing',
        isClosingBrace: true,
        closingBrace: '}',
      });
    });

    it('should handle object with all primitive types', () => {
      const data = {
        str: 'text',
        num: 123,
        bool: true,
        nil: null,
      };
      const result = flattenTree(data);

      expect(result).toHaveLength(6); // root + 4 properties + closing brace

      const nodeMap = new Map(result.map((n) => [n.key, n]));
      expect(nodeMap.get('str')?.valueType).toBe(ValueType.String);
      expect(nodeMap.get('num')?.valueType).toBe(ValueType.Number);
      expect(nodeMap.get('bool')?.valueType).toBe(ValueType.Boolean);
      expect(nodeMap.get('nil')?.valueType).toBe(ValueType.Null);
    });
  });

  describe('nested object', () => {
    it('should flatten nested object with correct depth', () => {
      const data = {
        user: {
          name: 'John',
          age: 30,
        },
      };
      const result = flattenTree(data);

      expect(result).toHaveLength(6); // root + user + name + age + 2 closing braces

      // Root (no key, represents the object itself)
      expect(result[0]).toMatchObject({
        path: '$',
        depth: 0,
        key: '',
        valueType: ValueType.Object,
        childCount: 1,
        isRoot: true,
      });

      // user
      expect(result[1]).toMatchObject({
        path: '$.user',
        depth: 1,
        key: 'user',
        valueType: ValueType.Object,
        expandable: true,
        childCount: 2,
      });

      // name
      expect(result[2]).toMatchObject({
        path: '$.user.name',
        depth: 2,
        key: 'name',
        displayValue: '"John"',
      });

      // age
      expect(result[3]).toMatchObject({
        path: '$.user.age',
        depth: 2,
        key: 'age',
        displayValue: '30',
      });

      // Closing brace for user object
      expect(result[4]).toMatchObject({
        path: '$.user:closing',
        isClosingBrace: true,
        closingBrace: '}',
      });

      // Closing brace for root
      expect(result[5]).toMatchObject({
        path: '$:closing',
        isClosingBrace: true,
        closingBrace: '}',
      });
    });
  });

  describe('arrays', () => {
    it('should handle array of primitives', () => {
      const data = [1, 2, 3];
      const result = flattenTree(data);

      expect(result).toHaveLength(5); // root + 3 items + closing bracket

      // Root array (no key, represents the array itself)
      expect(result[0]).toMatchObject({
        path: '$',
        depth: 0,
        key: '',
        valueType: ValueType.Array,
        childCount: 3,
        isRoot: true,
      });

      // Array items with bracket notation paths
      expect(result[1]).toMatchObject({
        path: '$[0]',
        depth: 1,
        key: '0',
        displayValue: '1',
        isArrayIndex: true,
      });

      expect(result[2]).toMatchObject({
        path: '$[1]',
        depth: 1,
        key: '1',
        displayValue: '2',
        isArrayIndex: true,
      });

      expect(result[3]).toMatchObject({
        path: '$[2]',
        depth: 1,
        key: '2',
        displayValue: '3',
        isArrayIndex: true,
      });

      // Closing bracket
      expect(result[4]).toMatchObject({
        path: '$:closing',
        isClosingBrace: true,
        closingBrace: ']',
      });
    });

    it('should handle array of objects', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = flattenTree(data);

      expect(result).toHaveLength(8); // root + 2 objects + 2 ids + 3 closing (2 inner + 1 root)

      // First object
      expect(result[1]).toMatchObject({
        path: '$[0]',
        depth: 1,
        key: '0',
        valueType: ValueType.Object,
        expandable: true,
        childCount: 1,
        isArrayIndex: true,
      });

      // First object's id
      expect(result[2]).toMatchObject({
        path: '$[0].id',
        depth: 2,
        key: 'id',
        displayValue: '1',
      });

      // First object's closing brace
      expect(result[3]).toMatchObject({
        path: '$[0]:closing',
        isClosingBrace: true,
        closingBrace: '}',
      });

      // Second object
      expect(result[4]).toMatchObject({
        path: '$[1]',
        depth: 1,
        key: '1',
        valueType: ValueType.Object,
        isArrayIndex: true,
      });

      // Second object's id
      expect(result[5]).toMatchObject({
        path: '$[1].id',
        depth: 2,
        key: 'id',
        displayValue: '2',
      });

      // Second object's closing brace
      expect(result[6]).toMatchObject({
        path: '$[1]:closing',
        isClosingBrace: true,
        closingBrace: '}',
      });

      // Root array closing bracket
      expect(result[7]).toMatchObject({
        path: '$:closing',
        isClosingBrace: true,
        closingBrace: ']',
      });
    });

    it('should handle object containing arrays', () => {
      const data = { items: [1, 2] };
      const result = flattenTree(data);

      expect(result).toHaveLength(6); // root + items + 2 elements + 2 closing

      // items array
      expect(result[1]).toMatchObject({
        path: '$.items',
        depth: 1,
        key: 'items',
        valueType: ValueType.Array,
        childCount: 2,
      });

      // array items
      expect(result[2]).toMatchObject({
        path: '$.items[0]',
        depth: 2,
        key: '0',
        isArrayIndex: true,
      });

      expect(result[3]).toMatchObject({
        path: '$.items[1]',
        depth: 2,
        key: '1',
        isArrayIndex: true,
      });

      // Closing bracket for items array
      expect(result[4]).toMatchObject({
        path: '$.items:closing',
        isClosingBrace: true,
        closingBrace: ']',
      });

      // Closing brace for root
      expect(result[5]).toMatchObject({
        path: '$:closing',
        isClosingBrace: true,
        closingBrace: '}',
      });
    });
  });

  describe('mixed types', () => {
    it('should handle object with string, number, boolean, null, object, array', () => {
      const data = {
        name: 'test',
        count: 42,
        active: true,
        deleted: null,
        meta: { version: 1 },
        tags: ['a', 'b'],
      };
      const result = flattenTree(data);

      const pathMap = new Map(result.map((n) => [n.path, n]));

      // Check types
      expect(pathMap.get('$.name')?.valueType).toBe(ValueType.String);
      expect(pathMap.get('$.count')?.valueType).toBe(ValueType.Number);
      expect(pathMap.get('$.active')?.valueType).toBe(ValueType.Boolean);
      expect(pathMap.get('$.deleted')?.valueType).toBe(ValueType.Null);
      expect(pathMap.get('$.meta')?.valueType).toBe(ValueType.Object);
      expect(pathMap.get('$.tags')?.valueType).toBe(ValueType.Array);

      // Verify all expanded by default
      result.forEach((node) => {
        if (node.expandable) {
          expect(node.expanded).toBe(true);
        }
      });
    });
  });

  describe('deeply nested (5+ levels)', () => {
    it('should handle 5+ levels of nesting', () => {
      // Structure: $ -> l1 -> l2 -> l3 -> l4 -> l5 -> value
      // Depths:    0    1     2     3     4     5     6
      const data = {
        l1: {
          l2: {
            l3: {
              l4: {
                l5: {
                  value: 'deep',
                },
              },
            },
          },
        },
      };
      const result = flattenTree(data);

      // Find the deepest value (at depth 6, after 5 nested objects)
      const deepNode = result.find((n) => n.key === 'value');
      expect(deepNode).toBeDefined();
      expect(deepNode?.depth).toBe(6); // 6 levels deep (root=0, then 5 objects + 1 value)
      expect(deepNode?.path).toBe('$.l1.l2.l3.l4.l5.value');
      expect(deepNode?.displayValue).toBe('"deep"');
    });

    it('should handle deeply nested arrays', () => {
      const data = [[[[['deep']]]]];
      const result = flattenTree(data);

      // Find the string value at depth 5
      const deepNode = result.find((n) => n.valueType === ValueType.String);
      expect(deepNode).toBeDefined();
      expect(deepNode?.depth).toBe(5);
      expect(deepNode?.path).toBe('$[0][0][0][0][0]');
    });
  });

  describe('expansion state with expandedPaths', () => {
    it('should expand all nodes when expandedPaths is not provided (FR-009)', () => {
      const data = { a: { b: { c: 1 } } };
      const result = flattenTree(data);

      // All expandable nodes should be expanded
      const expandableNodes = result.filter((n) => n.expandable);
      expandableNodes.forEach((node) => {
        expect(node.expanded).toBe(true);
      });

      // Should have all nodes because everything is expanded
      // $, a, b, c + 3 closing braces for $, a, b
      expect(result).toHaveLength(7);
    });

    it('should only expand paths in expandedPaths set', () => {
      const data = { a: { b: { c: 1 } } };
      const expandedPaths = new Set(['$', '$.a']);
      const result = flattenTree(data, expandedPaths);

      const pathMap = new Map(result.map((n) => [n.path, n]));

      // root should be expanded
      expect(pathMap.get('$')?.expanded).toBe(true);

      // a should be expanded (in set)
      expect(pathMap.get('$.a')?.expanded).toBe(true);

      // b should NOT be expanded (not in set)
      expect(pathMap.get('$.a.b')?.expanded).toBe(false);

      // c should NOT be in result because b is collapsed
      expect(pathMap.has('$.a.b.c')).toBe(false);
    });

    it('should not recurse into collapsed nodes', () => {
      const data = { a: { b: 1, c: 2 }, d: 3 };
      const expandedPaths = new Set(['$']); // Only root expanded
      const result = flattenTree(data, expandedPaths);

      // Should have: $, a (collapsed), d, $:closing
      expect(result).toHaveLength(4);

      const paths = result.map((n) => n.path);
      expect(paths).toContain('$');
      expect(paths).toContain('$.a');
      expect(paths).toContain('$.d');

      // Should NOT have b or c because a is collapsed
      expect(paths).not.toContain('$.a.b');
      expect(paths).not.toContain('$.a.c');

      // Verify a is marked as not expanded
      const aNode = result.find((n) => n.path === '$.a');
      expect(aNode?.expanded).toBe(false);
      expect(aNode?.expandable).toBe(true);
      expect(aNode?.childCount).toBe(2); // Still knows it has children
    });

    it('should handle empty expandedPaths set (nothing expanded)', () => {
      const data = { a: { b: 1 } };
      const expandedPaths = new Set<string>();
      const result = flattenTree(data, expandedPaths);

      // Should only have root (collapsed)
      expect(result).toHaveLength(1);
      const rootNode = result[0];
      expect(rootNode).toBeDefined();
      expect(rootNode?.path).toBe('$');
      expect(rootNode?.expanded).toBe(false);
    });
  });

  describe('max depth protection', () => {
    it('should stop recursion at max depth', () => {
      // Create deeply nested structure
      let data: unknown = 'bottom';
      for (let i = 0; i < 150; i++) {
        data = { nested: data };
      }

      // Should not throw and should stop at max depth
      const result = flattenTree(data);

      // Should have max depth message at some point
      const maxDepthNode = result.find((n) => n.displayValue === '[max depth exceeded]');
      expect(maxDepthNode).toBeDefined();
      expect((maxDepthNode?.depth ?? 0) <= 101).toBe(true);
    });

    it('should respect custom max depth', () => {
      const data = { a: { b: { c: { d: 1 } } } };
      const result = flattenTree(data, undefined, 2);

      // Should stop at depth 2
      const maxDepthNode = result.find((n) => n.displayValue === '[max depth exceeded]');
      expect(maxDepthNode).toBeDefined();
      expect(maxDepthNode?.depth).toBe(3); // Exceeded at depth 3
    });
  });

  describe('edge cases', () => {
    it('should handle object with empty string key', () => {
      const data = { '': 'empty key' };
      const result = flattenTree(data);

      expect(result).toHaveLength(3); // root + property + closing brace
      const emptyKeyNode = result[1];
      expect(emptyKeyNode).toBeDefined();
      expect(emptyKeyNode?.key).toBe('');
      expect(emptyKeyNode?.displayValue).toBe('"empty key"');
    });

    it('should handle object with numeric string keys', () => {
      const data = { '0': 'zero', '1': 'one' };
      const result = flattenTree(data);

      expect(result).toHaveLength(4); // root + 2 properties + closing brace
      const keys = result.map((n) => n.key);
      expect(keys).toContain('0');
      expect(keys).toContain('1');
    });

    it('should handle object with special characters in keys', () => {
      const data = { 'key.with.dots': 'value' };
      const result = flattenTree(data);

      expect(result).toHaveLength(3); // root + property + closing brace
      const dotKeyNode = result[1];
      expect(dotKeyNode).toBeDefined();
      expect(dotKeyNode?.key).toBe('key.with.dots');
      // Path still uses dot notation (may need escaping in real use)
      expect(dotKeyNode?.path).toBe('$.key.with.dots');
    });

    it('should handle empty string value', () => {
      const data = { empty: '' };
      const result = flattenTree(data);

      const emptyNode = result.find((n) => n.key === 'empty');
      expect(emptyNode?.displayValue).toBe('""');
      expect(emptyNode?.valueType).toBe(ValueType.String);
    });

    it('should handle zero and negative numbers', () => {
      const data = { zero: 0, negative: -42 };
      const result = flattenTree(data);

      const pathMap = new Map(result.map((n) => [n.key, n]));
      expect(pathMap.get('zero')?.displayValue).toBe('0');
      expect(pathMap.get('negative')?.displayValue).toBe('-42');
    });

    it('should handle float numbers', () => {
      const data = { pi: 3.14159 };
      const result = flattenTree(data);

      const piNode = result.find((n) => n.key === 'pi');
      expect(piNode?.displayValue).toBe('3.14159');
      expect(piNode?.valueType).toBe(ValueType.Number);
    });
  });

  describe('node properties consistency', () => {
    it('should always include all TreeNode properties', () => {
      const data = { key: 'value' };
      const result = flattenTree(data);

      result.forEach((node: TreeNode) => {
        expect(node).toHaveProperty('path');
        expect(node).toHaveProperty('depth');
        expect(node).toHaveProperty('key');
        expect(node).toHaveProperty('displayValue');
        expect(node).toHaveProperty('valueType');
        expect(node).toHaveProperty('expandable');
        expect(node).toHaveProperty('expanded');
        expect(node).toHaveProperty('childCount');
      });
    });

    it('should have correct expandable/expanded for primitives', () => {
      const data = { str: 'text', num: 1, bool: true, nil: null };
      const result = flattenTree(data);

      // Filter out root node (key === '')
      const primitiveNodes = result.filter((n) => n.key !== '');

      primitiveNodes.forEach((node) => {
        expect(node.expandable).toBe(false);
        // Non-expandable nodes have expanded: false
        expect(node.expanded).toBe(false);
        expect(node.childCount).toBe(0);
      });
    });
  });
});
