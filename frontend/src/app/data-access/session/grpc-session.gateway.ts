/**
 * @fileoverview gRPC-Web implementation of SessionGateway using Connect-ES.
 *
 * This is the real adapter for communicating with the backend via gRPC-Web.
 * Uses Connect-ES v2 with createGrpcWebTransport for the transport layer.
 *
 * @see mddocs/frontend/frontend-tdd.md#grpc-gateway-adapter
 * @see mddocs/frontend/research/prototype-findings.md#grpc-web-streaming-with-connect-es
 */

import { SimulatorService, SubscribeRequestSchema } from '@adk-sim/protos';
import { Injectable } from '@angular/core';
import { create } from '@bufbuild/protobuf';
import type { Client, Transport } from '@connectrpc/connect';
import { createClient } from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';

import { ENVIRONMENT } from '../../../environments/environment';
import type { Session, SessionEvent } from './session.gateway';
import { SessionGateway } from './session.gateway';

/**
 * Resolves the base URL for the gRPC-Web transport.
 *
 * In production (empty grpcWebUrl), uses globalThis.location.origin for same-origin requests.
 * In development, uses the configured grpcWebUrl (e.g., 'http://localhost:8080').
 *
 * @returns The resolved base URL
 */
function resolveBaseUrl(): string {
  return ENVIRONMENT.grpcWebUrl || globalThis.location.origin;
}

/**
 * gRPC-Web implementation of SessionGateway using Connect-ES.
 *
 * This adapter provides the real backend communication for production use.
 * It connects to the SimulatorService via gRPC-Web protocol.
 *
 * The `providedIn: 'root'` with `useExisting: GrpcSessionGateway` makes this
 * the default implementation for SessionGateway across the application.
 *
 * @example
 * ```typescript
 * // Automatic registration via providedIn
 * // No manual provider configuration needed
 * ```
 */
@Injectable({ providedIn: 'root' })
export class GrpcSessionGateway extends SessionGateway {
  private readonly transport: Transport;
  private readonly client: Client<typeof SimulatorService>;
  private abortController: AbortController | null = null;

  constructor() {
    super();
    this.transport = createGrpcWebTransport({
      baseUrl: resolveBaseUrl(),
    });
    this.client = createClient(SimulatorService, this.transport);
  }

  /**
   * Lists all available simulation sessions from the backend.
   *
   * Makes a unary gRPC call to SimulatorService.ListSessions.
   *
   * @returns Promise resolving to array of sessions
   * @throws Error if the gRPC call fails
   */
  override async listSessions(): Promise<Session[]> {
    const response = await this.client.listSessions({});
    return response.sessions;
  }

  /**
   * Retrieves a specific session by ID.
   *
   * Since the backend doesn't have a GetSession RPC, this implementation
   * fetches all sessions and filters for the requested ID.
   *
   * @param sessionId - The unique identifier of the session
   * @returns Promise resolving to the session
   * @throws Error if session is not found
   */
  override async getSession(sessionId: string): Promise<Session> {
    const sessions = await this.listSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Subscribes to real-time events for a session.
   *
   * Uses an async generator to yield events from the gRPC server stream.
   * The subscription can be cancelled via `cancelSubscription()`.
   *
   * @param sessionId - The session to subscribe to
   * @returns AsyncIterable yielding SessionEvent objects
   */
  override async *subscribe(sessionId: string): AsyncIterable<SessionEvent> {
    // Cancel any existing subscription before starting a new one
    this.cancelSubscription();
    this.abortController = new AbortController();

    const request = create(SubscribeRequestSchema, {
      sessionId,
      clientId: crypto.randomUUID(),
    });

    try {
      for await (const response of this.client.subscribe(request, {
        signal: this.abortController.signal,
      })) {
        if (response.event) {
          yield response.event;
        }
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Cancels any active subscription.
   *
   * Aborts the current AbortController, causing the subscription stream
   * to terminate. Safe to call even if no subscription is active.
   */
  override cancelSubscription(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}
