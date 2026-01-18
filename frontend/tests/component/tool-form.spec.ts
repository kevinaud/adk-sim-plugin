/**
 * @fileoverview Playwright Component tests for ToolFormComponent.
 *
 * Tests the ToolFormComponent which uses JSONForms for dynamic form generation.
 * These tests verify rendering, user interaction, and visual appearance.
 *
 * ## JSONForms Integration
 *
 * JSONForms requires special Vite/Rollup configuration to work with Playwright CT:
 * - `define: { global: {} }` - Polyfills Node.js global for Ajv
 * - Pre-importing in playwright/index.ts to prevent tree-shaking
 *
 * @see mddocs/frontend/research/deep-research/json-forms-ct-testing-findings-2.md
 * @see frontend/src/app/ui/control-panel/tool-form/tool-form.component.ts
 */

import { generateDefaultUISchema, type JsonSchema7 } from '@jsonforms/core';
import { create } from '@bufbuild/protobuf';
import { expect, test } from './fixtures/theme.fixture';

import { FunctionDeclarationSchema, SchemaSchema, Type } from '@adk-sim/protos';
import { genaiSchemaToJsonSchema, protoSchemaToGenaiSchema } from '@adk-sim/converters';
import { ToolFormComponent } from '../../src/app/ui/control-panel/tool-form/tool-form.component';
import type { ToolFormConfig } from '../../src/app/ui/control-panel/tool-form/tool-form.types';

/**
 * Creates a test configuration for the tool form.
 */
function createTestConfig(overrides?: Partial<ToolFormConfig>): ToolFormConfig {
  const base: ToolFormConfig = {
    toolName: 'get_weather',
    toolDescription: 'Retrieves current weather information for a specified location.',
    schema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g., San Francisco, CA',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'Temperature unit',
        },
      },
      required: ['location'],
    } as JsonSchema7,
    uischema: {
      type: 'VerticalLayout',
      elements: [
        { type: 'Control', scope: '#/properties/location' },
        { type: 'Control', scope: '#/properties/unit' },
      ],
    },
  };

  if (overrides) {
    return { ...base, ...overrides };
  }
  return base;
}

