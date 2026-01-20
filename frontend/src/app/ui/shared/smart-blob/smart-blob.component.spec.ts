/**
 * @fileoverview Tests for SmartBlobComponent and ContentDetectionService.
 *
 * Tests verify:
 * - Content detection logic for JSON and markdown
 * - Mode toggle functionality
 * - Auto-detection of best mode on content change
 * - Rendering of each mode (JSON, Markdown, Raw)
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-012 through FR-014
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContentDetectionService } from './content-detection.service';
import { SmartBlobComponent } from './smart-blob.component';

/**
 * Test host component that wraps SmartBlobComponent.
 * Allows testing input binding behavior.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [SmartBlobComponent],
  template: `<app-smart-blob [content]="content()" />`,
})
class TestHostComponent {
  readonly content = signal<string>('');
}

describe('ContentDetectionService', () => {
  let service: ContentDetectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContentDetectionService],
    });
    service = TestBed.inject(ContentDetectionService);
  });

  describe('isJson', () => {
    it('should return true for valid JSON object', () => {
      expect(service.isJson('{"key": "value"}')).toBe(true);
    });

    it('should return true for valid JSON array', () => {
      expect(service.isJson('[1, 2, 3]')).toBe(true);
    });

    it('should return true for complex nested JSON', () => {
      const json = JSON.stringify({ user: { name: 'Bob', roles: ['admin', 'user'] } });
      expect(service.isJson(json)).toBe(true);
    });

    it('should return false for primitive JSON values', () => {
      expect(service.isJson('null')).toBe(false);
      expect(service.isJson('true')).toBe(false);
      expect(service.isJson('"string"')).toBe(false);
      expect(service.isJson('123')).toBe(false);
    });

    it('should return false for invalid JSON', () => {
      expect(service.isJson('not json')).toBe(false);
      expect(service.isJson('{invalid}')).toBe(false);
      expect(service.isJson('{"key": undefined}')).toBe(false);
    });

    it('should return false for empty input', () => {
      expect(service.isJson('')).toBe(false);
      expect(service.isJson(null as unknown as string)).toBe(false);
      expect(service.isJson(undefined as unknown as string)).toBe(false);
    });

    it('should handle JSON with leading/trailing whitespace', () => {
      expect(service.isJson('  {"key": "value"}  ')).toBe(true);
      expect(service.isJson('\n[1, 2, 3]\n')).toBe(true);
    });
  });

  describe('parseJson', () => {
    it('should parse valid JSON and return object', () => {
      const result = service.parseJson('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should return null for invalid JSON', () => {
      expect(service.parseJson('not json')).toBeNull();
    });
  });

  describe('isMarkdown', () => {
    it('should detect headers', () => {
      expect(service.isMarkdown('# Header')).toBe(true);
      expect(service.isMarkdown('## Second Level')).toBe(true);
      expect(service.isMarkdown('###### H6')).toBe(true);
    });

    it('should detect bold text', () => {
      expect(service.isMarkdown('This is **bold** text')).toBe(true);
      expect(service.isMarkdown('This is __bold__ text')).toBe(true);
    });

    it('should detect italic text', () => {
      expect(service.isMarkdown('This is *italic* text')).toBe(true);
      expect(service.isMarkdown('This is _italic_ text')).toBe(true);
    });

    it('should detect links', () => {
      expect(service.isMarkdown('Check [this link](https://example.com)')).toBe(true);
      expect(service.isMarkdown('See [ref][1]')).toBe(true);
    });

    it('should detect images', () => {
      expect(service.isMarkdown('![alt text](image.png)')).toBe(true);
    });

    it('should detect code blocks', () => {
      expect(service.isMarkdown('```javascript\ncode\n```')).toBe(true);
      expect(service.isMarkdown('Use `inline code` here')).toBe(true);
    });

    it('should detect lists', () => {
      expect(service.isMarkdown('- Item 1\n- Item 2')).toBe(true);
      expect(service.isMarkdown('* Item 1\n* Item 2')).toBe(true);
      expect(service.isMarkdown('1. First\n2. Second')).toBe(true);
    });

    it('should detect blockquotes', () => {
      expect(service.isMarkdown('> This is a quote')).toBe(true);
    });

    it('should detect tables', () => {
      expect(service.isMarkdown('| Col1 | Col2 |')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(service.isMarkdown('Just plain text without formatting')).toBe(false);
      expect(service.isMarkdown('Hello world')).toBe(false);
    });

    it('should return false for empty input', () => {
      expect(service.isMarkdown('')).toBe(false);
      expect(service.isMarkdown(null as unknown as string)).toBe(false);
    });
  });

  describe('detectBestMode', () => {
    it('should prefer JSON for valid JSON content', () => {
      expect(service.detectBestMode('{"key": "value"}')).toBe('json');
    });

    it('should prefer markdown for markdown content', () => {
      expect(service.detectBestMode('# Header\n\nSome text')).toBe('markdown');
    });

    it('should return raw for plain text', () => {
      expect(service.detectBestMode('Just plain text')).toBe('raw');
    });

    it('should prefer JSON over markdown when content is valid JSON', () => {
      // Even if JSON looks like it could have markdown patterns
      const json = '{"title": "# Heading", "content": "**bold**"}';
      expect(service.detectBestMode(json)).toBe('json');
    });
  });
});

describe('SmartBlobComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, SmartBlobComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    hostComponent.content.set('test content');
    fixture.detectChanges();
    const smartBlob = fixture.nativeElement.querySelector('app-smart-blob');
    expect(smartBlob).toBeTruthy();
  });

  describe('mode toggles', () => {
    it('should always show RAW toggle', () => {
      hostComponent.content.set('plain text');
      fixture.detectChanges();

      const rawToggle = fixture.nativeElement.querySelector('[data-testid="raw-toggle"]');
      expect(rawToggle).toBeTruthy();
    });

    it('should show JSON toggle for valid JSON', () => {
      hostComponent.content.set('{"key": "value"}');
      fixture.detectChanges();

      const jsonToggle = fixture.nativeElement.querySelector('[data-testid="json-toggle"]');
      expect(jsonToggle).toBeTruthy();
    });

    it('should not show JSON toggle for non-JSON content', () => {
      hostComponent.content.set('not json');
      fixture.detectChanges();

      const jsonToggle = fixture.nativeElement.querySelector('[data-testid="json-toggle"]');
      expect(jsonToggle).toBeNull();
    });

    it('should show MD toggle for markdown content', () => {
      hostComponent.content.set('# Header\n\nParagraph text');
      fixture.detectChanges();

      const mdToggle = fixture.nativeElement.querySelector('[data-testid="markdown-toggle"]');
      expect(mdToggle).toBeTruthy();
    });

    it('should not show MD toggle for plain text', () => {
      hostComponent.content.set('plain text without markdown');
      fixture.detectChanges();

      const mdToggle = fixture.nativeElement.querySelector('[data-testid="markdown-toggle"]');
      expect(mdToggle).toBeNull();
    });
  });

  describe('auto mode detection', () => {
    it('should auto-select JSON mode for JSON content', async () => {
      hostComponent.content.set('{"name": "test"}');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const jsonView = fixture.nativeElement.querySelector('[data-testid="json-view"]');
      expect(jsonView).toBeTruthy();
    });

    it('should auto-select markdown mode for markdown content', async () => {
      hostComponent.content.set('# Welcome\n\nThis is **markdown**');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const mdView = fixture.nativeElement.querySelector('[data-testid="markdown-view"]');
      expect(mdView).toBeTruthy();
    });

    it('should auto-select raw mode for plain text', async () => {
      hostComponent.content.set('Just plain text');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const rawView = fixture.nativeElement.querySelector('[data-testid="raw-view"]');
      expect(rawView).toBeTruthy();
    });
  });

  describe('mode switching', () => {
    it('should switch to raw mode when RAW toggle is clicked', async () => {
      hostComponent.content.set('{"key": "value"}');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Should start in JSON mode
      expect(fixture.nativeElement.querySelector('[data-testid="json-view"]')).toBeTruthy();

      // Click RAW toggle
      const rawToggle = fixture.nativeElement.querySelector('[data-testid="raw-toggle"]');
      rawToggle.click();
      fixture.detectChanges();

      // Should now show raw view
      expect(fixture.nativeElement.querySelector('[data-testid="raw-view"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="json-view"]')).toBeNull();
    });

    it('should switch to JSON mode when JSON toggle is clicked', async () => {
      hostComponent.content.set('{"key": "value"}');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Switch to raw first
      const rawToggle = fixture.nativeElement.querySelector('[data-testid="raw-toggle"]');
      rawToggle.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="raw-view"]')).toBeTruthy();

      // Now switch back to JSON
      const jsonToggle = fixture.nativeElement.querySelector('[data-testid="json-toggle"]');
      jsonToggle.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="json-view"]')).toBeTruthy();
    });

    it('should mark active toggle button', async () => {
      hostComponent.content.set('{"key": "value"}');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const jsonToggle = fixture.nativeElement.querySelector('[data-testid="json-toggle"]');
      expect(jsonToggle.classList.contains('active')).toBe(true);

      const rawToggle = fixture.nativeElement.querySelector('[data-testid="raw-toggle"]');
      expect(rawToggle.classList.contains('active')).toBe(false);
    });
  });

  describe('content rendering', () => {
    it('should render JSON as DataTreeComponent', async () => {
      hostComponent.content.set('{"name":"test","value":123}');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // JSON view should contain the DataTreeComponent
      const jsonView = fixture.nativeElement.querySelector('[data-testid="json-view"]');
      expect(jsonView).toBeTruthy();
      expect(jsonView.tagName.toLowerCase()).toBe('app-data-tree');

      // DataTree should render the tree nodes
      const treeNodes = jsonView.querySelectorAll('[data-testid="tree-node"]');
      expect(treeNodes.length).toBeGreaterThan(0);
    });

    it('should render markdown as HTML', async () => {
      hostComponent.content.set('# Hello World');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const mdView = fixture.nativeElement.querySelector('[data-testid="markdown-view"]');
      // marked renders # as <h1>
      expect(mdView.innerHTML).toContain('<h1');
      expect(mdView.innerHTML).toContain('Hello World');
    });

    it('should preserve whitespace in raw mode', async () => {
      const content = 'Line 1\n  Indented\n    More indent';
      hostComponent.content.set(content);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Switch to raw mode
      const rawToggle = fixture.nativeElement.querySelector('[data-testid="raw-toggle"]');
      rawToggle.click();
      fixture.detectChanges();

      const rawView = fixture.nativeElement.querySelector('[data-testid="raw-view"]');
      expect(rawView.textContent).toBe(content);
    });
  });
});
