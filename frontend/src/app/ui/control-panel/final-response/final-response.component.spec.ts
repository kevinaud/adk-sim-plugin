/**
 * @fileoverview Unit tests for FinalResponseComponent.
 *
 * Tests the component's internal logic and signal-based state management.
 * Full JSONForms integration testing is done in Playwright component tests
 * (frontend/tests/component/final-response.spec.ts) due to ESM/CJS compatibility
 * issues with lodash in Vitest.
 *
 * This file skips the test suite in the unit test environment and defers
 * to Playwright CT tests for comprehensive component testing.
 *
 * @see frontend/tests/component/final-response.spec.ts - Playwright CT tests (primary tests)
 * @see mddocs/frontend/frontend-tdd.md#finalresponsecomponent
 */

// Skip the entire test suite - JSONForms has ESM/CJS compatibility issues with Vitest.
// The component is fully tested via Playwright Component Tests which properly
// handle the JSONForms/lodash module resolution in a real browser environment.
//
// See: frontend/tests/component/final-response.spec.ts for comprehensive tests
describe.skip('FinalResponseComponent (see Playwright CT tests)', () => {
  it('tests are in frontend/tests/component/final-response.spec.ts', () => {
    // This test suite is skipped. See Playwright CT tests for:
    // - Free-text mode rendering
    // - Schema mode rendering with JSONForms
    // - Submit button state (disabled when empty/errors)
    // - Text response submission
    // - Structured response submission
    // - Validation error handling
    expect(true).toBe(true);
  });
});
