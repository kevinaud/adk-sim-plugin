/**
 * Test Fixtures - Request protobuf messages
 *
 * Reusable request fixtures for testing converters and frontend integration.
 */

import type {
  GenerateContentRequest,
  Content as ProtoContent,
  Part as ProtoPart,
  Tool as ProtoTool,
  FunctionDeclaration as ProtoFunctionDeclaration,
  Schema as ProtoSchema,
  SafetySetting as ProtoSafetySetting,
  GenerationConfig as ProtoGenerationConfig,
} from '@adk-sim/protos';
import {
  Type as ProtoType,
  HarmCategory as ProtoHarmCategory,
  SafetySetting_HarmBlockThreshold as ProtoHarmBlockThreshold,
} from '@adk-sim/protos';

// ============================================================================
// Helper Functions
// ============================================================================

function createTextPart(text: string): ProtoPart {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data: { case: 'text', value: text },
    metadata: { case: undefined, value: undefined },
    thought: false,
    thoughtSignature: new Uint8Array(),
  } as ProtoPart;
}

function createContent(role: string, parts: ProtoPart[]): ProtoContent {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Content',
    role,
    parts,
  } as ProtoContent;
}

// ============================================================================
// Basic Request Fixture
// ============================================================================

/**
 * Minimal request with just model and simple text content.
 * Use for basic conversion testing.
 */
export const basicTextRequest: GenerateContentRequest = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentRequest',
  model: 'models/gemini-2.0-flash',
  contents: [createContent('user', [createTextPart('Hello, world!')])],
  tools: [],
  safetySettings: [],
  systemInstruction: undefined,
  generationConfig: undefined,
  toolConfig: undefined,
  cachedContent: undefined,
} as GenerateContentRequest;

// ============================================================================
// Full-Featured Request Fixture
// ============================================================================

function createProtoSchema(
  type: ProtoType,
  properties?: Record<string, ProtoSchema>,
  required?: string[],
  description?: string,
): ProtoSchema {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Schema',
    type,
    properties: properties ?? {},
    required: required ?? [],
    description: description ?? '',
    format: '',
    nullable: false,
    enum: [],
    maxItems: undefined,
    minItems: undefined,
    items: undefined,
    minimum: undefined,
    maximum: undefined,
    anyOf: [],
    example: undefined,
    title: '',
    default: undefined,
    pattern: undefined,
    minLength: undefined,
    maxLength: undefined,
    minProperties: undefined,
    maxProperties: undefined,
    propertyOrdering: [],
  } as unknown as ProtoSchema;
}

const weatherToolSchema = createProtoSchema(
  ProtoType.OBJECT,
  {
    location: createProtoSchema(ProtoType.STRING, undefined, undefined, 'City name'),
  },
  ['location'],
  'Parameters for weather lookup',
);

const weatherFunction: ProtoFunctionDeclaration = {
  $typeName: 'google.ai.generativelanguage.v1beta.FunctionDeclaration',
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: weatherToolSchema,
} as ProtoFunctionDeclaration;

const weatherTool: ProtoTool = {
  $typeName: 'google.ai.generativelanguage.v1beta.Tool',
  functionDeclarations: [weatherFunction],
  codeExecution: undefined,
  googleSearch: undefined,
  googleSearchRetrieval: undefined,
} as ProtoTool;

const safetySettings: ProtoSafetySetting[] = [
  {
    $typeName: 'google.ai.generativelanguage.v1beta.SafetySetting',
    category: ProtoHarmCategory.HARASSMENT,
    threshold: ProtoHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  } as ProtoSafetySetting,
  {
    $typeName: 'google.ai.generativelanguage.v1beta.SafetySetting',
    category: ProtoHarmCategory.HATE_SPEECH,
    threshold: ProtoHarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  } as ProtoSafetySetting,
];

const generationConfig: ProtoGenerationConfig = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerationConfig',
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 1024,
  stopSequences: ['END'],
  responseMimeType: 'text/plain',
  candidateCount: 1,
  seed: 42,
  presencePenalty: 0.1,
  frequencyPenalty: 0.2,
  responseLogprobs: false,
  logprobs: undefined,
  responseModalities: [],
  responseSchema: undefined,
  routingConfig: undefined,
  speechConfig: undefined,
  thinkingConfig: undefined,
  mediaResolution: undefined,
  enableEnhancedCivicAnswers: false,
} as ProtoGenerationConfig;

const systemInstruction: ProtoContent = createContent('system', [
  createTextPart('You are a helpful weather assistant.'),
]);

/**
 * Request with all fields populated: tools, safety settings, generation config, system instruction.
 * Use for comprehensive conversion testing and round-trip tests.
 */
export const fullFeaturedRequest: GenerateContentRequest = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentRequest',
  model: 'models/gemini-2.0-flash',
  contents: [
    createContent('user', [createTextPart('What is the weather in San Francisco?')]),
    createContent('model', [createTextPart('Let me check that for you.')]),
    createContent('user', [createTextPart('Thanks!')]),
  ],
  tools: [weatherTool],
  safetySettings,
  systemInstruction,
  generationConfig,
  toolConfig: undefined,
  cachedContent: undefined,
} as GenerateContentRequest;

// ============================================================================
// Edge Case Fixtures
// ============================================================================

/**
 * Request with empty contents array.
 * Tests handling of empty/minimal data.
 */
export const emptyContentsRequest: GenerateContentRequest = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentRequest',
  model: 'models/gemini-2.0-flash',
  contents: [],
  tools: [],
  safetySettings: [],
  systemInstruction: undefined,
  generationConfig: undefined,
  toolConfig: undefined,
  cachedContent: undefined,
} as GenerateContentRequest;

/**
 * Request with multi-part content (multiple text parts in one message).
 */
export const multiPartRequest: GenerateContentRequest = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentRequest',
  model: 'models/gemini-2.0-flash',
  contents: [
    createContent('user', [
      createTextPart('First part.'),
      createTextPart('Second part.'),
      createTextPart('Third part.'),
    ]),
  ],
  tools: [],
  safetySettings: [],
  systemInstruction: undefined,
  generationConfig: undefined,
  toolConfig: undefined,
  cachedContent: undefined,
} as GenerateContentRequest;
