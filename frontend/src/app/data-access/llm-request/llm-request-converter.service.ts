/**
 * @fileoverview Angular service wrapper for ADK converter functions.
 *
 * Provides DI-friendly access to proto↔LlmRequest conversions
 * and response construction helpers. This service delegates to
 * the pure functions in @adk-sim/converters package.
 *
 * @see mddocs/frontend/frontend-tdd.md#llmrequestconverter
 */

import {
  createFunctionResultResponse,
  createStructuredResponse,
  createTextResponse,
  createToolInvocationResponse,
  type LlmRequest,
  protoToLlmRequest,
} from '@adk-sim/converters';
import type { GenerateContentRequest, GenerateContentResponse } from '@adk-sim/protos';
import { Injectable } from '@angular/core';

/**
 * Angular service wrapper for ADK converter functions.
 *
 * Provides DI-friendly access to proto↔LlmRequest conversions
 * and response construction helpers.
 *
 * @example
 * ```typescript
 * // In a component or service
 * private readonly converter = inject(LlmRequestConverterService);
 *
 * // Convert proto to LlmRequest
 * const llmRequest = this.converter.protoToLlmRequest(proto);
 *
 * // Create response protos
 * const textResponse = this.converter.createTextResponse('Hello!');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class LlmRequestConverterService {
  /**
   * Convert a GenerateContentRequest proto to ADK LlmRequest format.
   *
   * @param proto - The GenerateContentRequest proto to convert
   * @returns The converted LlmRequest
   */
  protoToLlmRequest(proto: GenerateContentRequest): LlmRequest {
    return protoToLlmRequest(proto);
  }

  /**
   * Create a text-only response proto.
   * Used for final answers from the model.
   *
   * @param text - The text content of the response
   * @returns A GenerateContentResponse proto with the text wrapped in candidates[0].content
   */
  createTextResponse(text: string): GenerateContentResponse {
    return createTextResponse(text);
  }

  /**
   * Create a function call / tool invocation response proto.
   * Used when the model wants to invoke a tool.
   *
   * @param toolName - The name of the tool/function to call
   * @param args - The arguments to pass to the function
   * @returns A GenerateContentResponse proto with a function call part
   */
  createToolInvocationResponse(
    toolName: string,
    args: Record<string, unknown>,
  ): GenerateContentResponse {
    return createToolInvocationResponse(toolName, args);
  }

  /**
   * Create a function result response proto.
   * Used to provide the return value from a simulated tool execution.
   *
   * @param toolName - The name of the tool/function that was called
   * @param result - The result from the function execution
   * @returns A GenerateContentResponse proto with a function response part
   */
  createFunctionResultResponse(toolName: string, result: unknown): GenerateContentResponse {
    return createFunctionResultResponse(toolName, result);
  }

  /**
   * Create a structured JSON response proto.
   * Used for JSON schema responses where the content is structured data.
   *
   * @param data - The structured data to include in the response
   * @returns A GenerateContentResponse proto with the JSON stringified in a text part
   */
  createStructuredResponse(data: unknown): GenerateContentResponse {
    return createStructuredResponse(data);
  }
}
