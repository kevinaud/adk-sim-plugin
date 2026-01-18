/**
 * E2E tests for full simulation flow.
 *
 * These tests simulate the complete ADK agent interaction flow:
 * 1. Create a session
 * 2. Submit requests (simulating ADK plugin)
 * 3. Verify the frontend displays events
 * 4. Submit responses from the UI
 * 5. Verify round-trip completion
 *
 * Uses the shared backend (8080) to allow session creation and request submission.
 *
 * @see mddocs/frontend/frontend-spec.md
 */

import {
  type GenerateContentRequest,
  GenerateContentRequestSchema,
  SubmitRequestRequestSchema,
  Type,
} from '@adk-sim/protos';
import { create } from '@bufbuild/protobuf';

import { expect, test } from './utils';

/**
 * Tool parameter definition for test requests.
 */
interface ToolParam {
  type: 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN';
  description: string;
}

/**
 * Helper to create a simple GenerateContentRequest for testing.
 * Simulates what an ADK agent would send.
 */
function createTestRequest(
  userMessage: string,
  options?: {
    systemInstruction?: string;
    tools?: Array<{ name: string; description: string; parameters?: Record<string, ToolParam> }>;
  },
): GenerateContentRequest {
  const typeMap = {
    STRING: Type.STRING,
    INTEGER: Type.INTEGER,
    NUMBER: Type.NUMBER,
    BOOLEAN: Type.BOOLEAN,
  };

  return create(GenerateContentRequestSchema, {
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [{ data: { case: 'text', value: userMessage } }],
      },
    ],
    systemInstruction: options?.systemInstruction
      ? {
          role: 'user',
          parts: [{ data: { case: 'text', value: options.systemInstruction } }],
        }
      : undefined,
    tools: options?.tools?.map((t) => ({
      functionDeclarations: [
        {
          name: t.name,
          description: t.description,
          parameters: t.parameters
            ? {
                type: Type.OBJECT,
                properties: Object.fromEntries(
                  Object.entries(t.parameters).map(([key, param]) => [
                    key,
                    {
                      type: typeMap[param.type],
                      description: param.description,
                    },
                  ]),
                ),
                required: Object.keys(t.parameters),
              }
            : undefined,
        },
      ],
    })),
  });
}

