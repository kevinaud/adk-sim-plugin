/**
 * @fileoverview gRPC-Web implementation of SessionGateway using Connect-ES.
 *
 * This is the real adapter for communicating with the backend via gRPC-Web.
 * Uses Connect-ES v2 with createGrpcWebTransport for the transport layer.
 *
 * @see mddocs/frontend/frontend-tdd.md#grpc-gateway-adapter
 * @see mddocs/frontend/research/prototype-findings.md#grpc-web-streaming-with-connect-es
 */

import { SimulatorService } from '@adk-sim/protos';
import { Injectable } from '@angular/core';
import type { Client, Transport } from '@connectrpc/connect';
import { createClient } from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';

import { ENVIRONMENT } from '../../../environments/environment';
import type { Session } from './session.gateway';
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
 * @example
 * ```typescript
 * // Provide in app config for production
 * providers: [
 *   { provide: SessionGateway, useClass: GrpcSessionGateway }
 * ]
 * ```
 */
@Injectable()
export class GrpcSessionGateway extends SessionGateway {
  private readonly transport: Transport;
  private readonly client: Client<typeof SimulatorService>;

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
}
