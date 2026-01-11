---
title: JSONForms Library Research
type: research
parent: ../frontend-tdd.md
related:
  - ../frontend-spec.md
  - ./converter-research.md
  - ./adk-typescript-research.md
---

# JSONForms Library Research


## Table of Contents

- [Executive Summary](#executive-summary)
- [Library Overview](#library-overview)
  - [Package Structure](#package-structure)
  - [Version & Compatibility](#version-compatibility)
- [Core Concepts](#core-concepts)
  - [1. Data Schema (JSON Schema)](#1-data-schema-json-schema)
  - [2. UI Schema](#2-ui-schema)
  - [3. Renderers](#3-renderers)
- [Angular Integration](#angular-integration)
  - [Basic Usage](#basic-usage)
  - [Module Setup](#module-setup)
- [Schema Conversion Challenge](#schema-conversion-challenge)
  - [The Problem](#the-problem)
  - [Proto Type Enum → JSON Schema Type](#proto-type-enum-json-schema-type)
  - [Conversion Function](#conversion-function)
- [Use Case: Tool Invocation Forms](#use-case-tool-invocation-forms)
  - [Flow](#flow)
  - [Implementation](#implementation)
  - [Component](#component)
- [Use Case: Final Response Forms](#use-case-final-response-forms)
  - [Default Case (No output_schema)](#default-case-no-outputschema)
  - [Structured Response (With output_schema)](#structured-response-with-outputschema)
- [Custom Renderers](#custom-renderers)
  - [Example: Markdown Editor Renderer](#example-markdown-editor-renderer)
- [UI Schema Generation Strategy](#ui-schema-generation-strategy)
  - [Auto-Generation Benefits](#auto-generation-benefits)
  - [When to Customize](#when-to-customize)
  - [Hybrid Approach](#hybrid-approach)
- [Validation](#validation)
  - [Validation Modes](#validation-modes)
- [Integration with adk-converters-ts](#integration-with-adk-converters-ts)
  - [Package Dependencies](#package-dependencies)
- [Implementation Recommendations](#implementation-recommendations)
  - [1. Package Installation](#1-package-installation)
  - [2. Module Setup](#2-module-setup)
  - [3. Create Schema Converter](#3-create-schema-converter)
  - [4. Wrapper Components](#4-wrapper-components)
- [Open Questions](#open-questions)
- [References](#references)

## Executive Summary

**Recommendation**: Adopt `@jsonforms/angular-material` v3.7.0 for dynamic form generation.

| Aspect | Finding |
|--------|---------|
| Angular 21 Support | ✅ Peer dep: `^19.0.0 \|\| ^20.0.0 \|\| ^21.0.0` |
| Material Design | ✅ Full Angular Material integration |
| JSON Schema Compatibility | ⚠️ Requires conversion from proto Schema to JSON Schema |
| UI Schema Auto-Generation | ✅ `generateDefaultUISchema()` available |
| Form Validation | ✅ AJV-based validation built-in |
| Custom Renderers | ✅ Extensible renderer system |

---

## Library Overview

### Package Structure

```
@jsonforms/core          # Framework-agnostic core (schemas, state, validation)
@jsonforms/angular       # Angular base classes and directives
@jsonforms/angular-material  # Material Design renderers
```

### Version & Compatibility

From `packages/angular-material/package.json`:

```json
{
  "name": "@jsonforms/angular-material",
  "version": "3.7.0",
  "peerDependencies": {
    "@angular/core": "^19.0.0 || ^20.0.0 || ^21.0.0",
    "@angular/material": "^19.0.0 || ^20.0.0 || ^21.0.0",
    "@jsonforms/angular": "3.7.0",
    "@jsonforms/core": "3.7.0"
  }
}
```

---

## Core Concepts

### 1. Data Schema (JSON Schema)

JSONForms uses standard [JSON Schema](https://json-schema.org/) to describe data structure:

```typescript
// Example: Tool parameter schema
const schema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'The search query',
    },
    maxResults: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    filters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['books', 'movies', 'music'],
        },
        inStock: {
          type: 'boolean',
        },
      },
    },
  },
  required: ['query'],
};
```

### 2. UI Schema

Controls form layout and appearance. Can be auto-generated or explicitly defined:

```typescript
// Auto-generated (default vertical layout)
import { generateDefaultUISchema } from '@jsonforms/core';
const uischema = generateDefaultUISchema(schema);

// Explicit UI Schema
const uischema = {
  type: 'VerticalLayout',
  elements: [
    {
      type: 'Control',
      scope: '#/properties/query',
      options: {
        multi: true,  // textarea
      },
    },
    {
      type: 'HorizontalLayout',
      elements: [
        { type: 'Control', scope: '#/properties/maxResults' },
        { type: 'Control', scope: '#/properties/filters/properties/category' },
      ],
    },
  ],
};
```

### 3. Renderers

Renderers map schema types to Angular components. The library provides built-in renderers for all primitive types:

| Schema Type | Renderer | Material Component |
|-------------|----------|-------------------|
| `string` | `TextControlRenderer` | `mat-input` |
| `string` (multiline) | `TextAreaRenderer` | `mat-textarea` |
| `string` (enum) | `AutocompleteControlRenderer` | `mat-autocomplete` |
| `number`/`integer` | `NumberControlRenderer` | `mat-input[type=number]` |
| `boolean` | `BooleanControlRenderer` | `mat-checkbox` |
| `boolean` (toggle) | `ToggleControlRenderer` | `mat-slide-toggle` |
| `object` | `ObjectControlRenderer` | Nested form group |
| `array` | `ArrayLayoutRenderer` | Dynamic list with add/remove |

---

## Angular Integration

### Basic Usage

```typescript
import { Component, signal } from '@angular/core';
import { JsonFormsModule } from '@jsonforms/angular';
import { angularMaterialRenderers } from '@jsonforms/angular-material';

@Component({
  selector: 'app-tool-form',
  standalone: true,
  imports: [JsonFormsModule],
  template: `
    <jsonforms
      [schema]="schema"
      [uischema]="uischema"
      [data]="formData()"
      [renderers]="renderers"
      (dataChange)="onDataChange($event)"
      (errors)="onErrors($event)"
    />
  `,
})
export class ToolFormComponent {
  readonly renderers = angularMaterialRenderers;
  readonly schema = { /* JSON Schema */ };
  readonly uischema = { /* UI Schema */ };
  
  readonly formData = signal<unknown>({});
  
  onDataChange(data: unknown): void {
    this.formData.set(data);
  }
  
  onErrors(errors: ErrorObject[]): void {
    console.log('Validation errors:', errors);
  }
}
```

### Module Setup

```typescript
// app.config.ts
import { provideAnimations } from '@angular/platform-browser/animations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),  // Required for Material
    // ... other providers
  ],
};
```

---

## Schema Conversion Challenge

### The Problem

Our proto-generated Schema type differs from JSON Schema:

| Proto Schema Field | JSON Schema Equivalent |
|-------------------|------------------------|
| `type: Type` (enum) | `type: string` |
| `items: Schema` | `items: JsonSchema` |
| `properties: { [key: string]: Schema }` | `properties: { [key: string]: JsonSchema }` |
| `maxItems: bigint` | `maxItems: number` |
| `minItems: bigint` | `minItems: number` |
| `minimum?: number` | `minimum?: number` |
| `maximum?: number` | `maximum?: number` |

### Proto Type Enum → JSON Schema Type

```typescript
// From generated proto
enum Type {
  TYPE_UNSPECIFIED = 0,
  STRING = 1,
  NUMBER = 2,
  INTEGER = 3,
  BOOLEAN = 4,
  ARRAY = 5,
  OBJECT = 6,
}

// Required JSON Schema type values
type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
```

### Conversion Function

```typescript
// packages/adk-sim-converters/src/schema-converter.ts
import type { Schema, Type } from '@adk-sim/protos';
import type { JsonSchema7 } from '@jsonforms/core';

const TYPE_MAP: Record<Type, JsonSchemaType> = {
  [Type.TYPE_UNSPECIFIED]: 'object',  // fallback
  [Type.STRING]: 'string',
  [Type.NUMBER]: 'number',
  [Type.INTEGER]: 'integer',
  [Type.BOOLEAN]: 'boolean',
  [Type.ARRAY]: 'array',
  [Type.OBJECT]: 'object',
};

export function protoSchemaToJsonSchema(protoSchema: Schema): JsonSchema7 {
  const jsonSchema: JsonSchema7 = {
    type: TYPE_MAP[protoSchema.type],
  };

  // Optional fields
  if (protoSchema.title) {
    jsonSchema.title = protoSchema.title;
  }
  if (protoSchema.description) {
    jsonSchema.description = protoSchema.description;
  }
  if (protoSchema.format) {
    jsonSchema.format = protoSchema.format;
  }
  if (protoSchema.nullable) {
    // JSON Schema 7 uses oneOf with null type
    jsonSchema.oneOf = [
      { type: TYPE_MAP[protoSchema.type] },
      { type: 'null' },
    ];
    delete jsonSchema.type;
  }

  // Enum
  if (protoSchema.enum.length > 0) {
    jsonSchema.enum = protoSchema.enum;
  }

  // Array items
  if (protoSchema.items) {
    jsonSchema.items = protoSchemaToJsonSchema(protoSchema.items);
  }
  if (protoSchema.maxItems > 0n) {
    jsonSchema.maxItems = Number(protoSchema.maxItems);
  }
  if (protoSchema.minItems > 0n) {
    jsonSchema.minItems = Number(protoSchema.minItems);
  }

  // Object properties
  if (Object.keys(protoSchema.properties).length > 0) {
    jsonSchema.properties = {};
    for (const [key, value] of Object.entries(protoSchema.properties)) {
      jsonSchema.properties[key] = protoSchemaToJsonSchema(value);
    }
  }
  if (protoSchema.required.length > 0) {
    jsonSchema.required = protoSchema.required;
  }

  // Numeric constraints
  if (protoSchema.minimum !== undefined) {
    jsonSchema.minimum = protoSchema.minimum;
  }
  if (protoSchema.maximum !== undefined) {
    jsonSchema.maximum = protoSchema.maximum;
  }

  return jsonSchema;
}
```

---

## Use Case: Tool Invocation Forms

### Flow

```
FunctionDeclaration (proto)
    │
    ▼ Extract parameters
FunctionDeclaration.parameters (Schema proto)
    │
    ▼ protoSchemaToJsonSchema()
JSON Schema (for JSONForms)
    │
    ▼ generateDefaultUISchema()
UI Schema (auto-generated)
    │
    ▼ <jsonforms>
Dynamic Form UI
    │
    ▼ (user input)
Form Data
    │
    ▼ Submit
FunctionCall args (to server)
```

### Implementation

```typescript
// data-access/tool-form/tool-form.service.ts
import { Injectable, inject } from '@angular/core';
import { generateDefaultUISchema, type JsonSchema7 } from '@jsonforms/core';
import type { FunctionDeclaration } from '@adk-sim/protos';
import { protoSchemaToJsonSchema } from '@adk-sim/converters';

export interface ToolFormConfig {
  schema: JsonSchema7;
  uischema: UISchemaElement;
  toolName: string;
  toolDescription: string;
}

@Injectable({ providedIn: 'root' })
export class ToolFormService {
  /**
   * Create JSONForms configuration from a tool's FunctionDeclaration
   */
  createFormConfig(tool: FunctionDeclaration): ToolFormConfig {
    // Handle both parametersJsonSchema and parameters fields
    let jsonSchema: JsonSchema7;
    
    if (tool.parametersJsonSchema) {
      // Tool already provides JSON Schema directly
      jsonSchema = tool.parametersJsonSchema as JsonSchema7;
    } else if (tool.parameters) {
      // Convert proto Schema to JSON Schema
      jsonSchema = protoSchemaToJsonSchema(tool.parameters);
    } else {
      // No parameters - empty object schema
      jsonSchema = { type: 'object', properties: {} };
    }

    return {
      schema: jsonSchema,
      uischema: generateDefaultUISchema(jsonSchema),
      toolName: tool.name,
      toolDescription: tool.description,
    };
  }
}
```

### Component

```typescript
// ui/control-panel/tool-form/tool-form.component.ts
@Component({
  selector: 'app-tool-form',
  standalone: true,
  imports: [JsonFormsModule],
  template: `
    <div class="tool-form">
      <h4>{{ config().toolName }}</h4>
      @if (config().toolDescription) {
        <p class="description">{{ config().toolDescription }}</p>
      }
      
      <jsonforms
        [schema]="config().schema"
        [uischema]="config().uischema"
        [data]="formData()"
        [renderers]="renderers"
        (dataChange)="formData.set($event)"
        (errors)="errors.set($event)"
      />
      
      <button
        mat-raised-button
        color="primary"
        [disabled]="errors().length > 0"
        (click)="submit()"
      >
        Invoke Tool
      </button>
    </div>
  `,
})
export class ToolFormComponent {
  readonly renderers = angularMaterialRenderers;
  
  readonly config = input.required<ToolFormConfig>();
  readonly formData = signal<unknown>({});
  readonly errors = signal<ErrorObject[]>([]);
  
  readonly invokeOutput = output<{ toolName: string; args: unknown }>();
  
  submit(): void {
    this.invokeOutput.emit({
      toolName: this.config().toolName,
      args: this.formData(),
    });
  }
}
```

---

## Use Case: Final Response Forms

### Default Case (No output_schema)

When no `output_schema` is defined, provide a simple textarea:

```typescript
@Component({
  selector: 'app-final-response',
  template: `
    @if (hasOutputSchema()) {
      <app-schema-form
        [schema]="outputSchema()"
        (submit)="onStructuredSubmit($event)"
      />
    } @else {
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Final Response</mat-label>
        <textarea
          matInput
          [value]="textResponse()"
          (input)="textResponse.set($any($event.target).value)"
          rows="6"
        ></textarea>
      </mat-form-field>
      <button mat-raised-button color="primary" (click)="onTextSubmit()">
        Submit Response
      </button>
    }
  `,
})
export class FinalResponseComponent {
  readonly outputSchema = input<JsonSchema7 | null>(null);
  
  readonly hasOutputSchema = computed(() => this.outputSchema() !== null);
  readonly textResponse = signal('');
  
  readonly submitText = output<string>();
  readonly submitStructured = output<unknown>();
  
  onTextSubmit(): void {
    this.submitText.emit(this.textResponse());
  }
  
  onStructuredSubmit(data: unknown): void {
    this.submitStructured.emit(data);
  }
}
```

### Structured Response (With output_schema)

When `config.responseSchema` is defined in the `LlmRequest`:

```typescript
// In session component or store
readonly outputSchema = computed(() => {
  const request = this.store.currentRequest();
  if (!request?.config?.responseSchema) return null;
  
  // responseSchema might be @google/genai Schema type or already JSON Schema
  // Need to handle both cases
  return this.schemaService.ensureJsonSchema(request.config.responseSchema);
});
```

---

## Custom Renderers

JSONForms allows custom renderers for specific fields or types. This is useful for:

1. **Rich text editor** for long-form text fields
2. **Code editor** for code/JSON fields
3. **File picker** for file path fields

### Example: Markdown Editor Renderer

```typescript
// ui/jsonforms-renderers/markdown-renderer.component.ts
import { Component } from '@angular/core';
import { JsonFormsAngularService, JsonFormsControl } from '@jsonforms/angular';
import { rankWith, scopeEndsWith } from '@jsonforms/core';

@Component({
  selector: 'app-markdown-renderer',
  template: `
    <div class="markdown-field">
      <label>{{ label }}</label>
      <app-markdown-editor
        [value]="data"
        (valueChange)="onChange($event)"
      />
      @if (error) {
        <mat-error>{{ error }}</mat-error>
      }
    </div>
  `,
})
export class MarkdownRendererComponent extends JsonFormsControl {
  constructor(service: JsonFormsAngularService) {
    super(service);
  }
  
  onChange(value: string): void {
    this.jsonFormsService.updateCore(
      Actions.update(this.propsPath, () => value)
    );
  }
}

// Tester: use for fields ending with 'markdown' or 'description'
export const markdownTester = rankWith(
  5,  // Priority (higher = more specific)
  scopeEndsWith('markdown')
);

// Register in renderers array
export const customRenderers = [
  ...angularMaterialRenderers,
  { tester: markdownTester, renderer: MarkdownRendererComponent },
];
```

---

## UI Schema Generation Strategy

### Auto-Generation Benefits

- **Zero configuration** for simple schemas
- **Consistent layout** across all forms
- **Automatic field ordering** based on schema

### When to Customize

| Scenario | UI Schema Customization |
|----------|------------------------|
| Complex nested objects | Use `GroupLayout` for visual separation |
| Related fields | Use `HorizontalLayout` for side-by-side |
| Conditional visibility | Add `rule` with show/hide conditions |
| Read-only fields | Add `options: { readonly: true }` |
| Textarea vs input | Add `options: { multi: true }` |

### Hybrid Approach

```typescript
export function createToolUiSchema(schema: JsonSchema7, toolName: string): UISchemaElement {
  // Start with auto-generated
  const autoSchema = generateDefaultUISchema(schema);
  
  // Wrap in a Group with tool name as label
  return {
    type: 'Group',
    label: toolName,
    elements: [autoSchema],
  };
}
```

---

## Validation

JSONForms uses [AJV](https://ajv.js.org/) for JSON Schema validation:

```typescript
// Custom AJV instance with formats
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
});
addFormats(ajv);

// Pass to JSONForms
<jsonforms
  [ajv]="ajv"
  [validationMode]="'ValidateAndShow'"
  ...
/>
```

### Validation Modes

| Mode | Behavior |
|------|----------|
| `ValidateAndShow` | Validate on change, show errors immediately |
| `ValidateAndHide` | Validate but hide errors until submit |
| `NoValidation` | Skip validation entirely |

---

## Integration with adk-converters-ts

Per [Converter Research](./converter-research.md#adding-adk-converters-ts), add schema conversion to the shared package:

```typescript
// packages/adk-sim-converters/src/index.ts
export { protoToLlmRequest, llmResponseToProto } from './request-converter';
export { protoSchemaToJsonSchema, jsonSchemaToProtoSchema } from './schema-converter';
export type { ToolFormConfig } from './types';
```

### Package Dependencies

```json
{
  "name": "@adk-sim/converters",
  "dependencies": {
    "@adk-sim/protos": "workspace:*",
    "@jsonforms/core": "^3.7.0"
  },
  "peerDependencies": {
    "@google/adk": "^0.2.2"
  }
}
```

---

## Implementation Recommendations

### 1. Package Installation

```bash
pnpm add @jsonforms/core @jsonforms/angular @jsonforms/angular-material
```

### 2. Module Setup

```typescript
// features/session/session.component.ts
import { JsonFormsModule } from '@jsonforms/angular';
import { JsonFormsAngularMaterialModule } from '@jsonforms/angular-material';

@Component({
  imports: [
    JsonFormsModule,
    JsonFormsAngularMaterialModule,
    // ...
  ],
})
export class SessionComponent { }
```

### 3. Create Schema Converter

Add to `@adk-sim/converters` package with:
- `protoSchemaToJsonSchema()` - for tool parameters → form schema
- `protoResponseSchemaToJsonSchema()` - for output_schema → form schema
- Type guards for `FunctionDeclaration` fields

### 4. Wrapper Components

Create thin wrapper components that:
- Accept proto types (`FunctionDeclaration`)
- Convert to JSON Schema internally
- Emit form data on submit
- Handle validation state

---

## Open Questions

1. **Enum Rendering**: Use autocomplete (default) or radio buttons for small enums?
   - Consider: Add UI Schema option for `format: 'radio'` on small enums (<5 options)

2. **Array Items**: Use table layout or list layout for arrays of objects?
   - JSONForms provides both via `ArrayLayoutRenderer` and `TableRenderer`

3. **Nested Objects Depth**: How deep to render nested objects inline vs collapsible?
   - Consider: Use `ObjectControlRenderer` with `options.detail` for deep nesting

4. **Required Field Indicator**: Use asterisk (default) or different styling?
   - Configurable via JSONForms config: `{ hideRequiredAsterisk: false }`

---

## References

- [JSONForms Documentation](https://jsonforms.io/docs/)
- [JSONForms Angular Integration](https://jsonforms.io/docs/integrations/angular)
- [JSONForms Examples](https://jsonforms.io/examples/basic)
- [JSON Schema Specification](https://json-schema.org/specification.html)
- [GitHub: eclipsesource/jsonforms](https://github.com/eclipsesource/jsonforms)
