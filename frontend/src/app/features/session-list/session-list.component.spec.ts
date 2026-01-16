/**
 * @fileoverview Tests for SessionListComponent.
 *
 * Tests verify that the component correctly:
 * - Fetches sessions via SessionFacade on initialization
 * - Displays loading state while fetching
 * - Displays error state when fetch fails
 * - Displays session list with metadata (FR-003)
 *
 * Uses MockSessionGateway for controlled testing scenarios.
 *
 * @see mddocs/frontend/frontend-tdd.md#testing-strategy
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { BehaviorSubject } from 'rxjs';

import { SimulatorSessionSchema } from '@adk-sim/protos';

import { MockSessionGateway } from '../../data-access/session/mock-session.gateway';
import { SessionFacade } from '../../data-access/session/session.facade';
import { SessionGateway, type Session } from '../../data-access/session/session.gateway';
import { SessionStateService } from '../../data-access/session/session-state.service';

import { SessionListComponent } from './session-list.component';

/** Helper to create mock sessions for testing */
function createMockSession(id: string, description?: string, createdAt?: Date): Session {
  const init: { id: string; description: string; createdAt?: Timestamp } = {
    id,
    description: description ?? '',
  };
  if (createdAt) {
    init.createdAt = timestampFromDate(createdAt);
  }
  return create(SimulatorSessionSchema, init);
}

/** Helper to allow microtasks and promises to resolve */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Helper to wait for async operations and update view */
function createWaitForAsync(
  getFixture: () => ComponentFixture<SessionListComponent>,
): () => Promise<void> {
  return async () => {
    await flushPromises();
    getFixture().detectChanges();
  };
}

