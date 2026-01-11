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
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate, type Timestamp } from '@bufbuild/protobuf/wkt';

import { SimulatorSessionSchema } from '@adk-sim/protos';

import { MockSessionGateway } from '../../data-access/session/mock-session.gateway';
import { SessionFacade } from '../../data-access/session/session.facade';
import { SessionGateway, type Session } from '../../data-access/session/session.gateway';
import { SessionStateService } from '../../data-access/session/session-state.service';

import { SessionListComponent } from './session-list.component';

describe('SessionListComponent', () => {
  let component: SessionListComponent;
  let fixture: ComponentFixture<SessionListComponent>;
  let mockGateway: MockSessionGateway;
  let router: Router;

  // Helper to create mock sessions
  const createMockSession = (id: string, description?: string, createdAt?: Date): Session => {
    const init: { id: string; description: string; createdAt?: Timestamp } = {
      id,
      description: description ?? '',
    };
    if (createdAt) {
      init.createdAt = timestampFromDate(createdAt);
    }
    return create(SimulatorSessionSchema, init);
  };

  // Helper to allow microtasks and promises to resolve
  const flushPromises = (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

  // Helper to wait for async operations and update view
  const waitForAsync = async (): Promise<void> => {
    await flushPromises();
    fixture.detectChanges();
  };

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
    it('should display loading spinner initially', () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();

      // Should be loading right after init before async completes
      expect(component.isLoading()).toBe(true);
      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      expect(spinner).toBeTruthy();
    });

    it('should display loading text when loading', () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();

      const loadingText = fixture.nativeElement.querySelector('.loading-text');
      expect(loadingText?.textContent).toContain('Loading sessions');
    });
  });

  describe('error state', () => {
    it('should display error message when fetch fails', async () => {
      mockGateway.setErrorToThrow(new Error('Connection failed'));

      fixture.detectChanges();
      await waitForAsync();

      const errorMessage = fixture.nativeElement.querySelector('.error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain('Connection failed');
    });

    it('should display error icon when fetch fails', async () => {
      mockGateway.setErrorToThrow(new Error('Connection failed'));

      fixture.detectChanges();
      await waitForAsync();

      const errorIcon = fixture.nativeElement.querySelector('.error-icon');
      expect(errorIcon).toBeTruthy();
    });

    it('should display retry button when fetch fails', async () => {
      mockGateway.setErrorToThrow(new Error('Connection failed'));

      fixture.detectChanges();
      await waitForAsync();

      const retryButton = fixture.nativeElement.querySelector('.error-container button');
      expect(retryButton).toBeTruthy();
      expect(retryButton.textContent).toContain('Retry');
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

      // Click retry
      const retryButton = fixture.nativeElement.querySelector(
        '.error-container button',
      ) as HTMLButtonElement;
      expect(retryButton).toBeTruthy();
      retryButton.click();
      await waitForAsync();

      expect(component.sessions()).toEqual(mockSessions);
      expect(component.hasError()).toBe(false);
    });
  });

  describe('empty state', () => {
    it('should display empty state when no sessions exist', async () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();
      await waitForAsync();

      const emptyMessage = fixture.nativeElement.querySelector('.empty-message');
      expect(emptyMessage).toBeTruthy();
      expect(emptyMessage.textContent).toContain('No sessions available');
    });

    it('should display empty hint message', async () => {
      mockGateway.setMockSessions([]);

      fixture.detectChanges();
      await waitForAsync();

      const emptyHint = fixture.nativeElement.querySelector('.empty-hint');
      expect(emptyHint).toBeTruthy();
      expect(emptyHint.textContent).toContain('Sessions will appear here');
    });
  });

  describe('session list display (FR-003)', () => {
    const testDate = new Date('2026-01-10T12:00:00Z');

    it('should display session ID', async () => {
      mockGateway.setMockSessions([createMockSession('abc12345-6789-0def')]);

      fixture.detectChanges();
      await waitForAsync();

      const sessionId = fixture.nativeElement.querySelector('.session-id');
      expect(sessionId).toBeTruthy();
      expect(sessionId.textContent).toContain('abc12345');
    });

    it('should display session description if available', async () => {
      mockGateway.setMockSessions([createMockSession('session-1', 'Test Description')]);

      fixture.detectChanges();
      await waitForAsync();

      const description = fixture.nativeElement.querySelector('.session-description');
      expect(description).toBeTruthy();
      expect(description.textContent).toContain('Test Description');
    });

    it('should display creation time', async () => {
      mockGateway.setMockSessions([createMockSession('session-1', '', testDate)]);

      fixture.detectChanges();
      await waitForAsync();

      const createdAt = fixture.nativeElement.querySelector('.session-created');
      expect(createdAt).toBeTruthy();
      // Should contain some date representation
      expect(createdAt.textContent).toBeTruthy();
      expect(createdAt.textContent).not.toContain('Unknown');
    });

    it('should display "Unknown" when creation time is not available', async () => {
      mockGateway.setMockSessions([createMockSession('session-1')]);

      fixture.detectChanges();
      await waitForAsync();

      const createdAt = fixture.nativeElement.querySelector('.session-created');
      expect(createdAt).toBeTruthy();
      expect(createdAt.textContent).toContain('Unknown');
    });

    it('should display session status', async () => {
      mockGateway.setMockSessions([createMockSession('session-1')]);

      fixture.detectChanges();
      await waitForAsync();

      const status = fixture.nativeElement.querySelector('.session-status');
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

      const sessionItems = fixture.nativeElement.querySelectorAll('.session-item');
      expect(sessionItems.length).toBe(3);
    });
  });

  describe('navigation', () => {
    it('should navigate to session when clicking a session item', async () => {
      mockGateway.setMockSessions([createMockSession('session-123')]);

      fixture.detectChanges();
      await waitForAsync();

      const sessionItem = fixture.nativeElement.querySelector('.session-item') as HTMLElement;
      expect(sessionItem).toBeTruthy();
      sessionItem.click();

      expect(router.navigate).toHaveBeenCalledWith(['/session', 'session-123']);
    });

    it('should navigate to session when pressing Enter on a session item', async () => {
      mockGateway.setMockSessions([createMockSession('session-456')]);

      fixture.detectChanges();
      await waitForAsync();

      const sessionItem = fixture.nativeElement.querySelector('.session-item') as HTMLElement;
      expect(sessionItem).toBeTruthy();
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      sessionItem.dispatchEvent(event);

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

  describe('helper methods', () => {
    beforeEach(async () => {
      mockGateway.setMockSessions([]);
      fixture.detectChanges();
      await waitForAsync();
    });

    describe('getTruncatedId', () => {
      it('should truncate long IDs', () => {
        const result = component.getTruncatedId('abc12345-6789-0def-ghij-klmnopqrstuv');
        expect(result).toBe('abc12345...');
      });

      it('should not truncate short IDs', () => {
        const result = component.getTruncatedId('short');
        expect(result).toBe('short');
      });
    });

    describe('getCreationTime', () => {
      it('should return Date when createdAt is present', () => {
        const testDate = new Date('2026-01-10T12:00:00Z');
        const session = createMockSession('session-1', '', testDate);

        const result = component.getCreationTime(session);

        expect(result).toBeInstanceOf(Date);
      });

      it('should return null when createdAt is not present', () => {
        const session = createMockSession('session-1');

        const result = component.getCreationTime(session);

        expect(result).toBeNull();
      });
    });
  });
});
