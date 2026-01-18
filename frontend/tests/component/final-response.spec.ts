/**
 * @fileoverview Playwright Component tests for FinalResponseComponent.
 *
 * Tests the FinalResponseComponent which supports two modes:
 * 1. Free-text mode: Simple textarea when no outputSchema is provided
 * 2. Schema mode: JSONForms-based form when outputSchema is defined
 *
 * These tests verify rendering, user interaction, and visual appearance
 * in both light and dark themes.
 *
 * @see frontend/src/app/ui/control-panel/final-response/final-response.component.ts
 * @see mddocs/frontend/research/jsonforms-research.md#use-case-final-response-forms
 */

import type { JsonSchema7 } from '@jsonforms/core';
import { expect, test } from './fixtures/theme.fixture';

import { FinalResponseComponent } from '../../src/app/ui/control-panel/final-response/final-response.component';

test.describe('FinalResponseComponent', () => {
  test.describe('free-text mode', () => {
    test('renders textarea when no outputSchema', async ({ mount }) => {
      const component = await mount(FinalResponseComponent);

      // Use submit button as anchor - it's always visible
      await expect(component.getByTestId('submit-button')).toBeVisible();
      await expect(component.getByText('Final Response')).toBeVisible();
      await expect(component.locator('textarea')).toBeVisible();
    });

    test('displays Final Response label', async ({ mount }) => {
      const component = await mount(FinalResponseComponent);

      await expect(component.getByText('Final Response')).toBeVisible();
    });

    test('displays submit button', async ({ mount }) => {
      const component = await mount(FinalResponseComponent);

      await expect(component.getByTestId('submit-button')).toContainText('SUBMIT RESPONSE');
    });

    test('submit button disabled when textarea empty', async ({ mount }) => {
      const component = await mount(FinalResponseComponent);

      await expect(component.getByTestId('submit-button')).toBeDisabled();
    });

    test('submit button enabled when text entered', async ({ mount }) => {
      const component = await mount(FinalResponseComponent);

      await component.locator('textarea').fill('This is my response');
      await expect(component.getByTestId('submit-button')).toBeEnabled();
    });

    test('emits submitText on button click', async ({ mount }) => {
      const events: string[] = [];
      const component = await mount(FinalResponseComponent, {
        on: {
          submitText: (text: string) => events.push(text),
        },
      });

      await component.locator('textarea').fill('My final answer');
      await component.getByTestId('submit-button').click();

      expect(events).toEqual(['My final answer']);
    });
  });

  test.describe('schema mode', () => {
    const simpleSchema: JsonSchema7 = {
      type: 'object',
      properties: {
        answer: {
          type: 'string',
          description: 'Your answer to the question',
        },
        confidence: {
          type: 'number',
          description: 'Confidence level (0-1)',
          minimum: 0,
          maximum: 1,
        },
      },
      required: ['answer'],
    };

    test('renders JSONForms when outputSchema provided', async ({ mount }) => {
      const component = await mount(FinalResponseComponent, {
        props: { outputSchema: simpleSchema },
      });

      // Use submit button as anchor - it's always visible
      await expect(component.getByTestId('submit-button')).toBeVisible();
      // Should see Answer field (from schema), not textarea
      await expect(component.getByText('Answer*')).toBeVisible();
      await expect(component.locator('textarea')).not.toBeVisible();
    });

    test('displays submit button in schema mode', async ({ mount }) => {
      const component = await mount(FinalResponseComponent, {
        props: { outputSchema: simpleSchema },
      });

      await expect(component.getByTestId('submit-button')).toContainText('SUBMIT RESPONSE');
    });

    test('submit button disabled when validation errors exist', async ({ mount }) => {
      const component = await mount(FinalResponseComponent, {
        props: { outputSchema: simpleSchema },
      });

      // Don't fill required field - should have validation errors
      await component.page().waitForTimeout(100);
      await expect(component.getByTestId('submit-button')).toBeDisabled();
    });

    test('submit button enabled when form is valid', async ({ mount }) => {
      const component = await mount(FinalResponseComponent, {
        props: { outputSchema: simpleSchema },
      });

      // Fill required field
      const inputs = component.locator('input');
      await inputs.first().fill('My answer');
      await component.page().waitForTimeout(100);

      await expect(component.getByTestId('submit-button')).toBeEnabled();
    });

    test('emits submitStructured on button click', async ({ mount }) => {
      const events: unknown[] = [];
      const component = await mount(FinalResponseComponent, {
        props: { outputSchema: simpleSchema },
        on: {
          submitStructured: (data: unknown) => events.push(data),
        },
      });

      // Fill form
      const inputs = component.locator('input');
      await inputs.nth(0).fill('The answer is 42');
      await inputs.nth(1).fill('0.95');
      await component.page().waitForTimeout(100);

      await component.getByTestId('submit-button').click();

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        answer: 'The answer is 42',
        confidence: 0.95,
      });
    });
  });

  test.describe('visual regression', () => {
    test('free-text mode - empty state', async ({ mount }) => {
      const component = await mount(FinalResponseComponent);

      await expect(component.getByTestId('submit-button')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('final-response-free-text-empty.png');
    });

    test('free-text mode - with text entered', async ({ mount }) => {
      const component = await mount(FinalResponseComponent);

      await expect(component.getByTestId('submit-button')).toBeVisible();

      await component
        .locator('textarea')
        .fill(
          'Based on my analysis, the answer is 42. ' +
            'This conclusion is derived from careful consideration of all factors ' +
            'and represents the most likely outcome given the available data.',
        );
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('final-response-free-text-filled.png');
    });

    test('free-text mode - long response', async ({ mount }) => {
      const component = await mount(FinalResponseComponent);

      await expect(component.getByTestId('submit-button')).toBeVisible();

      const longText = Array(10)
        .fill(
          'This is a long response that demonstrates textarea behavior with multiple lines of text.',
        )
        .join('\n\n');
      await component.locator('textarea').fill(longText);
      await component.page().waitForTimeout(100);

// Higher threshold due to font rendering differences between local Docker and CI Docker
      await expect(component).toHaveScreenshot('final-response-free-text-long.png', {
        maxDiffPixelRatio: 0.03,
      });
    });

    test('schema mode - empty state', async ({ mount }) => {
      const schema: JsonSchema7 = {
        type: 'object',
        properties: {
          response: {
            type: 'string',
            description: 'Your structured response',
          },
          status: {
            type: 'string',
            enum: ['success', 'failure', 'partial'],
            description: 'Response status',
          },
        },
        required: ['response', 'status'],
      };

      const component = await mount(FinalResponseComponent, {
        props: { outputSchema: schema },
      });

      await expect(component.getByTestId('submit-button')).toBeVisible();
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('final-response-schema-empty.png');
    });

    test('schema mode - with valid data', async ({ mount }) => {
      const schema: JsonSchema7 = {
        type: 'object',
        properties: {
          response: {
            type: 'string',
            description: 'Your structured response',
          },
          status: {
            type: 'string',
            enum: ['success', 'failure', 'partial'],
            description: 'Response status',
          },
        },
        required: ['response', 'status'],
      };

      const component = await mount(FinalResponseComponent, {
        props: { outputSchema: schema },
      });

      await expect(component.getByTestId('submit-button')).toBeVisible();

      // Fill form fields
      const inputs = component.locator('input');
      await inputs.nth(0).fill('Operation completed successfully');
      await inputs.nth(1).fill('success');

      // Click elsewhere to close autocomplete and unfocus
      await component.getByTestId('submit-button').focus();
      await component.page().waitForTimeout(200);

      await expect(component).toHaveScreenshot('final-response-schema-filled.png');
    });

    test('schema mode - validation errors', async ({ mount }) => {
      const schema: JsonSchema7 = {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'Contact email address',
          },
          count: {
            type: 'integer',
            description: 'Number of items',
            minimum: 1,
          },
        },
        required: ['email', 'count'],
      };

      const component = await mount(FinalResponseComponent, {
        props: { outputSchema: schema },
      });

      await expect(component.getByTestId('submit-button')).toBeVisible();
      // Don't fill anything - show required field errors
      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('final-response-schema-errors.png');
    });

    test('schema mode - complex schema', async ({ mount }) => {
      const schema: JsonSchema7 = {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Brief summary of the response',
          },
          details: {
            type: 'object',
            properties: {
              analysis: { type: 'string' },
              recommendations: { type: 'string' },
            },
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score (0-1)',
          },
          verified: {
            type: 'boolean',
            description: 'Has this been verified?',
          },
        },
        required: ['summary'],
      };

      const component = await mount(FinalResponseComponent, {
        props: { outputSchema: schema },
      });

      await expect(component.getByTestId('submit-button')).toBeVisible();

      // Fill some fields
      const inputs = component.locator('input');
      await inputs.nth(0).fill('Analysis complete with high confidence');
      await inputs.nth(1).fill('Data shows positive trends');
      await inputs.nth(2).fill('Continue current approach');
      await inputs.nth(3).fill('0.87');

      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('final-response-schema-complex.png');
    });

    test('schema mode - boolean and enum fields', async ({ mount }) => {
      const schema: JsonSchema7 = {
        type: 'object',
        properties: {
          approved: {
            type: 'boolean',
            description: 'Approval status',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Priority level',
          },
          notes: {
            type: 'string',
            description: 'Additional notes',
          },
        },
      };

      const component = await mount(FinalResponseComponent, {
        props: { outputSchema: schema },
      });

      await expect(component.getByTestId('submit-button')).toBeVisible();

      // Check the boolean checkbox
      await component.locator('mat-checkbox').click();

      // Fill text inputs (skip checkbox which is first input)
      const textInputs = component.locator('input:not([type="checkbox"])');
      await textInputs.nth(0).fill('high'); // priority enum
      await textInputs.nth(1).fill('Approved with high priority'); // notes

      await component.page().waitForTimeout(100);

      await expect(component).toHaveScreenshot('final-response-schema-boolean-enum.png');
    });
  });
});
