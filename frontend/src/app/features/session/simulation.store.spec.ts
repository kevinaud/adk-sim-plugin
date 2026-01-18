/**
 * @fileoverview Unit tests for SimulationStore.
 *
 * Tests verify that the store correctly:
 * - Initializes with default values
 * - Manages request queue (FR-024: add when idle, add when busy, advance)
 * - Computes derived state (hasRequest, queueLength, availableTools, etc.)
 * - Manages tool selection
 *
 * @see mddocs/frontend/frontend-tdd.md#simulationstore-feature-scoped
 */

import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';

import {
  ContentSchema,
  FunctionDeclarationSchema,
  GenerateContentRequestSchema,
  PartSchema,
  ToolSchema,
  type FunctionDeclaration,
} from '@adk-sim/protos';

import { SimulationStore } from './simulation.store';

/**
 * Helper to create a test GenerateContentRequest with optional tools.
 */
function createTestRequest(
  model: string,
  tools: FunctionDeclaration[] = [],
): ReturnType<typeof create<typeof GenerateContentRequestSchema>> {
  return create(GenerateContentRequestSchema, {
    model,
    contents: [],
    tools:
      tools.length > 0
        ? [
            create(ToolSchema, {
              functionDeclarations: tools,
            }),
          ]
        : [],
  });
}

/**
 * Helper to create a test FunctionDeclaration.
 */
function createTestFunction(name: string, description = ''): FunctionDeclaration {
  return create(FunctionDeclarationSchema, {
    name,
    description,
  });
}

