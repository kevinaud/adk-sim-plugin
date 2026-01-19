/**
 * SmartBlob component module
 *
 * Provides a component for rendering text content with auto-detection
 * and toggleable rendering modes (JSON, Markdown, Raw).
 *
 * @module ui/shared/smart-blob
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-012 through FR-014
 * @see mddocs/frontend/frontend-tdd.md#smartblobcomponent
 */

export { ContentDetectionService } from './content-detection.service';
export { MarkdownPipe } from './markdown.pipe';
export { SmartBlobComponent, type SmartBlobMode } from './smart-blob.component';