test.describe('Full Simulation Flow', () => {
  // Use shared backend for request submission
  test.use({ backend: 'shared' });

  test('displays pre-submitted LLM request on session load (historical replay)', async ({
    page,
    client,
    gotoAndWaitForAngular,
  }) => {
    // Capture console logs for debugging
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // 1. Create a new session and submit a request BEFORE navigating
    const { session } = await client.createSession({
      description: 'E2E Flow Test - Historical Replay',
    });

    // 2. Submit request BEFORE opening the session page (this tests historical replay)
    const testRequest = createTestRequest('What is the weather in San Francisco?', {
      systemInstruction: 'You are a helpful weather assistant.',
      tools: [
        {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          parameters: {
            location: { type: 'STRING' as const, description: 'The city name' },
          },
        },
      ],
    });

    await client.submitRequest(
      create(SubmitRequestRequestSchema, {
        sessionId: session!.id,
        turnId: 'turn-1',
        agentName: 'weather_agent',
        request: testRequest,
      }),
    );

    // 3. Now navigate to the session - should receive the historical event
    await gotoAndWaitForAngular(`/session/${session!.id}`);
    await page.waitForTimeout(2000);

    // 4. Verify the event stream shows the user message from historical replay
    const eventStream = page.locator('[data-testid="event-stream"]');
    await expect(eventStream).toBeVisible();

    const eventBlock = page.locator('[data-testid="event-block"]').first();

    // Print console logs for debugging if test is about to fail
    const isVisible = await eventBlock.isVisible().catch(() => false);
    if (!isVisible) {
      console.log('Console logs from browser:');
      consoleLogs.forEach((log) => console.log(log));
    }

    await expect(eventBlock).toBeVisible({ timeout: 10000 });
    await expect(eventBlock).toContainText('What is the weather in San Francisco?');

    // 5. Verify status badge shows "Active"
    const statusBadge = page.locator('[data-testid="status-badge"]');
    await expect(statusBadge).toContainText('Active');

    // 6. Verify tools are available in the control panel
    const toolCatalog = page.locator('app-tool-catalog');
    await expect(toolCatalog).toBeVisible();
    await expect(toolCatalog).toContainText('get_weather');
  });

  test('receives live LLM request from ADK agent during session', async ({
    page,
    client,
    gotoAndWaitForAngular,
  }) => {
    // 1. Create a new session
    const { session } = await client.createSession({
      description: 'E2E Flow Test - Live Request',
    });

    // 2. Navigate to the session FIRST
    await gotoAndWaitForAngular(`/session/${session!.id}`);

    // 3. Wait for subscription to be fully established
    await page.waitForTimeout(2000);

    // 4. Verify initial state - should show empty event stream
    const eventStream = page.locator('[data-testid="event-stream"]');
    await expect(eventStream).toBeVisible();
    const eventStreamEmptyState = eventStream.locator('[data-testid="empty-state"]');
    await expect(eventStreamEmptyState).toBeVisible();

    // 5. Submit a request via gRPC (simulating ADK plugin) AFTER page is loaded
    const testRequest = createTestRequest('What is the weather in San Francisco?', {
      systemInstruction: 'You are a helpful weather assistant.',
      tools: [
        {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          parameters: {
            location: { type: 'STRING' as const, description: 'The city name' },
          },
        },
      ],
    });

    await client.submitRequest(
      create(SubmitRequestRequestSchema, {
        sessionId: session!.id,
        turnId: 'turn-1',
        agentName: 'weather_agent',
        request: testRequest,
      }),
    );

    // 6. Wait for the live event to appear in the UI
    await page.waitForTimeout(3000);

    // 7. Verify the event stream shows the user message
    await expect(eventStreamEmptyState).not.toBeVisible({ timeout: 10000 });
    const eventBlock = page.locator('[data-testid="event-block"]').first();
    await expect(eventBlock).toBeVisible();
    await expect(eventBlock).toContainText('What is the weather in San Francisco?');

    // 8. Verify status badge changed from "Awaiting Query" to "Active"
    const statusBadge = page.locator('[data-testid="status-badge"]');
    await expect(statusBadge).toContainText('Active');

    // 9. Verify tools are available in the control panel
    const toolCatalog = page.locator('app-tool-catalog');
    await expect(toolCatalog).toBeVisible();
    await expect(toolCatalog).toContainText('get_weather');
  });

  test('displays system instructions from request', async ({
    page,
    client,
    gotoAndWaitForAngular,
  }) => {
    // 1. Create session and navigate
    const { session } = await client.createSession({
      description: 'E2E Flow Test - System Instructions',
    });
    await gotoAndWaitForAngular(`/session/${session!.id}`);
    await page.waitForTimeout(500);

    // 2. Submit request with system instruction
    const testRequest = createTestRequest('Hello', {
      systemInstruction: 'You are a financial advisor. Always provide balanced advice.',
    });

    const submitRequest = create(SubmitRequestRequestSchema, {
      sessionId: session!.id,
      turnId: 'turn-1',
      agentName: 'advisor_agent',
      request: testRequest,
    });

    await client.submitRequest(submitRequest);
    await page.waitForTimeout(1500);

    // 3. Expand system instructions section
    const instructionsHeader = page.locator('.instructions-header');
    await instructionsHeader.click();

    // 4. Verify system instruction is displayed
    const instructionsContent = page.locator('[data-testid="instructions-content"]');
    await expect(instructionsContent).toBeVisible();
    await expect(instructionsContent).toContainText('financial advisor');
    await expect(instructionsContent).toContainText('balanced advice');
  });

  test('can select tool and view form', async ({ page, client, gotoAndWaitForAngular }) => {
    // 1. Create session and submit request with tools
    const { session } = await client.createSession({
      description: 'E2E Flow Test - Tool Selection',
    });
    await gotoAndWaitForAngular(`/session/${session!.id}`);
    await page.waitForTimeout(500);

    const testRequest = createTestRequest('Search for flights', {
      tools: [
        {
          name: 'search_flights',
          description: 'Search for available flights',
          parameters: {
            origin: { type: 'STRING' as const, description: 'Departure airport code' },
            destination: { type: 'STRING' as const, description: 'Arrival airport code' },
            date: { type: 'STRING' as const, description: 'Travel date (YYYY-MM-DD)' },
          },
        },
        {
          name: 'book_flight',
          description: 'Book a flight',
          parameters: {
            flightId: { type: 'STRING' as const, description: 'The flight ID to book' },
          },
        },
      ],
    });

    await client.submitRequest(
      create(SubmitRequestRequestSchema, {
        sessionId: session!.id,
        turnId: 'turn-1',
        agentName: 'travel_agent',
        request: testRequest,
      }),
    );
    await page.waitForTimeout(1500);

    // 2. Verify both tools are displayed
    const toolCatalog = page.locator('app-tool-catalog');
    await expect(toolCatalog).toContainText('search_flights');
    await expect(toolCatalog).toContainText('book_flight');

    // 3. Click on search_flights tool header to select it
    const searchFlightsTool = page.locator('[data-tool-name="search_flights"] .tool-header');
    await searchFlightsTool.click();
    await page.waitForTimeout(300);

    // 4. Click SELECT TOOL button to show the form
    const selectToolButton = page.getByRole('button', { name: /select tool/i });
    await expect(selectToolButton).toBeEnabled();
    await selectToolButton.click();
    await page.waitForTimeout(500);

    // 5. Verify tool form is displayed
    const toolForm = page.locator('[data-testid="tool-form-view"]');
    await expect(toolForm).toBeVisible();
    await expect(toolForm).toContainText('search_flights');

    // 6. Verify form has input fields for parameters
    // JSONForms renders fields based on schema
    await expect(page.getByLabel(/origin/i)).toBeVisible();
    await expect(page.getByLabel(/destination/i)).toBeVisible();
    await expect(page.getByLabel(/date/i)).toBeVisible();
  });

  test('can switch to Final Response tab and submit text', async ({
    page,
    client,
    gotoAndWaitForAngular,
  }) => {
    // 1. Create session and submit request
    const { session } = await client.createSession({
      description: 'E2E Flow Test - Final Response',
    });
    await gotoAndWaitForAngular(`/session/${session!.id}`);
    await page.waitForTimeout(500);

    await client.submitRequest(
      create(SubmitRequestRequestSchema, {
        sessionId: session!.id,
        turnId: 'turn-1',
        agentName: 'test_agent',
        request: createTestRequest('What is 2+2?'),
      }),
    );
    await page.waitForTimeout(1500);

    // 2. Switch to Final Response tab
    const responseTab = page.locator('[data-testid="tab-response"]');
    await responseTab.click();
    await page.waitForTimeout(300);

    // 3. Verify Final Response tab is active
    await expect(responseTab).toHaveClass(/active/);

    // 4. Verify text input is available
    const finalResponseView = page.locator('[data-testid="final-response-view"]');
    await expect(finalResponseView).toBeVisible();

    const textarea = finalResponseView.locator('textarea');
    await expect(textarea).toBeVisible();

    // 5. Type a response
    await textarea.fill('The answer is 4.');

    // 6. Submit the response
    const submitButton = finalResponseView.locator('button').filter({ hasText: /submit/i });
    await expect(submitButton).toBeVisible();
  });

  test('handles multiple queued requests (FIFO)', async ({
    page,
    client,
    gotoAndWaitForAngular,
  }) => {
    // 1. Create session and navigate
    const { session } = await client.createSession({
      description: 'E2E Flow Test - FIFO Queue',
    });
    await gotoAndWaitForAngular(`/session/${session!.id}`);
    await page.waitForTimeout(500);

    // 2. Submit first request with a tool
    await client.submitRequest(
      create(SubmitRequestRequestSchema, {
        sessionId: session!.id,
        turnId: 'turn-1',
        agentName: 'agent_1',
        request: createTestRequest('First question', {
          tools: [
            {
              name: 'test_tool',
              description: 'A test tool',
            },
          ],
        }),
      }),
    );
    await page.waitForTimeout(500);

    // 3. Submit second request while first is being handled
    await client.submitRequest(
      create(SubmitRequestRequestSchema, {
        sessionId: session!.id,
        turnId: 'turn-2',
        agentName: 'agent_2',
        request: createTestRequest('Second question', {
          tools: [
            {
              name: 'test_tool',
              description: 'A test tool',
            },
          ],
        }),
      }),
    );
    await page.waitForTimeout(1000);

    // 4. Verify first request is displayed (current request)
    const eventBlock = page.locator('[data-testid="event-block"]').first();
    await expect(eventBlock).toContainText('First question');

    // 5. Submit a tool call response via the control panel
    const toolHeader = page.locator('[data-tool-name="test_tool"] .tool-header');
    await toolHeader.click();
    await page.waitForTimeout(300);

    const selectToolButton = page.getByRole('button', { name: /select tool/i });
    await selectToolButton.click();
    await page.waitForTimeout(300);

    const executeButton = page.locator('[data-testid="execute-button"]');
    await executeButton.click();
    await page.waitForTimeout(1500);

    // 6. Verify second request is now displayed (queue advanced)
    await expect(eventBlock).toContainText('Second question');
  });
});

