/**
 * @fileoverview Tests for EventBlockComponent.
 *
 * Tests verify that the component correctly:
 * - Determines block type based on role and parts
 * - Extracts parts from content
 * - Maps block type to icon and label
 * - Renders header with icon and label
 * - Renders text content
 * - Renders function calls with formatted args
 * - Renders function responses with formatted results
 * - Applies correct CSS classes based on block type
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-007
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Content } from '@adk-sim/converters';

import { EventBlockComponent, type BlockType } from './event-block.component';

/**
 * Create a test Content object with specified configuration.
 */
function createTestContent(config: {
  role: 'user' | 'model';
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response?: Record<string, unknown> };
}): Content {
  const parts = [];

  if (config.text !== undefined) {
    parts.push({ text: config.text });
  }
  if (config.functionCall) {
    parts.push({ functionCall: config.functionCall });
  }
  if (config.functionResponse) {
    parts.push({ functionResponse: config.functionResponse });
  }

  return { role: config.role, parts };
}

/**
 * Test host component that wraps EventBlockComponent.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [EventBlockComponent],
  template: `<app-event-block [content]="content()" />`,
})
class TestHostComponent {
  readonly content = signal<Content>({ role: 'user', parts: [] });
}

describe('EventBlockComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, EventBlockComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    const eventBlock = fixture.nativeElement.querySelector('app-event-block');
    expect(eventBlock).toBeTruthy();
  });

  describe('blockType computation', () => {
    it('should return "user" for user role with text content', () => {
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello' }));
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('user');
    });

    it('should return "model" for model role with text content', () => {
      hostComponent.content.set(createTestContent({ role: 'model', text: 'Response' }));
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('model');
    });

    it('should return "tool" for model role with functionCall', () => {
      hostComponent.content.set(
        createTestContent({
          role: 'model',
          functionCall: { name: 'get_weather', args: { city: 'NYC' } },
        }),
      );
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('tool');
    });

    it('should return "tool" for user role with functionResponse', () => {
      hostComponent.content.set(
        createTestContent({
          role: 'user',
          functionResponse: { name: 'get_weather', response: { temp: 72 } },
        }),
      );
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('tool');
    });

    it('should handle content with empty parts', () => {
      hostComponent.content.set({ role: 'user', parts: [] });
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('user');
    });

    it('should handle content with undefined parts', () => {
      hostComponent.content.set({ role: 'model' });
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('model');
    });
  });

  describe('icon computation', () => {
    it('should return "person" icon for user block type', () => {
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello' }));
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('person');
    });

    it('should return "smart_toy" icon for model block type', () => {
      hostComponent.content.set(createTestContent({ role: 'model', text: 'Response' }));
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('smart_toy');
    });

    it('should return "build" icon for tool block type', () => {
      hostComponent.content.set(
        createTestContent({
          role: 'model',
          functionCall: { name: 'test_tool' },
        }),
      );
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('build');
    });
  });

  describe('label computation', () => {
    it('should return "User Input" label for user block type', () => {
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello' }));
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.block-label');
      expect(label.textContent).toBe('User Input');
    });

    it('should return "Agent Response" label for model block type', () => {
      hostComponent.content.set(createTestContent({ role: 'model', text: 'Response' }));
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.block-label');
      expect(label.textContent).toBe('Agent Response');
    });

    it('should return "Tool Execution" label for tool block type', () => {
      hostComponent.content.set(
        createTestContent({
          role: 'model',
          functionCall: { name: 'test_tool' },
        }),
      );
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.block-label');
      expect(label.textContent).toBe('Tool Execution');
    });
  });

  describe('parts extraction', () => {
    it('should extract parts from content', () => {
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello' }));
      fixture.detectChanges();

      const textParts = fixture.nativeElement.querySelectorAll('[data-testid="text-part"]');
      expect(textParts.length).toBe(1);
    });

    it('should handle multiple parts', () => {
      const content: Content = {
        role: 'user',
        parts: [{ text: 'Part 1' }, { text: 'Part 2' }, { text: 'Part 3' }],
      };
      hostComponent.content.set(content);
      fixture.detectChanges();

      const textParts = fixture.nativeElement.querySelectorAll('[data-testid="text-part"]');
      expect(textParts.length).toBe(3);
    });

    it('should return empty array for undefined parts', () => {
      hostComponent.content.set({ role: 'user' });
      fixture.detectChanges();

      const textParts = fixture.nativeElement.querySelectorAll('[data-testid="text-part"]');
      expect(textParts.length).toBe(0);
    });
  });

  describe('text content rendering', () => {
    it('should render text content', () => {
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello World' }));
      fixture.detectChanges();

      const textContent = fixture.nativeElement.querySelector('.text-content');
      expect(textContent.textContent).toBe('Hello World');
    });

    it('should preserve whitespace in text content', () => {
      const textWithWhitespace = 'Line 1\n  Line 2\n    Line 3';
      hostComponent.content.set(createTestContent({ role: 'user', text: textWithWhitespace }));
      fixture.detectChanges();

      const textContent = fixture.nativeElement.querySelector('.text-content');
      expect(textContent.textContent).toBe(textWithWhitespace);
    });
  });

  describe('function call rendering', () => {
    it('should render function call name', () => {
      hostComponent.content.set(
        createTestContent({
          role: 'model',
          functionCall: { name: 'get_weather', args: { city: 'NYC' } },
        }),
      );
      fixture.detectChanges();

      const functionCall = fixture.nativeElement.querySelector('[data-testid="function-call"]');
      expect(functionCall).toBeTruthy();

      const functionName = functionCall.querySelector('.function-name');
      expect(functionName.textContent).toBe('get_weather');
    });

    it('should render function call args as formatted JSON', () => {
      const args = { city: 'NYC', units: 'fahrenheit' };
      hostComponent.content.set(
        createTestContent({
          role: 'model',
          functionCall: { name: 'get_weather', args },
        }),
      );
      fixture.detectChanges();

      const functionArgs = fixture.nativeElement.querySelector('.function-args');
      expect(functionArgs.textContent).toContain('"city": "NYC"');
      expect(functionArgs.textContent).toContain('"units": "fahrenheit"');
    });

    it('should handle function call with no args', () => {
      hostComponent.content.set(
        createTestContent({
          role: 'model',
          functionCall: { name: 'get_time' },
        }),
      );
      fixture.detectChanges();

      const functionCall = fixture.nativeElement.querySelector('[data-testid="function-call"]');
      expect(functionCall).toBeTruthy();

      const functionArgs = fixture.nativeElement.querySelector('.function-args');
      expect(functionArgs.textContent.trim()).toBe('');
    });
  });

  describe('function response rendering', () => {
    it('should render function response name', () => {
      hostComponent.content.set(
        createTestContent({
          role: 'user',
          functionResponse: { name: 'get_weather', response: { temp: 72 } },
        }),
      );
      fixture.detectChanges();

      const functionResponse = fixture.nativeElement.querySelector(
        '[data-testid="function-response"]',
      );
      expect(functionResponse).toBeTruthy();

      const functionName = functionResponse.querySelector('.function-name');
      expect(functionName.textContent).toBe('get_weather');
    });

    it('should render function response result as formatted JSON', () => {
      const response = { temp: 72, conditions: 'sunny' };
      hostComponent.content.set(
        createTestContent({
          role: 'user',
          functionResponse: { name: 'get_weather', response },
        }),
      );
      fixture.detectChanges();

      const functionResult = fixture.nativeElement.querySelector('.function-result');
      expect(functionResult.textContent).toContain('"temp": 72');
      expect(functionResult.textContent).toContain('"conditions": "sunny"');
    });
  });

  describe('styling', () => {
    it('should apply user styling class', () => {
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello' }));
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('user');
    });

    it('should apply model styling class', () => {
      hostComponent.content.set(createTestContent({ role: 'model', text: 'Response' }));
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('model');
    });

    it('should apply tool styling class for function call', () => {
      hostComponent.content.set(
        createTestContent({
          role: 'model',
          functionCall: { name: 'test_tool' },
        }),
      );
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('tool');
    });

    it('should apply tool styling class for function response', () => {
      hostComponent.content.set(
        createTestContent({
          role: 'user',
          functionResponse: { name: 'test_tool', response: {} },
        }),
      );
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('tool');
    });
  });

  describe('computed signal access', () => {
    it('should correctly compute blockType signal', () => {
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello' }));
      fixture.detectChanges();

      const debugChild = fixture.debugElement.children[0];
      expect(debugChild).toBeTruthy();
      const component = debugChild!.componentInstance as EventBlockComponent;
      expect(component.blockType()).toBe('user' as BlockType);
    });

    it('should correctly compute parts signal', () => {
      const content = createTestContent({ role: 'user', text: 'Hello' });
      hostComponent.content.set(content);
      fixture.detectChanges();

      const debugChild = fixture.debugElement.children[0];
      expect(debugChild).toBeTruthy();
      const component = debugChild!.componentInstance as EventBlockComponent;
      expect(component.parts().length).toBe(1);
    });

    it('should correctly compute icon signal', () => {
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello' }));
      fixture.detectChanges();

      const debugChild = fixture.debugElement.children[0];
      expect(debugChild).toBeTruthy();
      const component = debugChild!.componentInstance as EventBlockComponent;
      expect(component.icon()).toBe('person');
    });

    it('should correctly compute label signal', () => {
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello' }));
      fixture.detectChanges();

      const debugChild = fixture.debugElement.children[0];
      expect(debugChild).toBeTruthy();
      const component = debugChild!.componentInstance as EventBlockComponent;
      expect(component.label()).toBe('User Input');
    });
  });

  describe('reactivity', () => {
    it('should update when content changes', () => {
      // Start with user content
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello' }));
      fixture.detectChanges();

      let block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('user');

      // Change to model content
      hostComponent.content.set(createTestContent({ role: 'model', text: 'Response' }));
      fixture.detectChanges();

      block = fixture.nativeElement.querySelector('[data-testid="event-block"]');
      expect(block.getAttribute('data-type')).toBe('model');
    });

    it('should update icon and label when block type changes', () => {
      // Start with user content
      hostComponent.content.set(createTestContent({ role: 'user', text: 'Hello' }));
      fixture.detectChanges();

      let icon = fixture.nativeElement.querySelector('mat-icon');
      let label = fixture.nativeElement.querySelector('.block-label');
      expect(icon.textContent.trim()).toBe('person');
      expect(label.textContent).toBe('User Input');

      // Change to model with function call
      hostComponent.content.set(
        createTestContent({
          role: 'model',
          functionCall: { name: 'test_tool' },
        }),
      );
      fixture.detectChanges();

      icon = fixture.nativeElement.querySelector('mat-icon');
      label = fixture.nativeElement.querySelector('.block-label');
      expect(icon.textContent.trim()).toBe('build');
      expect(label.textContent).toBe('Tool Execution');
    });
  });
});
