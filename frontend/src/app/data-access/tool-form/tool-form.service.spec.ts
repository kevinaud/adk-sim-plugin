/**
 * @fileoverview Unit tests for ToolFormService.
 *
 * Tests cover the three parameter scenarios:
 * 1. parametersJsonSchema field present - use directly
 * 2. parameters field present - convert via genaiSchemaToJsonSchema
 * 3. No parameters - return empty object schema
 *
 * @see mddocs/frontend/frontend-tdd.md#toolformservice-schema-conversion
 */

import { TestBed } from '@angular/core/testing';
import { Type as GenaiType } from '@google/genai';
import type { FunctionDeclaration } from '@adk-sim/converters';

import { ToolFormService } from './tool-form.service';
import type { ToolFormConfig } from './tool-form.types';

describe('ToolFormService', () => {
  let service: ToolFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ToolFormService],
    });
    service = TestBed.inject(ToolFormService);
  });

  describe('service initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should be providedIn root', () => {
      // Verify service can be injected from root
      const rootService = TestBed.inject(ToolFormService);
      expect(rootService).toBe(service);
    });
  });

  describe('createFormConfig', () => {
    describe('with parametersJsonSchema field', () => {
      it('should use parametersJsonSchema directly without conversion', () => {
        const jsonSchema = {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'integer', minimum: 1 },
          },
          required: ['query'],
        };

        const tool: FunctionDeclaration = {
          name: 'search',
          description: 'Search for items',
          parametersJsonSchema: jsonSchema,
        };

        const config = service.createFormConfig(tool);

        expect(config.schema).toEqual(jsonSchema);
        expect(config.toolName).toBe('search');
        expect(config.toolDescription).toBe('Search for items');
      });

      it('should preserve complex nested JSON Schema', () => {
        const complexSchema = {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
              },
              required: ['name'],
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
            },
          },
        };

        const tool: FunctionDeclaration = {
          name: 'createUser',
          description: 'Create a new user',
          parametersJsonSchema: complexSchema,
        };

        const config = service.createFormConfig(tool);

        expect(config.schema).toEqual(complexSchema);
      });
    });

    describe('with parameters field (genai Schema)', () => {
      it('should convert parameters to JSON Schema', () => {
        const tool: FunctionDeclaration = {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: GenaiType.OBJECT,
            properties: {
              location: {
                type: GenaiType.STRING,
                description: 'The city name',
              },
              units: {
                type: GenaiType.STRING,
                enum: ['celsius', 'fahrenheit'],
              },
            },
            required: ['location'],
          },
        };

        const config = service.createFormConfig(tool);

        expect(config.schema.type).toBe('object');
        expect(config.schema.properties).toBeDefined();
        expect(config.schema.properties!['location']).toEqual({
          type: 'string',
          description: 'The city name',
        });
        expect(config.schema.properties!['units']).toEqual({
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
        });
        expect(config.schema.required).toEqual(['location']);
        expect(config.toolName).toBe('get_weather');
        expect(config.toolDescription).toBe('Get current weather for a location');
      });

      it('should convert numeric constraints from string to number', () => {
        const tool: FunctionDeclaration = {
          name: 'list_items',
          description: 'List items with pagination',
          parameters: {
            type: GenaiType.OBJECT,
            properties: {
              items: {
                type: GenaiType.ARRAY,
                items: { type: GenaiType.STRING },
                minItems: '1',
                maxItems: '100',
              },
              query: {
                type: GenaiType.STRING,
                minLength: '3',
                maxLength: '256',
              },
            },
          },
        };

        const config = service.createFormConfig(tool);

        const itemsSchema = config.schema.properties?.['items'];
        expect(itemsSchema).toBeDefined();
        expect(itemsSchema?.minItems).toBe(1);
        expect(itemsSchema?.maxItems).toBe(100);
        expect(typeof itemsSchema?.minItems).toBe('number');

        const querySchema = config.schema.properties?.['query'];
        expect(querySchema).toBeDefined();
        expect(querySchema?.minLength).toBe(3);
        expect(querySchema?.maxLength).toBe(256);
      });

      it('should handle nested object properties', () => {
        const tool: FunctionDeclaration = {
          name: 'send_message',
          description: 'Send a message to a user',
          parameters: {
            type: GenaiType.OBJECT,
            properties: {
              recipient: {
                type: GenaiType.OBJECT,
                properties: {
                  id: { type: GenaiType.INTEGER },
                  name: { type: GenaiType.STRING },
                },
                required: ['id'],
              },
              message: { type: GenaiType.STRING },
            },
            required: ['recipient', 'message'],
          },
        };

        const config = service.createFormConfig(tool);

        expect(config.schema.properties!['recipient']).toEqual({
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
          },
          required: ['id'],
        });
      });

      it('should handle nullable fields', () => {
        const tool: FunctionDeclaration = {
          name: 'update_profile',
          description: 'Update user profile',
          parameters: {
            type: GenaiType.OBJECT,
            properties: {
              nickname: {
                type: GenaiType.STRING,
                nullable: true,
                description: 'Optional nickname',
              },
            },
          },
        };

        const config = service.createFormConfig(tool);

        const nicknameSchema = config.schema.properties?.['nickname'];
        expect(nicknameSchema).toBeDefined();
        expect(nicknameSchema?.oneOf).toBeDefined();
        expect(nicknameSchema?.oneOf).toContainEqual({ type: 'null' });
      });
    });

    describe('with no parameters', () => {
      it('should return empty object schema when no parameters field', () => {
        const tool: FunctionDeclaration = {
          name: 'get_time',
          description: 'Get current time',
        };

        const config = service.createFormConfig(tool);

        expect(config.schema).toEqual({
          type: 'object',
          properties: {},
        });
        expect(config.toolName).toBe('get_time');
        expect(config.toolDescription).toBe('Get current time');
      });

      it('should return empty object schema when parameters is not set', () => {
        // Create a tool without the parameters property
        const tool = {
          name: 'ping',
          description: 'Ping the server',
        } as FunctionDeclaration;

        const config = service.createFormConfig(tool);

        expect(config.schema).toEqual({
          type: 'object',
          properties: {},
        });
      });
    });

    describe('UI schema generation', () => {
      it('should generate UI schema for simple properties', () => {
        const tool: FunctionDeclaration = {
          name: 'test_tool',
          description: 'Test tool',
          parametersJsonSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'integer' },
            },
          },
        };

        const config = service.createFormConfig(tool);

        expect(config.uischema).toBeDefined();
        expect(config.uischema.type).toBeDefined();
      });

      it('should generate UI schema for empty object', () => {
        const tool: FunctionDeclaration = {
          name: 'no_params',
          description: 'No parameters',
        };

        const config = service.createFormConfig(tool);

        expect(config.uischema).toBeDefined();
      });
    });

    describe('tool metadata', () => {
      it('should extract tool name', () => {
        const tool: FunctionDeclaration = {
          name: 'my_tool_name',
          description: 'Description',
        };

        const config = service.createFormConfig(tool);

        expect(config.toolName).toBe('my_tool_name');
      });

      it('should extract tool description', () => {
        const tool: FunctionDeclaration = {
          name: 'tool',
          description: 'This is a detailed description of the tool',
        };

        const config = service.createFormConfig(tool);

        expect(config.toolDescription).toBe('This is a detailed description of the tool');
      });

      it('should handle missing name gracefully', () => {
        const tool: FunctionDeclaration = {
          description: 'A tool without a name',
        } as FunctionDeclaration;

        const config = service.createFormConfig(tool);

        expect(config.toolName).toBe('');
      });

      it('should handle missing description gracefully', () => {
        const tool: FunctionDeclaration = {
          name: 'unnamed_tool',
        } as FunctionDeclaration;

        const config = service.createFormConfig(tool);

        expect(config.toolDescription).toBe('');
      });
    });

    describe('parametersJsonSchema priority over parameters', () => {
      it('should prefer parametersJsonSchema when both are present', () => {
        const jsonSchema = {
          type: 'object',
          properties: {
            fromJsonSchema: { type: 'string' },
          },
        };

        const tool: FunctionDeclaration = {
          name: 'dual_params',
          description: 'Tool with both parameter types',
          parametersJsonSchema: jsonSchema,
          parameters: {
            type: GenaiType.OBJECT,
            properties: {
              fromParameters: { type: GenaiType.STRING },
            },
          },
        };

        const config = service.createFormConfig(tool);

        // Should use parametersJsonSchema, not parameters
        expect(config.schema.properties).toHaveProperty('fromJsonSchema');
        expect(config.schema.properties).not.toHaveProperty('fromParameters');
      });
    });

    describe('return type validation', () => {
      it('should return a valid ToolFormConfig object', () => {
        const tool: FunctionDeclaration = {
          name: 'test',
          description: 'Test tool',
        };

        const config: ToolFormConfig = service.createFormConfig(tool);

        // Verify all required properties exist
        expect(config).toHaveProperty('schema');
        expect(config).toHaveProperty('uischema');
        expect(config).toHaveProperty('toolName');
        expect(config).toHaveProperty('toolDescription');

        // Verify types
        expect(typeof config.schema).toBe('object');
        expect(typeof config.uischema).toBe('object');
        expect(typeof config.toolName).toBe('string');
        expect(typeof config.toolDescription).toBe('string');
      });
    });
  });
});
