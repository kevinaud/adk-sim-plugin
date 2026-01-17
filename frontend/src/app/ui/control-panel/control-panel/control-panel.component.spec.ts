/**
 * @fileoverview Unit tests for ControlPanelComponent.
 *
 * Tests the component's internal logic and signal-based state management.
 * Full integration testing is done in Playwright component tests
 * (frontend/tests/component/control-panel.spec.ts) due to ESM/CJS compatibility
 * issues with lodash in Vitest when using JSONForms.
 *
 * This file skips the test suite in the unit test environment and defers
 * to Playwright CT tests for comprehensive component testing.
 *
 * @see frontend/tests/component/control-panel.spec.ts - Playwright CT tests (primary tests)
 * @see mddocs/frontend/frontend-tdd.md#control-panel-components
 */

// Skip the entire test suite - JSONForms has ESM/CJS compatibility issues with Vitest.
// The component is fully tested via Playwright Component Tests which properly
// handle the JSONForms/lodash module resolution in a real browser environment.
//
// See: frontend/tests/component/control-panel.spec.ts for comprehensive tests
describe.skip('ControlPanelComponent (see Playwright CT tests)', () => {
  it('tests are in frontend/tests/component/control-panel.spec.ts', () => {
    // This test suite is skipped. See Playwright CT tests for:
    // - Tab navigation between CALL TOOL and FINAL RESPONSE
    // - Tool catalog rendering when no tool selected
    // - Tool form rendering when tool selected
    // - Back navigation from tool form to catalog
    // - Tool invocation event emission
    // - Final response (text and structured) event emission
    // - Session completed state rendering
    // - Export button in completed state
    expect(true).toBe(true);
  });
});
