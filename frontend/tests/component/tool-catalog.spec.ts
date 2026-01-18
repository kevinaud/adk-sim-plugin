/**
 * @fileoverview Playwright Component tests for ToolCatalogComponent.
 *
 * Tests the ToolCatalogComponent which displays available tools with
 * expandable parameter previews. Tests verify rendering, user interaction,
 * and visual appearance.
 *
 * @see mddocs/frontend/sprints/mocks/components/ToolCatalog_Default_default.png
 * @see frontend/src/app/ui/control-panel/tool-catalog/tool-catalog.component.ts
 */

import { expect, test } from './fixtures/theme.fixture';

import { ToolCatalogComponent } from '../../src/app/ui/control-panel/tool-catalog/tool-catalog.component';
import type { FunctionDeclaration, Schema } from '@adk-sim/protos';
import { Type } from '@adk-sim/protos';

/**
 * Creates a mock FunctionDeclaration for testing.
 */
function createMockTool(overrides?: Partial<FunctionDeclaration>): FunctionDeclaration {
  const defaultTool = {
    name: 'search_knowledge_base',
    description: 'Searches the internal knowledge base for documents matching the query.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The search query string.',
        } as Schema,
        limit: {
          type: Type.INTEGER,
          description: 'Max number of results.',
        } as Schema,
      },
      required: ['query'],
    } as Schema,
    behavior: 0,
  } as FunctionDeclaration;

  return { ...defaultTool, ...overrides };
}

/**
 * Creates a tool with parametersJsonSchema (JSON Schema format).
 */
function createJsonSchemaTool(name: string, description: string): FunctionDeclaration {
  return {
    name,
    description,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate.',
        },
      },
      required: ['expression'],
    },
    behavior: 0,
  } as FunctionDeclaration;
}