test.describe('Visual Regression - Simulation Flow', () => {
  test.use({ backend: 'shared' });

  test('session with active request - light theme', async ({
    page,
    client,
    gotoAndWaitForAngular,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const { session } = await client.createSession({
      description: 'Visual Test - Active Request',
    });
    await gotoAndWaitForAngular(`/session/${session!.id}`);
    await page.waitForTimeout(500);

    // Submit a request with tools
    await client.submitRequest(
      create(SubmitRequestRequestSchema, {
        sessionId: session!.id,
        turnId: 'turn-1',
        agentName: 'demo_agent',
        request: createTestRequest('Show me the latest news about AI', {
          systemInstruction: 'You are a news aggregator assistant.',
          tools: [
            {
              name: 'search_news',
              description: 'Search for news articles',
              parameters: {
                query: { type: 'STRING' as const, description: 'Search query' },
                category: { type: 'STRING' as const, description: 'News category' },
              },
            },
          ],
        }),
      }),
    );
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot('simulation-active-request-light.png', {
      fullPage: true,
    });
  });

  test('session with tool form open - light theme', async ({
    page,
    client,
    gotoAndWaitForAngular,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const { session } = await client.createSession({
      description: 'Visual Test - Tool Form',
    });
    await gotoAndWaitForAngular(`/session/${session!.id}`);
    await page.waitForTimeout(500);

    await client.submitRequest(
      create(SubmitRequestRequestSchema, {
        sessionId: session!.id,
        turnId: 'turn-1',
        agentName: 'calculator_agent',
        request: createTestRequest('Calculate something', {
          tools: [
            {
              name: 'calculate',
              description: 'Perform a calculation',
              parameters: {
                expression: { type: 'STRING' as const, description: 'Math expression to evaluate' },
              },
            },
          ],
        }),
      }),
    );
    await page.waitForTimeout(1500);

    // Click on the tool header to select it, then click SELECT TOOL to open form
    const toolItem = page.locator('[data-tool-name="calculate"] .tool-header');
    await toolItem.click();
    await page.waitForTimeout(300);

    const selectToolButton = page.getByRole('button', { name: /select tool/i });
    await selectToolButton.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('simulation-tool-form-open-light.png', {
      fullPage: true,
    });
  });
});
