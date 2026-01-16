/**
 * @fileoverview Feature-scoped SimulationStore for managing simulation state.
 *
 * Provides state management for the current LLM request, request queue (FR-024),
 * and tool selection. This store is NOT providedIn: 'root' - it should be
 * provided at the component level (e.g., SessionComponent).
 *
 * Uses @ngrx/signals SignalStore pattern.
 * @see mddocs/frontend/frontend-tdd.md#simulationstore-feature-scoped
 */

import type { FunctionDeclaration, GenerateContentRequest } from '@adk-sim/protos';
import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

/**
 * State interface for the simulation feature.
 *
 * - currentRequest: The active LLM request being handled by the user
 * - requestQueue: FIFO queue for concurrent agent requests (FR-024)
 * - selectedTool: Currently selected tool for invocation
 */
export interface SimulationState {
  /** The active LLM request being handled, or null if idle. */
  currentRequest: GenerateContentRequest | null;
  /** FIFO queue of pending requests when user is busy with another request. */
  requestQueue: GenerateContentRequest[];
  /** Currently selected tool for invocation, or null if none selected. */
  selectedTool: FunctionDeclaration | null;
}

/**
 * Initial state for the simulation store.
 */
const initialState: SimulationState = {
  currentRequest: null,
  requestQueue: [],
  selectedTool: null,
};

/**
 * Feature-scoped SignalStore for simulation state management.
 *
 * This store manages the request queue per FR-024:
 * - When a new request arrives and user is idle, it becomes currentRequest
 * - When a new request arrives and user is busy, it's queued
 * - When user submits response, next queued request becomes current
 *
 * @example
 * ```typescript
 * // Provide in component
 * @Component({
 *   providers: [SimulationStore],
 * })
 * export class SessionComponent {
 *   private readonly store = inject(SimulationStore);
 *
 *   // Access state
 *   readonly hasRequest = this.store.hasRequest;
 *   readonly availableTools = this.store.availableTools;
 * }
 * ```
 */
export const SimulationStore = signalStore(
  // State
  withState<SimulationState>(initialState),

  // Computed signals (derived state)
  withComputed((store) => ({
    /** Whether there is an active request to handle. */
    hasRequest: computed(() => store.currentRequest() !== null),

    /** Number of requests waiting in the queue. */
    queueLength: computed(() => store.requestQueue().length),

    /**
     * Flattened list of available function declarations from all tools.
     * Extracts functionDeclarations from each Tool in the request's tools array.
     */
    availableTools: computed<FunctionDeclaration[]>(() => {
      const req = store.currentRequest();
      if (!req?.tools) return [];
      // Flatten function declarations from all tools
      return req.tools.flatMap((t) => t.functionDeclarations);
    }),

    /** Contents from the current request, or empty array if no request. */
    contents: computed(() => store.currentRequest()?.contents ?? []),

    /** System instruction from the current request, if present. */
    systemInstruction: computed(() => store.currentRequest()?.systemInstruction),
  })),

  // Methods (mutations and actions)
  withMethods((store) => ({
    /**
     * Handle incoming request from stream.
     * Per FR-024: queue if busy, set current if idle.
     *
     * @param request - The incoming LLM request
     */
    receiveRequest(request: GenerateContentRequest): void {
      if (store.currentRequest() === null) {
        // Idle - set as current request
        patchState(store, { currentRequest: request });
      } else {
        // Busy - add to queue
        patchState(store, {
          requestQueue: [...store.requestQueue(), request],
        });
      }
    },

    /**
     * Advance to next request after user submits response.
     * Clears current request and promotes first queued request (FIFO).
     * Also clears any tool selection.
     */
    advanceQueue(): void {
      const [next, ...rest] = store.requestQueue();
      patchState(store, {
        currentRequest: next ?? null,
        requestQueue: rest,
        selectedTool: null, // Clear selection when advancing
      });
    },

    /**
     * Select a tool for invocation.
     *
     * @param tool - The function declaration to select, or null to clear
     */
    selectTool(tool: FunctionDeclaration | null): void {
      patchState(store, { selectedTool: tool });
    },

    /**
     * Clear the current tool selection.
     */
    clearSelection(): void {
      patchState(store, { selectedTool: null });
    },
  })),
);