describe('SessionListComponent', () => {
  let component: SessionListComponent;
  let fixture: ComponentFixture<SessionListComponent>;
  let mockGateway: MockSessionGateway;
  let router: Router;
  let waitForAsync: () => Promise<void>;

  beforeEach(async () => {
    mockGateway = new MockSessionGateway();

    await TestBed.configureTestingModule({
      imports: [SessionListComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        SessionFacade,
        SessionStateService,
        { provide: SessionGateway, useValue: mockGateway },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(SessionListComponent);
    component = fixture.componentInstance;
    waitForAsync = createWaitForAsync(() => fixture);
  });

  describe('initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should call listSessions on init', async () => {
      const mockSessions = [createMockSession('session-1')];
      mockGateway.setMockSessions(mockSessions);

      fixture.detectChanges(); // triggers ngOnInit
      await waitForAsync();

      expect(component.sessions()).toEqual(mockSessions);
    });

    it('should set isLoading to false after fetch completes', async () => {
      mockGateway.setMockSessions([createMockSession('session-1')]);

      fixture.detectChanges();
      await waitForAsync();

      expect(component.isLoading()).toBe(false);
    });
  });

  describe('loading state', () => {
    it('should display loading component initially', () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();

      // Should be loading right after init before async completes
      expect(component.isLoading()).toBe(true);
      const loadingState = fixture.nativeElement.querySelector('app-loading-state');
      expect(loadingState).toBeTruthy();
    });

    it('should display loading text when loading', () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();

      const loadingState = fixture.nativeElement.querySelector('app-loading-state');
      expect(loadingState?.textContent).toContain('Loading sessions');
    });
  });

  describe('error state', () => {
    it('should display error component when fetch fails', async () => {
      mockGateway.setErrorToThrow(new Error('Connection failed'));

      fixture.detectChanges();
      await waitForAsync();

      const errorState = fixture.nativeElement.querySelector('app-error-state');
      expect(errorState).toBeTruthy();
      expect(errorState.textContent).toContain('Connection failed');
    });

    it('should retry loading sessions when retry button is clicked', async () => {
      // First call fails
      mockGateway.setErrorToThrow(new Error('Connection failed'));

      fixture.detectChanges();
      await waitForAsync();

      // Setup success for retry
      mockGateway.setErrorToThrow(null);
      const mockSessions = [createMockSession('session-1')];
      mockGateway.setMockSessions(mockSessions);

      // Click retry button inside error-state component
      const retryButton = fixture.nativeElement.querySelector(
        'app-error-state button',
      ) as HTMLButtonElement;
      expect(retryButton).toBeTruthy();
      retryButton.click();
      await waitForAsync();

      expect(component.sessions()).toEqual(mockSessions);
      expect(component.hasError()).toBe(false);
    });
  });

  describe('empty state', () => {
    it('should display empty component when no sessions exist', async () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();
      await waitForAsync();

      const emptyState = fixture.nativeElement.querySelector('app-empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No sessions available');
    });

    it('should display empty hint message', async () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();
      await waitForAsync();

      const emptyState = fixture.nativeElement.querySelector('app-empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('Sessions will appear here');
    });
  });

  describe('session list display (FR-003)', () => {
    const testDate = new Date('2026-01-10T12:00:00Z');

    it('should display session ID', async () => {
      mockGateway.setMockSessions([createMockSession('abc12345-6789-0def')]);

      fixture.detectChanges();
      await waitForAsync();

      const sessionId = fixture.nativeElement.querySelector('[data-testid="session-id"]');
      expect(sessionId).toBeTruthy();
      expect(sessionId.textContent).toContain('abc12345');
    });

    it('should display session description if available', async () => {
      mockGateway.setMockSessions([createMockSession('session-1', 'Test Description')]);

      fixture.detectChanges();
      await waitForAsync();

      const description = fixture.nativeElement.querySelector(
        '[data-testid="session-description"]',
      );
      expect(description).toBeTruthy();
      expect(description.textContent).toContain('Test Description');
    });

    it('should display creation time', async () => {
      mockGateway.setMockSessions([createMockSession('session-1', '', testDate)]);

      fixture.detectChanges();
      await waitForAsync();

      const createdAt = fixture.nativeElement.querySelector('[data-testid="session-created"]');
      expect(createdAt).toBeTruthy();
      // Should contain some date representation
      expect(createdAt.textContent).toBeTruthy();
      expect(createdAt.textContent).not.toContain('Unknown');
    });

    it('should display "Unknown" when creation time is not available', async () => {
      mockGateway.setMockSessions([createMockSession('session-1')]);

      fixture.detectChanges();
      await waitForAsync();

      const createdAt = fixture.nativeElement.querySelector('[data-testid="session-created"]');
      expect(createdAt).toBeTruthy();
      expect(createdAt.textContent).toContain('Unknown');
    });

    it('should display session status', async () => {
      mockGateway.setMockSessions([createMockSession('session-1')]);

      fixture.detectChanges();
      await waitForAsync();

      const status = fixture.nativeElement.querySelector('[data-testid="session-status"]');
      expect(status).toBeTruthy();
      expect(status.textContent).toContain('Active');
    });

    it('should display multiple sessions', async () => {
      mockGateway.setMockSessions([
        createMockSession('session-1', 'First'),
        createMockSession('session-2', 'Second'),
        createMockSession('session-3', 'Third'),
      ]);

      fixture.detectChanges();
      await waitForAsync();

      const sessionCards = fixture.nativeElement.querySelectorAll('app-session-card');
      expect(sessionCards.length).toBe(3);
    });
  });

  describe('navigation', () => {
    it('should navigate to session when clicking a session card', async () => {
      mockGateway.setMockSessions([createMockSession('session-123')]);

      fixture.detectChanges();
      await waitForAsync();

      // Click the mat-list-item inside the session card
      const listItem = fixture.nativeElement.querySelector(
        'app-session-card mat-list-item',
      ) as HTMLElement;
      expect(listItem).toBeTruthy();
      listItem.click();

      expect(router.navigate).toHaveBeenCalledWith(['/session', 'session-123']);
    });

    it('should navigate to session when pressing Enter on a session card', async () => {
      mockGateway.setMockSessions([createMockSession('session-456')]);

      fixture.detectChanges();
      await waitForAsync();

      const listItem = fixture.nativeElement.querySelector(
        'app-session-card mat-list-item',
      ) as HTMLElement;
      expect(listItem).toBeTruthy();
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      listItem.dispatchEvent(event);

      expect(router.navigate).toHaveBeenCalledWith(['/session', 'session-456']);
    });
  });

  describe('refresh functionality', () => {
    it('should have a refresh button', async () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();
      await waitForAsync();

      const refreshButton = fixture.nativeElement.querySelector('mat-card-actions button');
      expect(refreshButton).toBeTruthy();
      expect(refreshButton.textContent).toContain('Refresh');
    });

    it('should reload sessions when refresh is clicked', async () => {
      // Initial load with one session
      mockGateway.setMockSessions([createMockSession('session-1')]);

      fixture.detectChanges();
      await waitForAsync();

      expect(component.sessions().length).toBe(1);

      // Add another session and refresh
      mockGateway.setMockSessions([createMockSession('session-1'), createMockSession('session-2')]);

      const refreshButton = fixture.nativeElement.querySelector(
        'mat-card-actions button',
      ) as HTMLButtonElement;
      refreshButton.click();
      await waitForAsync();

      expect(component.sessions().length).toBe(2);
    });
  });

  describe('route error display', () => {
    it('should not display route error banner when no error param', async () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();
      await waitForAsync();

      expect(component.hasRouteError()).toBe(false);
      const errorBanner = fixture.nativeElement.querySelector('[data-testid="route-error-banner"]');
      expect(errorBanner).toBeFalsy();
    });

    it('should have dismissRouteError method', async () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();
      await waitForAsync();

      // Method should exist and not throw
      expect(typeof component.dismissRouteError).toBe('function');
      expect(() => component.dismissRouteError()).not.toThrow();
    });

    it('should have routeError and hasRouteError signals', () => {
      // Verify the signals exist and have correct initial state
      expect(typeof component.routeError).toBe('function');
      expect(typeof component.hasRouteError).toBe('function');
      expect(component.routeError()).toBeNull();
      expect(component.hasRouteError()).toBe(false);
    });
  });
});