describe('SimulationStore', () => {
  let store: InstanceType<typeof SimulationStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SimulationStore],
    });
    store = TestBed.inject(SimulationStore);
  });

  describe('initial state', () => {
    it('should have null currentRequest initially', () => {
      expect(store.currentRequest()).toBeNull();
    });

    it('should have null currentTurnId initially', () => {
      expect(store.currentTurnId()).toBeNull();
    });

    it('should have empty requestQueue initially', () => {
      expect(store.requestQueue()).toEqual([]);
    });

    it('should have null selectedTool initially', () => {
      expect(store.selectedTool()).toBeNull();
    });

    it('should have hasRequest as false initially', () => {
      expect(store.hasRequest()).toBe(false);
    });

    it('should have queueLength as 0 initially', () => {
      expect(store.queueLength()).toBe(0);
    });

    it('should have empty availableTools initially', () => {
      expect(store.availableTools()).toEqual([]);
    });

    it('should have empty contents initially', () => {
      expect(store.contents()).toEqual([]);
    });

    it('should have undefined systemInstruction initially', () => {
      expect(store.systemInstruction()).toBeUndefined();
    });
  });

  describe('receiveRequest', () => {
    describe('when idle (no current request)', () => {
      it('should set request as currentRequest when idle', () => {
        const request = createTestRequest('models/gemini-pro');

        store.receiveRequest(request, 'test-turn-id');

        expect(store.currentRequest()).toBe(request);
        expect(store.hasRequest()).toBe(true);
        expect(store.queueLength()).toBe(0);
      });

      it('should update contents computed when request has contents', () => {
        const textPart = create(PartSchema, {
          data: { case: 'text', value: 'Hello' },
        });
        const userContent = create(ContentSchema, {
          role: 'user',
          parts: [textPart],
        });
        const request = create(GenerateContentRequestSchema, {
          model: 'models/gemini-pro',
          contents: [userContent],
        });

        store.receiveRequest(request, 'test-turn-id');

        expect(store.contents().length).toBe(1);
        expect(store.contents()[0]?.role).toBe('user');
      });

      it('should update availableTools computed when request has tools', () => {
        const fn1 = createTestFunction('tool1', 'First tool');
        const fn2 = createTestFunction('tool2', 'Second tool');
        const request = createTestRequest('models/gemini-pro', [fn1, fn2]);

        store.receiveRequest(request, 'test-turn-id');

        const tools = store.availableTools();
        expect(tools.length).toBe(2);
        expect(tools[0]?.name).toBe('tool1');
        expect(tools[1]?.name).toBe('tool2');
      });
    });

    describe('when busy (has current request)', () => {
      it('should queue request when busy', () => {
        const request1 = createTestRequest('models/gemini-pro-1');
        const request2 = createTestRequest('models/gemini-pro-2');

        store.receiveRequest(request1, 'turn-1');
        store.receiveRequest(request2, 'turn-2');

        expect(store.currentRequest()).toBe(request1);
        expect(store.queueLength()).toBe(1);
        expect(store.requestQueue()[0]?.request).toBe(request2);
      });

      it('should maintain FIFO order when multiple requests queued', () => {
        const request1 = createTestRequest('models/gemini-pro-1');
        const request2 = createTestRequest('models/gemini-pro-2');
        const request3 = createTestRequest('models/gemini-pro-3');

        store.receiveRequest(request1, 'turn-1');
        store.receiveRequest(request2, 'turn-2');
        store.receiveRequest(request3, 'turn-3');

        expect(store.currentRequest()).toBe(request1);
        expect(store.queueLength()).toBe(2);
        expect(store.requestQueue()[0]?.request).toBe(request2);
        expect(store.requestQueue()[1]?.request).toBe(request3);
      });
    });
  });

  describe('advanceQueue', () => {
    it('should promote first queued request to current (FIFO)', () => {
      const request1 = createTestRequest('models/gemini-pro-1');
      const request2 = createTestRequest('models/gemini-pro-2');
      const request3 = createTestRequest('models/gemini-pro-3');

      store.receiveRequest(request1, 'turn-1');
      store.receiveRequest(request2, 'turn-2');
      store.receiveRequest(request3, 'turn-3');

      store.advanceQueue();

      expect(store.currentRequest()).toBe(request2);
      expect(store.queueLength()).toBe(1);
      expect(store.requestQueue()[0]?.request).toBe(request3);
    });

    it('should set currentRequest to null when queue is empty', () => {
      const request = createTestRequest('models/gemini-pro');

      store.receiveRequest(request, 'test-turn-id');
      store.advanceQueue();

      expect(store.currentRequest()).toBeNull();
      expect(store.hasRequest()).toBe(false);
      expect(store.queueLength()).toBe(0);
    });

    it('should clear selectedTool when advancing', () => {
      const fn = createTestFunction('my-tool');
      const request = createTestRequest('models/gemini-pro', [fn]);

      store.receiveRequest(request, 'test-turn-id');
      store.selectTool(fn);
      expect(store.selectedTool()).toBe(fn);

      store.advanceQueue();

      expect(store.selectedTool()).toBeNull();
    });

    it('should handle multiple advances correctly', () => {
      const request1 = createTestRequest('models/gemini-pro-1');
      const request2 = createTestRequest('models/gemini-pro-2');

      store.receiveRequest(request1, 'turn-1');
      store.receiveRequest(request2, 'turn-2');

      store.advanceQueue();
      expect(store.currentRequest()).toBe(request2);
      expect(store.queueLength()).toBe(0);

      store.advanceQueue();
      expect(store.currentRequest()).toBeNull();
      expect(store.hasRequest()).toBe(false);
    });
  });

  describe('selectTool', () => {
    it('should set selectedTool', () => {
      const fn = createTestFunction('my-tool', 'A test tool');

      store.selectTool(fn);

      expect(store.selectedTool()).toBe(fn);
    });

    it('should allow changing selection', () => {
      const fn1 = createTestFunction('tool1');
      const fn2 = createTestFunction('tool2');

      store.selectTool(fn1);
      store.selectTool(fn2);

      expect(store.selectedTool()).toBe(fn2);
    });

    it('should allow selecting null', () => {
      const fn = createTestFunction('my-tool');

      store.selectTool(fn);
      store.selectTool(null);

      expect(store.selectedTool()).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('should clear selectedTool', () => {
      const fn = createTestFunction('my-tool');

      store.selectTool(fn);
      store.clearSelection();

      expect(store.selectedTool()).toBeNull();
    });

    it('should be safe to call when no selection exists', () => {
      store.clearSelection();

      expect(store.selectedTool()).toBeNull();
    });
  });

  describe('computed: availableTools', () => {
    it('should return empty array when no request', () => {
      expect(store.availableTools()).toEqual([]);
    });

    it('should return empty array when request has no tools', () => {
      const request = createTestRequest('models/gemini-pro');

      store.receiveRequest(request, 'test-turn-id');

      expect(store.availableTools()).toEqual([]);
    });

    it('should flatten functionDeclarations from all tools', () => {
      // Create request with multiple tools, each with function declarations
      const fn1 = createTestFunction('fn1');
      const fn2 = createTestFunction('fn2');
      const fn3 = createTestFunction('fn3');

      const request = create(GenerateContentRequestSchema, {
        model: 'models/gemini-pro',
        contents: [],
        tools: [
          create(ToolSchema, { functionDeclarations: [fn1, fn2] }),
          create(ToolSchema, { functionDeclarations: [fn3] }),
        ],
      });

      store.receiveRequest(request, 'test-turn-id');

      expect(store.availableTools().length).toBe(3);
      expect(store.availableTools().map((t) => t.name)).toEqual(['fn1', 'fn2', 'fn3']);
    });

    it('should update when currentRequest changes via advanceQueue', () => {
      const fn1 = createTestFunction('tool1');
      const fn2 = createTestFunction('tool2');
      const request1 = createTestRequest('models/gemini-pro', [fn1]);
      const request2 = createTestRequest('models/gemini-pro', [fn2]);

      store.receiveRequest(request1, 'turn-1');
      store.receiveRequest(request2, 'turn-2');

      expect(store.availableTools()[0]?.name).toBe('tool1');

      store.advanceQueue();

      expect(store.availableTools()[0]?.name).toBe('tool2');
    });
  });

  describe('computed: systemInstruction', () => {
    it('should return systemInstruction from request', () => {
      const instructionPart = create(PartSchema, {
        data: { case: 'text', value: 'You are a helpful assistant.' },
      });
      const systemContent = create(ContentSchema, {
        role: 'system',
        parts: [instructionPart],
      });
      const request = create(GenerateContentRequestSchema, {
        model: 'models/gemini-pro',
        contents: [],
        systemInstruction: systemContent,
      });

      store.receiveRequest(request, 'test-turn-id');

      expect(store.systemInstruction()?.role).toBe('system');
      const part = store.systemInstruction()?.parts[0];
      // Part uses discriminated union for data
      expect(part?.data.case).toBe('text');
      if (part?.data.case === 'text') {
        expect(part.data.value).toBe('You are a helpful assistant.');
      }
    });

    it('should be undefined when request has no systemInstruction', () => {
      const request = createTestRequest('models/gemini-pro');

      store.receiveRequest(request, 'test-turn-id');

      expect(store.systemInstruction()).toBeUndefined();
    });
  });

  describe('queue behavior scenarios', () => {
    it('should handle full request lifecycle', () => {
      // Initial: idle
      expect(store.hasRequest()).toBe(false);

      // Request 1 arrives - becomes current
      const request1 = createTestRequest('models/gemini-pro-1');
      store.receiveRequest(request1, 'turn-1');
      expect(store.hasRequest()).toBe(true);
      expect(store.currentRequest()).toBe(request1);

      // User selects a tool
      const fn = createTestFunction('some-tool');
      store.selectTool(fn);
      expect(store.selectedTool()).toBe(fn);

      // While user is busy, request 2 arrives - queued
      const request2 = createTestRequest('models/gemini-pro-2');
      store.receiveRequest(request2, 'turn-2');
      expect(store.currentRequest()).toBe(request1);
      expect(store.queueLength()).toBe(1);

      // User submits response - advance to request 2
      store.advanceQueue();
      expect(store.currentRequest()).toBe(request2);
      expect(store.selectedTool()).toBeNull(); // Selection cleared
      expect(store.queueLength()).toBe(0);

      // User submits final response
      store.advanceQueue();
      expect(store.currentRequest()).toBeNull();
      expect(store.hasRequest()).toBe(false);
    });
  });
});