test.describe('ToolCatalogComponent', () => {
  test.describe('renders correctly', () => {
    test('displays tool name in header', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      await expect(component.getByTestId('tool-name')).toContainText('search_knowledge_base');
    });

    test('displays tool description', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      await expect(component.getByTestId('tool-description')).toContainText(
        'Searches the internal knowledge base'
      );
    });

    test('displays tools count in header', async ({ mount }) => {
      const tools = [
        createMockTool(),
        createMockTool({ name: 'calculator', description: 'Performs arithmetic.' }),
      ];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      await expect(component.getByTestId('catalog-header')).toContainText('Tools (2)');
    });

    test('displays empty state when no tools', async ({ mount }) => {
      const component = await mount(ToolCatalogComponent, {
        props: { tools: [] },
      });

      await expect(component.getByTestId('empty-state')).toBeVisible();
      await expect(component.getByTestId('empty-state')).toContainText('No tools available');
    });

    test('displays SELECT TOOL button', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      await expect(component.getByTestId('select-tool-button')).toContainText('SELECT TOOL');
    });

    test('SELECT TOOL button is disabled when no selection', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      await expect(component.getByTestId('select-tool-button')).toBeDisabled();
    });
  });

  test.describe('interaction', () => {
    test('clicking tool card selects it', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Click on the tool header (where the click handler is)
      const toolHeader = component.locator('.tool-header');
      await toolHeader.click();

      // Wait for Angular change detection
      await component.page().waitForTimeout(100);

      // Check that the tool card has selected class
      const toolCard = component.getByTestId('tool-card');
      await expect(toolCard).toHaveClass(/selected/);

      // Check that button is now enabled
      await expect(component.getByTestId('select-tool-button')).toBeEnabled();
    });

    test('clicking parameters toggle expands section', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Parameters should be collapsed by default
      await expect(component.getByTestId('parameters-list')).not.toBeVisible();

      // Click to expand
      await component.getByTestId('parameters-toggle').click();

      // Parameters should now be visible
      await expect(component.getByTestId('parameters-list')).toBeVisible();
    });

    test('displays parameters with type badges', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Expand parameters
      await component.getByTestId('parameters-toggle').click();

      // Check parameter items
      const parameterItems = component.getByTestId('parameter-item');
      await expect(parameterItems).toHaveCount(2);

      // Check type badges
      await expect(component.locator('.type-badge')).toHaveCount(2);
    });

    test('displays required indicator (asterisk) for required parameters', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Expand parameters
      await component.getByTestId('parameters-toggle').click();

      // Check for asterisk in required field name
      const parameterNames = component.locator('.parameter-name');
      await expect(parameterNames.first()).toContainText('query*:');
      await expect(parameterNames.nth(1)).toContainText('limit:'); // Not required
    });

    test('displays "* required" footer when required fields exist', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Expand parameters
      await component.getByTestId('parameters-toggle').click();

      // Check for required footer
      await expect(component.getByTestId('required-footer')).toContainText('* required');
    });
  });

  test.describe('visual regression', () => {
    test('empty state', async ({ mount }) => {
      const component = await mount(ToolCatalogComponent, {
        props: { tools: [] },
      });

      await expect(component.getByTestId('empty-state')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-catalog-empty.png');
    });

    test('single tool - parameters collapsed', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      await expect(component.getByTestId('tool-card')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-catalog-single-collapsed.png');
    });

    // TODO: Re-enable once snapshot baseline is updated - size mismatch between CI and local Docker
    test.skip('single tool - parameters expanded', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Expand parameters
      await component.getByTestId('parameters-toggle').click();
      await expect(component.getByTestId('parameters-list')).toBeVisible();
      await component.page().waitForTimeout(100);

      // Higher threshold due to font rendering and height differences between local Docker and CI
      await expect(component).toHaveScreenshot('tool-catalog-single-expanded.png', {
        maxDiffPixelRatio: 0.05,
        maxDiffPixels: 10000,
      });
    });

    test('single tool - selected', async ({ mount }) => {
      const tools = [createMockTool()];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Select the tool
      await component.getByTestId('tool-card').click();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-catalog-single-selected.png');
    });

    test('multiple tools - one selected', async ({ mount }) => {
      const tools = [
        createMockTool(),
        createJsonSchemaTool('calculator', 'Performs basic arithmetic operations.'),
        createMockTool({
          name: 'complex_tool',
          description: 'A tool with complex nested parameters.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              config: {
                type: Type.OBJECT,
                description: 'Configuration object.',
              } as Schema,
            },
            required: [],
          } as Schema,
        }),
      ];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Select the second tool
      const toolCards = component.getByTestId('tool-card');
      await toolCards.nth(1).click();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-catalog-multiple-selected.png');
    });

    test('tool with many parameters', async ({ mount }) => {
      const tools = [
        {
          name: 'http_request',
          description: 'Make an HTTP request to an external API with various options.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              url: {
                type: Type.STRING,
                description: 'The URL to request.',
              } as Schema,
              method: {
                type: Type.STRING,
                description: 'HTTP method (GET, POST, PUT, DELETE).',
              } as Schema,
              headers: {
                type: Type.OBJECT,
                description: 'Request headers.',
              } as Schema,
              body: {
                type: Type.STRING,
                description: 'Request body for POST/PUT.',
              } as Schema,
              timeout: {
                type: Type.INTEGER,
                description: 'Request timeout in seconds.',
              } as Schema,
              follow_redirects: {
                type: Type.BOOLEAN,
                description: 'Whether to follow redirects.',
              } as Schema,
            },
            required: ['url', 'method'],
          } as Schema,
          behavior: 0,
        } as FunctionDeclaration,
      ];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Expand parameters
      await component.getByTestId('parameters-toggle').click();
      await expect(component.getByTestId('parameters-list')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-catalog-many-parameters.png');
    });

    test('tool with long name and description', async ({ mount }) => {
      const tools = [
        createMockTool({
          name: 'very_long_tool_name_that_tests_text_wrapping_behavior_in_header',
          description:
            'This is a very long description that tests how the component handles long text. It should wrap properly without breaking the layout. The description explains what the tool does in detail with multiple sentences to ensure proper text handling.',
        }),
      ];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      await expect(component.getByTestId('tool-card')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-catalog-long-text.png');
    });

    test('all parameter types displayed', async ({ mount }) => {
      const tools = [
        {
          name: 'type_demo',
          description: 'Demonstrates all parameter types.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              string_param: {
                type: Type.STRING,
                description: 'A string parameter.',
              } as Schema,
              number_param: {
                type: Type.NUMBER,
                description: 'A number parameter.',
              } as Schema,
              integer_param: {
                type: Type.INTEGER,
                description: 'An integer parameter.',
              } as Schema,
              boolean_param: {
                type: Type.BOOLEAN,
                description: 'A boolean parameter.',
              } as Schema,
              array_param: {
                type: Type.ARRAY,
                description: 'An array parameter.',
              } as Schema,
              object_param: {
                type: Type.OBJECT,
                description: 'An object parameter.',
              } as Schema,
            },
            required: ['string_param', 'integer_param'],
          } as Schema,
          behavior: 0,
        } as FunctionDeclaration,
      ];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Expand parameters
      await component.getByTestId('parameters-toggle').click();
      await expect(component.getByTestId('parameters-list')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-catalog-all-types.png');
    });

    test('tool without description', async ({ mount }) => {
      const tools = [
        createMockTool({
          name: 'simple_tool',
          description: '',
        }),
      ];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      await expect(component.getByTestId('tool-card')).toBeVisible();
      await expect(component.getByTestId('tool-description')).not.toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-catalog-no-description.png');
    });

    test('tool without parameters', async ({ mount }) => {
      const tools = [
        {
          name: 'no_params_tool',
          description: 'A tool that takes no parameters.',
          behavior: 0,
        } as FunctionDeclaration,
      ];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      await expect(component.getByTestId('tool-card')).toBeVisible();
      await expect(component.getByTestId('parameters-toggle')).not.toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-catalog-no-parameters.png');
    });

    test('tool with JSON Schema parameters', async ({ mount }) => {
      const tools = [createJsonSchemaTool('calculator', 'Performs basic arithmetic operations.')];

      const component = await mount(ToolCatalogComponent, {
        props: { tools },
      });

      // Expand parameters
      await component.getByTestId('parameters-toggle').click();
      await expect(component.getByTestId('parameters-list')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('tool-catalog-json-schema.png');
    });
  });
});