/**
 * Integration tests for route error display with query params.
 * Uses a mock ActivatedRoute to simulate navigation with error query param.
 */
describe('SessionListComponent with route error query param', () => {
  let component: SessionListComponent;
  let fixture: ComponentFixture<SessionListComponent>;
  let mockGateway: MockSessionGateway;
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;
  let waitForAsync: () => Promise<void>;

  beforeEach(async () => {
    mockGateway = new MockSessionGateway();
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({
      error: 'Session not found',
    });

    await TestBed.configureTestingModule({
      imports: [SessionListComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        SessionFacade,
        SessionStateService,
        { provide: SessionGateway, useValue: mockGateway },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParamsSubject.asObservable(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionListComponent);
    component = fixture.componentInstance;
    waitForAsync = createWaitForAsync(() => fixture);
  });

  it('should display route error from query params', async () => {
    mockGateway.setMockSessions([createMockSession('session-1')]);

    fixture.detectChanges();
    await waitForAsync();

    expect(component.hasRouteError()).toBe(true);
    expect(component.routeError()).toBe('Session not found');

    const errorBanner = fixture.nativeElement.querySelector('[data-testid="route-error-banner"]');
    expect(errorBanner).toBeTruthy();

    const errorMessage = fixture.nativeElement.querySelector(
      '[data-testid="error-banner-message"]',
    );
    expect(errorMessage?.textContent).toContain('Session not found');
  });

  it('should display dismissible error banner with warning icon', async () => {
    mockGateway.setMockSessions([]);

    fixture.detectChanges();
    await waitForAsync();

    const warningIcon = fixture.nativeElement.querySelector('[data-testid="error-banner-icon"]');
    expect(warningIcon).toBeTruthy();

    const dismissButton = fixture.nativeElement.querySelector(
      '[data-testid="error-banner-dismiss"]',
    );
    expect(dismissButton).toBeTruthy();
  });

  it('should clear error when queryParams change to no error', async () => {
    mockGateway.setMockSessions([]);

    fixture.detectChanges();
    await waitForAsync();

    expect(component.hasRouteError()).toBe(true);

    // Simulate navigation without error param
    queryParamsSubject.next({});
    fixture.detectChanges();
    await waitForAsync();

    expect(component.hasRouteError()).toBe(false);
    const errorBanner = fixture.nativeElement.querySelector('[data-testid="route-error-banner"]');
    expect(errorBanner).toBeFalsy();
  });

  it('should dismiss error when dismiss button is clicked', async () => {
    mockGateway.setMockSessions([]);

    fixture.detectChanges();
    await waitForAsync();

    expect(component.hasRouteError()).toBe(true);

    // Click dismiss
    const dismissButton = fixture.nativeElement.querySelector(
      '[data-testid="error-banner-dismiss"]',
    ) as HTMLButtonElement;
    expect(dismissButton).toBeTruthy();
    dismissButton.click();
    fixture.detectChanges();

    expect(component.hasRouteError()).toBe(false);
  });
});
