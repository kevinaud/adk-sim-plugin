/**
 * @fileoverview Tests for SessionComponent.
 *
 * Tests verify that the component correctly:
 * - Displays the session ID from route parameters
 * - Handles missing session ID gracefully
 *
 * @see mddocs/frontend/frontend-tdd.md#routing-configuration
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, type ParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { SessionComponent } from './session.component';

describe('SessionComponent', () => {
  let component: SessionComponent;
  let fixture: ComponentFixture<SessionComponent>;
  let paramMapSubject: BehaviorSubject<ParamMap>;

  // Helper to create param map that conforms to ParamMap interface
  const createParamMap = (params: Record<string, string>): ParamMap => {
    const map = new Map(Object.entries(params));
    return {
      get: (key: string) => map.get(key) ?? null,
      has: (key: string) => map.has(key),
      getAll: (key: string) => (map.has(key) ? [map.get(key)!] : []),
      keys: Array.from(map.keys()),
    };
  };

  beforeEach(async () => {
    paramMapSubject = new BehaviorSubject<ParamMap>(createParamMap({ id: 'test-session-id' }));

    await TestBed.configureTestingModule({
      imports: [SessionComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.asObservable(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });
  });

  describe('session ID display', () => {
    it('should display the session ID from route params', () => {
      const sessionIdElement = fixture.nativeElement.querySelector('.session-id');
      expect(sessionIdElement).toBeTruthy();
      expect(sessionIdElement.textContent).toContain('test-session-id');
    });

    it('should update when route params change', () => {
      // Update params
      paramMapSubject.next(createParamMap({ id: 'new-session-id' }));
      fixture.detectChanges();

      const sessionIdElement = fixture.nativeElement.querySelector('.session-id');
      expect(sessionIdElement.textContent).toContain('new-session-id');
    });

    it('should display "Unknown" when session ID is missing', () => {
      // Update params with no id
      paramMapSubject.next(createParamMap({}));
      fixture.detectChanges();

      const sessionIdElement = fixture.nativeElement.querySelector('.session-id');
      expect(sessionIdElement.textContent).toContain('Unknown');
    });
  });

  describe('layout', () => {
    it('should have a header with title', () => {
      const header = fixture.nativeElement.querySelector('.session-header h1');
      expect(header).toBeTruthy();
      expect(header.textContent).toContain('Session');
    });

    it('should have a content area', () => {
      const content = fixture.nativeElement.querySelector('.session-content');
      expect(content).toBeTruthy();
    });
  });
});
