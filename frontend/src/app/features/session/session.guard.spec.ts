/**
 * @fileoverview Tests for sessionExistsGuard.
 *
 * Tests verify that the guard correctly:
 * - Allows navigation when session exists (FR-001)
 * - Redirects with error when session does not exist (FR-004)
 * - Redirects with error when session ID is missing
 *
 * Uses MockSessionGateway for controlled testing scenarios.
 *
 * @see mddocs/frontend/frontend-tdd.md#routing-configuration
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, UrlTree } from '@angular/router';
import { create } from '@bufbuild/protobuf';

import { SimulatorSessionSchema } from '@adk-sim/protos';

import { MockSessionGateway } from '../../data-access/session/mock-session.gateway';
import { SessionFacade } from '../../data-access/session/session.facade';
import { SessionGateway, type Session } from '../../data-access/session/session.gateway';
import { SessionStateService } from '../../data-access/session/session-state.service';

import { sessionExistsGuard } from './session.guard';

describe('sessionExistsGuard', () => {
  let mockGateway: MockSessionGateway;
  let router: Router;

  // Helper to create mock sessions
  const createMockSession = (id: string): Session => {
    return create(SimulatorSessionSchema, { id, description: '' });
  };

  // Helper to create a mock ActivatedRouteSnapshot with params
  const createRouteSnapshot = (params: Record<string, string | null>): ActivatedRouteSnapshot => {
    return {
      paramMap: {
        get: (key: string) => params[key] ?? null,
        has: (key: string) => key in params,
        getAll: (key: string) => (params[key] ? [params[key]!] : []),
        keys: Object.keys(params),
      },
    } as unknown as ActivatedRouteSnapshot;
  };

  beforeEach(async () => {
    mockGateway = new MockSessionGateway();

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SessionFacade,
        SessionStateService,
        { provide: SessionGateway, useValue: mockGateway },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  describe('valid session', () => {
    it('should return true when session exists', async () => {
      // Setup mock session
      mockGateway.setMockSessions([createMockSession('valid-session-id')]);

      // Create route snapshot with session ID
      const route = createRouteSnapshot({ id: 'valid-session-id' });

      // Run guard
      const result = await TestBed.runInInjectionContext(() =>
        sessionExistsGuard(route, {} as never),
      );

      expect(result).toBe(true);
    });
  });

  describe('invalid session (FR-004)', () => {
    it('should redirect to home with error when session does not exist', async () => {
      // Setup empty mock (no sessions)
      mockGateway.setMockSessions([]);

      // Create route snapshot with non-existent session ID
      const route = createRouteSnapshot({ id: 'non-existent-session' });

      // Run guard
      const result = await TestBed.runInInjectionContext(() =>
        sessionExistsGuard(route, {} as never),
      );

      // Should return UrlTree (redirect)
      expect(result).toBeInstanceOf(UrlTree);

      // Verify redirect URL
      const urlTree = result as UrlTree;
      expect(urlTree.toString()).toBe('/?error=Session%20not%20found');
    });

    it('should redirect to home with error when gateway throws', async () => {
      // Setup gateway to throw error
      mockGateway.setErrorToThrow(new Error('Connection failed'));

      // Create route snapshot
      const route = createRouteSnapshot({ id: 'any-session' });

      // Run guard
      const result = await TestBed.runInInjectionContext(() =>
        sessionExistsGuard(route, {} as never),
      );

      // Should return UrlTree (redirect)
      expect(result).toBeInstanceOf(UrlTree);

      // Verify redirect URL
      const urlTree = result as UrlTree;
      expect(urlTree.toString()).toBe('/?error=Session%20not%20found');
    });
  });

  describe('missing session ID', () => {
    it('should redirect to home with error when session ID is null', async () => {
      // Create route snapshot with null session ID
      const route = createRouteSnapshot({ id: null });

      // Run guard
      const result = await TestBed.runInInjectionContext(() =>
        sessionExistsGuard(route, {} as never),
      );

      // Should return UrlTree (redirect)
      expect(result).toBeInstanceOf(UrlTree);

      // Verify redirect URL
      const urlTree = result as UrlTree;
      expect(urlTree.toString()).toBe('/?error=No%20session%20ID%20provided');
    });

    it('should redirect to home with error when id param is not in route', async () => {
      // Create route snapshot without id param
      const route = createRouteSnapshot({});

      // Run guard
      const result = await TestBed.runInInjectionContext(() =>
        sessionExistsGuard(route, {} as never),
      );

      // Should return UrlTree (redirect)
      expect(result).toBeInstanceOf(UrlTree);

      // Verify redirect URL
      const urlTree = result as UrlTree;
      expect(urlTree.toString()).toBe('/?error=No%20session%20ID%20provided');
    });
  });
});