test.describe('ToolFormComponent', () => {
  test.describe('renders correctly', () => {
    test('displays field descriptions when valid (even unfocused)', async ({ mount }) => {
      const config = createTestConfig();

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();

      // Fill the location field to make it valid (removes error state)
      const locationInput = component.locator('input').first();
      await locationInput.fill('San Francisco, CA');

      // Click elsewhere to unfocus
      await component.getByTestId('form-header').click();
      await component.page().waitForTimeout(200);

      // Check if description is visible even when unfocused
      const descriptionText = component.getByText('The city and state');
      await expect(descriptionText).toBeVisible();
    });

    test('displays tool name in header', async ({ mount }) => {
      const config = createTestConfig();

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toContainText('Execute: get_weather');
    });

    test('displays tool description when provided', async ({ mount }) => {
      const config = createTestConfig();

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-description')).toContainText(
        'Retrieves current weather information',
      );
    });

    test('displays back link', async ({ mount }) => {
      const config = createTestConfig();

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('back-link')).toContainText('BACK TO ACTIONS');
    });

    test('displays execute button', async ({ mount }) => {
      const config = createTestConfig();

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('execute-button')).toContainText('EXECUTE');
    });
  });

  test.describe('visual regression', () => {
    /**
     * Note: JSONForms Angular Material renders enum fields as autocomplete text inputs,
     * not mat-select dropdowns. Tests interact with inputs directly.
     *
     * Known limitations:
     * 1. Field descriptions from schema are not displayed by default - requires
     *    UI schema `showUnfocusedDescription: true` or custom renderers.
     * 2. Checkbox clicks don't visually persist in screenshots due to Angular
     *    Material change detection timing in Playwright CT environment.
     * 3. `additionalProperties` objects render as empty bordered sections without
     *    visible UI to add key-value pairs.
     */

    test('default form - empty state', async ({ mount }) => {
      const config = createTestConfig();

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-default.png');
    });

    test('default form - filled state', async ({ mount }) => {
      const config = createTestConfig();

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();

      // Fill in the fields (JSONForms renders enum as autocomplete input)
      const inputs = component.locator('input');
      await inputs.nth(0).fill('San Francisco, CA');
      await inputs.nth(1).fill('fahrenheit');

      // Click elsewhere to close autocomplete and unfocus
      await component.getByTestId('form-header').click();
      await component.page().waitForTimeout(200);

      await expect(component).toHaveScreenshot('tool-form-filled.png');
    });

    test('primitives - all types filled', async ({ mount }) => {
      const config: ToolFormConfig = {
        toolName: 'demo_primitives',
        toolDescription: 'Demonstrates all JSON Schema primitive types.',
        schema: {
          type: 'object',
          properties: {
            text_field: { type: 'string', description: 'A text string value' },
            number_field: { type: 'number', description: 'A decimal number value' },
            integer_field: { type: 'integer', description: 'A whole number value' },
            boolean_field: { type: 'boolean', description: 'A true/false value' },
          },
        } as JsonSchema7,
        uischema: {
          type: 'VerticalLayout',
          elements: [
            { type: 'Control', scope: '#/properties/text_field' },
            { type: 'Control', scope: '#/properties/number_field' },
            { type: 'Control', scope: '#/properties/integer_field' },
            { type: 'Control', scope: '#/properties/boolean_field' },
          ],
        },
      };

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();

      // Fill all fields
      const inputs = component.locator('input');
      await inputs.nth(0).fill('Hello World');
      await inputs.nth(1).fill('3.14159');
      await inputs.nth(2).fill('42');

      // Check the boolean checkbox
      await component.locator('mat-checkbox').click();

      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-primitives-filled.png');
    });

    test('enum - with value selected', async ({ mount }) => {
      const config: ToolFormConfig = {
        toolName: 'select_model',
        toolDescription: 'Select an AI model to use.',
        schema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'],
            },
            temperature: {
              type: 'number',
              minimum: 0,
              maximum: 2,
            },
          },
          required: ['model'],
        } as JsonSchema7,
        uischema: {
          type: 'VerticalLayout',
          elements: [
            { type: 'Control', scope: '#/properties/model' },
            { type: 'Control', scope: '#/properties/temperature' },
          ],
        },
      };

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();

      // Fill enum as text (JSONForms renders as autocomplete)
      const inputs = component.locator('input');
      await inputs.nth(0).fill('claude-3-opus');
      await inputs.nth(1).fill('0.7');

      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-enum-selected.png');
    });

    test('array - empty state', async ({ mount }) => {
      const config: ToolFormConfig = {
        toolName: 'search_files',
        toolDescription: 'Search files matching patterns.',
        schema: {
          type: 'object',
          properties: {
            patterns: {
              type: 'array',
              items: { type: 'string' },
            },
            exclude: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['patterns'],
        } as JsonSchema7,
        uischema: {
          type: 'VerticalLayout',
          elements: [
            { type: 'Control', scope: '#/properties/patterns' },
            { type: 'Control', scope: '#/properties/exclude' },
          ],
        },
      };

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-arrays-empty.png');
    });

    test('nested object - filled', async ({ mount }) => {
      const config: ToolFormConfig = {
        toolName: 'create_user',
        toolDescription: 'Create a new user with address.',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                zipcode: { type: 'string' },
              },
            },
          },
          required: ['name'],
        } as JsonSchema7,
        uischema: {
          type: 'VerticalLayout',
          elements: [
            { type: 'Control', scope: '#/properties/name' },
            { type: 'Control', scope: '#/properties/address' },
          ],
        },
      };

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();

      // Fill all fields
      const inputs = component.locator('input');
      await inputs.nth(0).fill('John Doe');
      await inputs.nth(1).fill('123 Main Street');
      await inputs.nth(2).fill('San Francisco');
      await inputs.nth(3).fill('94102');

      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-nested-filled.png');
    });

    test('no tool description', async ({ mount }) => {
      const config: ToolFormConfig = {
        toolName: 'simple_ping',
        toolDescription: '',
        schema: {
          type: 'object',
          properties: {
            host: { type: 'string' },
          },
        } as JsonSchema7,
        uischema: {
          type: 'VerticalLayout',
          elements: [{ type: 'Control', scope: '#/properties/host' }],
        },
      };

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();
      await expect(component.getByTestId('form-description')).not.toBeVisible();

      await component.locator('input').fill('192.168.1.1');
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-no-description.png');
    });

    test('long tool name', async ({ mount }) => {
      const config: ToolFormConfig = {
        toolName: 'very_long_tool_name_that_tests_header_wrapping_behavior',
        toolDescription: 'Tests how the component handles long tool names in the header.',
        schema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        } as JsonSchema7,
        uischema: {
          type: 'VerticalLayout',
          elements: [{ type: 'Control', scope: '#/properties/input' }],
        },
      };

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-long-name.png');
    });

    test('many fields - partially filled', async ({ mount }) => {
      const config: ToolFormConfig = {
        toolName: 'database_query',
        toolDescription: 'Execute a database query with various options.',
        schema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            database: { type: 'string' },
            timeout: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            read_only: { type: 'boolean' },
            format: {
              type: 'string',
              enum: ['json', 'csv', 'table'],
            },
          },
          required: ['query', 'database'],
        } as JsonSchema7,
        uischema: {
          type: 'VerticalLayout',
          elements: [
            { type: 'Control', scope: '#/properties/query' },
            { type: 'Control', scope: '#/properties/database' },
            { type: 'Control', scope: '#/properties/timeout' },
            { type: 'Control', scope: '#/properties/limit' },
            { type: 'Control', scope: '#/properties/offset' },
            { type: 'Control', scope: '#/properties/read_only' },
            { type: 'Control', scope: '#/properties/format' },
          ],
        },
      };

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();

      // Fill required fields - use nth() on all inputs
      const inputs = component.locator('input:not([type="checkbox"])');
      await inputs.nth(0).fill('SELECT * FROM users');
      await inputs.nth(1).fill('production_db');

      // Check read_only
      await component.locator('mat-checkbox').click();

      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-many-fields-filled.png');
    });

    test('http request - complete example', async ({ mount }) => {
      const config: ToolFormConfig = {
        toolName: 'http_request',
        toolDescription: 'Make an HTTP request to an external API.',
        schema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            },
            headers: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
            body: { type: 'string' },
            timeout: { type: 'integer', minimum: 1, maximum: 300 },
            follow_redirects: { type: 'boolean' },
          },
          required: ['url', 'method'],
        } as JsonSchema7,
        uischema: {
          type: 'VerticalLayout',
          elements: [
            { type: 'Control', scope: '#/properties/url' },
            { type: 'Control', scope: '#/properties/method' },
            { type: 'Control', scope: '#/properties/headers' },
            { type: 'Control', scope: '#/properties/body' },
            { type: 'Control', scope: '#/properties/timeout' },
            { type: 'Control', scope: '#/properties/follow_redirects' },
          ],
        },
      };

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();

      // Fill the form fields
      const inputs = component.locator('input:not([type="checkbox"])');
      await inputs.nth(0).fill('https://api.example.com/v1/users'); // url
      await inputs.nth(1).fill('POST'); // method

      // Note: Headers (additionalProperties object) doesn't have a simple input
      // It renders as an expandable section for dynamic key-value pairs

      await inputs.nth(2).fill('{"name": "John"}'); // body
      await inputs.nth(3).fill('30'); // timeout

      // Note: Checkbox clicks don't visually persist in Playwright CT screenshots
      // due to Angular Material change detection timing. This is a known limitation.
      // The form layout and field types are still validated by this test.

      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-http-filled.png');
    });

    test('array of objects - with items', async ({ mount }) => {
      const config: ToolFormConfig = {
        toolName: 'send_emails',
        toolDescription: 'Send emails to multiple recipients.',
        schema: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            recipients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                },
                required: ['email'],
              },
            },
          },
          required: ['subject', 'recipients'],
        } as JsonSchema7,
        uischema: {
          type: 'VerticalLayout',
          elements: [
            { type: 'Control', scope: '#/properties/subject' },
            { type: 'Control', scope: '#/properties/recipients' },
          ],
        },
      };

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();

      // Fill the subject
      await component.locator('input').first().fill('Weekly Update');

      // Add recipients by clicking the add button
      const addButton = component
        .locator('button')
        .filter({ hasText: /add|plus|\+/i })
        .first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await component.page().waitForTimeout(100);
        await addButton.click();
        await component.page().waitForTimeout(100);

        // Fill in the recipient data (table rows)
        const nameInputs = component
          .locator('input')
          .filter({ has: component.page().locator('..').filter({ hasText: /name/i }) });
        const allInputs = component.locator('input');

        // Fill first recipient row
        await allInputs.nth(1).fill('Alice Smith');
        await allInputs.nth(2).fill('alice@example.com');

        // Fill second recipient row
        await allInputs.nth(3).fill('Bob Jones');
        await allInputs.nth(4).fill('bob@example.com');
      }

      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-array-objects.png');
    });

    test('validation errors - required fields', async ({ mount }) => {
      const config: ToolFormConfig = {
        toolName: 'validated_form',
        toolDescription: 'Form with required fields.',
        schema: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            username: { type: 'string' },
          },
          required: ['email', 'username'],
        } as JsonSchema7,
        uischema: {
          type: 'VerticalLayout',
          elements: [
            { type: 'Control', scope: '#/properties/email' },
            { type: 'Control', scope: '#/properties/username' },
          ],
        },
      };

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();
      // Don't fill anything - just show required field errors
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-validation-errors.png');
    });

    /**
     * Real store_state_tool from FOMC research agent SessionEvent.
     *
     * This creates the exact proto FunctionDeclaration as received from the gRPC stream
     * and passes it through the same ToolFormService converter the app uses.
     *
     * From SessionEvent JSON:
     * ```json
     * {
     *   "name": "store_state_tool",
     *   "description": "Stores new state values in the ToolContext.\n\nArgs:\n  state: A dict of new state values.\n  tool_context: ToolContext object.\n\nReturns:\n  A dict with \"status\" and (optional) \"error_message\" keys.\n",
     *   "parameters": {
     *     "type": "OBJECT",
     *     "properties": { "state": { "type": "OBJECT" } },
     *     "required": ["state"]
     *   }
     * }
     * ```
     */
    function createStoreStateToolConfig(): ToolFormConfig {
      // Create the proto FunctionDeclaration exactly as it comes from the gRPC stream
      const storeStateTool = create(FunctionDeclarationSchema, {
        name: 'store_state_tool',
        description:
          'Stores new state values in the ToolContext.\n\n' +
          'Args:\n' +
          '  state: A dict of new state values.\n' +
          '  tool_context: ToolContext object.\n\n' +
          'Returns:\n' +
          '  A dict with "status" and (optional) "error_message" keys.\n',
        parameters: create(SchemaSchema, {
          type: Type.OBJECT,
          properties: {
            // state is an open object (Dict[str, Any]) - type: OBJECT with no defined properties
            state: create(SchemaSchema, { type: Type.OBJECT }),
          },
          required: ['state'],
        }),
      });

      // Convert proto Schema -> genai Schema -> JSON Schema (same pipeline as ToolFormService)
      const genaiSchema = protoSchemaToGenaiSchema(storeStateTool.parameters!);
      const jsonSchema = genaiSchemaToJsonSchema(genaiSchema) as JsonSchema7;

      return {
        toolName: storeStateTool.name ?? '',
        toolDescription: storeStateTool.description ?? '',
        schema: jsonSchema,
        uischema: generateDefaultUISchema(jsonSchema),
      };
    }

    test('open object - empty state (store_state_tool)', async ({ mount }) => {
      // This tests the AnyObjectRenderer custom renderer for open objects
      // Reproduces the real store_state_tool from FOMC research agent
      const config = createStoreStateToolConfig();

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-form-open-object-empty.png');
    });

    test('open object - with JSON filled (store_state_tool)', async ({ mount }) => {
      // This tests the AnyObjectRenderer with JSON content
      // Example: storing the user_requested_meeting_date as mentioned in the system instruction
      const config = createStoreStateToolConfig();

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();

      // Fill the JSON textarea with realistic data matching the FOMC use case
      const textarea = component.locator('textarea');
      await textarea.fill(JSON.stringify({ user_requested_meeting_date: '2025-03-19' }, null, 2));

      // Click elsewhere to unfocus
      await component.getByTestId('form-header').click();
      await component.page().waitForTimeout(200);

      await expect(component).toHaveScreenshot('tool-form-open-object-filled.png');
    });

    test('open object - invalid JSON error (store_state_tool)', async ({ mount }) => {
      // This tests the AnyObjectRenderer showing validation error
      const config = createStoreStateToolConfig();

      const component = await mount(ToolFormComponent, {
        props: { config },
      });

      await expect(component.getByTestId('form-header')).toBeVisible();

      // Fill with invalid JSON
      const textarea = component.locator('textarea');
      await textarea.fill('{ invalid json }');

      // Click elsewhere to trigger validation
      await component.getByTestId('form-header').click();
      await component.page().waitForTimeout(200);

      await expect(component).toHaveScreenshot('tool-form-open-object-invalid.png');
    });
  });
});
