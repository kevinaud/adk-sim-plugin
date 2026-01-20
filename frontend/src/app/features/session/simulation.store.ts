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

import type { Content, FunctionDeclaration, GenerateContentRequest } from '@adk-sim/protos';
import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

/**
 * A historical event with its turn ID for replay tracking.
 */
interface HistoricalEvent {
  turnId: string;
  type: 'request' | 'response';
  request?: GenerateContentRequest;
}

/**
 * State interface for the simulation feature.
 *
 * - currentRequest: The active LLM request being handled by the user
 * - currentTurnId: The turn ID of the current request (for submitDecision)
 * - requestQueue: FIFO queue for concurrent agent requests (FR-024)
 * - selectedTool: Currently selected tool for invocation
 * - isReplayComplete: Whether historical event replay is finished
 * - historicalEvents: Events received during replay (before history_complete)
 * - displayedContents: All contents to display in the event stream
 */
export interface SimulationState {
  /** The active LLM request being handled, or null if idle. */
  currentRequest: GenerateContentRequest | null;
  /** The turn ID of the current request, needed for submitDecision. */
  currentTurnId: string | null;
  /** FIFO queue of pending requests when user is busy with another request. */
  requestQueue: { request: GenerateContentRequest; turnId: string }[];
  /** Currently selected tool for invocation, or null if none selected. */
  selectedTool: FunctionDeclaration | null;
  /** Whether history replay is complete (true = live mode). */
  isReplayComplete: boolean;
  /** Events received during replay, used to determine unanswered requests. */
  historicalEvents: HistoricalEvent[];
  /** Contents to display in the event stream (cumulative from all requests). */
  displayedContents: Content[];
}

/**
 * Initial state for the simulation store.
 * Starts in "live mode" (isReplayComplete = true) for backward compatibility.
 * When subscribing to a session with history, explicitly call startReplay().
 */
const initialState: SimulationState = {
  currentRequest: null,
  currentTurnId: null,
  requestQueue: [],
  selectedTool: null,
  isReplayComplete: true, // Start in live mode; call startReplay() to enter replay mode
  historicalEvents: [],
  displayedContents: [],
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

    /** Contents to display in the event stream (cumulative from all requests). */
    contents: computed(() => store.displayedContents()),

    /** System instruction from the current request, if present. */
    systemInstruction: computed(() => store.currentRequest()?.systemInstruction),
  })),

  // Methods (mutations and actions)
  withMethods((store) => ({
    /**
     * Handle incoming request from stream.
     * During replay: records the request for later processing.
     * After replay: queue if busy, set current if idle (FR-024).
     *
     * Always updates displayedContents with the request's contents for display.
     *
     * @param request - The incoming LLM request
     * @param turnId - The turn ID from the session event
     */
    receiveRequest(request: GenerateContentRequest, turnId: string): void {
      // Always update displayed contents (request.contents is the conversation history)
      const newContents = request.contents;

      if (!store.isReplayComplete()) {
        // During replay - record the event and update display
        patchState(store, {
          historicalEvents: [...store.historicalEvents(), { turnId, type: 'request', request }],
          displayedContents: newContents,
        });
        return;
      }

      // Live mode - normal queuing behavior + update display
      if (store.currentRequest() === null) {
        // Idle - set as current request
        patchState(store, {
          currentRequest: request,
          currentTurnId: turnId,
          displayedContents: newContents,
        });
      } else {
        // Busy - add to queue (don't update display until it becomes current)
        patchState(store, {
          requestQueue: [...store.requestQueue(), { request, turnId }],
        });
      }
    },

    /**
     * Handle incoming response from stream (during replay).
     * Marks the corresponding request as answered.
     *
     * @param turnId - The turn ID of the response
     */
    receiveResponse(turnId: string): void {
      if (store.isReplayComplete()) {
        // Live mode - responses come from user submissions, not stream
        return;
      }

      // During replay - record that this turn has a response
      patchState(store, {
        historicalEvents: [...store.historicalEvents(), { turnId, type: 'response' }],
      });
    },

    /**
     * Enter replay mode to handle historical events.
     * Called when subscribing to a session that may have history.
     */
    startReplay(): void {
      patchState(store, {
        isReplayComplete: false,
        historicalEvents: [],
      });
    },

    /**
     * Mark history replay as complete and queue unanswered requests.
     * Called when the history_complete marker is received from the server.
     */
    completeReplay(): void {
      const events = store.historicalEvents();

      // Find turn IDs that have responses
      const answeredTurnIds = new Set(
        events.filter((e) => e.type === 'response').map((e) => e.turnId),
      );

      // Find requests without responses (unanswered)
      const unansweredRequests = events
        .filter(
          (e): e is HistoricalEvent & { type: 'request'; request: GenerateContentRequest } =>
            e.type === 'request' && e.request !== undefined && !answeredTurnIds.has(e.turnId),
        )
        .map((e) => ({ request: e.request, turnId: e.turnId }));

      // Set first unanswered as current, rest as queue
      const [first, ...rest] = unansweredRequests;

      patchState(store, {
        isReplayComplete: true,
        historicalEvents: [], // Clear - no longer needed
        currentRequest: first?.request ?? null,
        currentTurnId: first?.turnId ?? null,
        requestQueue: rest,
      });
    },

    /**
     * Advance to next request after user submits response.
     * Clears current request and promotes first queued request (FIFO).
     * Also clears any tool selection and updates displayed contents.
     */
    advanceQueue(): void {
      const [next, ...rest] = store.requestQueue();
      const stateUpdate: Partial<SimulationState> = {
        currentRequest: next?.request ?? null,
        currentTurnId: next?.turnId ?? null,
        requestQueue: rest,
        selectedTool: null, // Clear selection when advancing
      };

      // Update displayed contents if there's a next request
      if (next) {
        stateUpdate.displayedContents = next.request.contents;
      }

      patchState(store, stateUpdate);
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
