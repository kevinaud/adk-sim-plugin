# Angular Frontend (frontend/)

Angular 21 SPA with Material Design and Connect-RPC for gRPC-web communication.

## Before Starting Work

1. **Load the angular-expert skill** using `/angular-expert` before writing or modifying Angular code
2. **Check mddocs/frontend/** for relevant documentation about the feature or component you're working on

## Commands

```bash
npm install                  # Install dependencies
npm start                    # Development server
npm run build                # Production build
npm test                     # Run tests (Vitest)
npm run lint                 # ESLint
npm run format               # Prettier formatting
```

## Angular Patterns (MANDATORY)

### Lifecycle Management
Use `DestroyRef` and `takeUntilDestroyed` - implementing `OnDestroy` is PROHIBITED:
```typescript
// Required pattern
private readonly destroyRef = inject(DestroyRef);
constructor() {
  this.destroyRef.onDestroy(() => { /* cleanup */ });
}
```

### Dependency Injection
Use `inject()` function - constructor injection is PROHIBITED:
```typescript
// Required
private readonly userService = inject(UserService);

// Prohibited
constructor(private service: UserService) {}
```

### Signals
Private writable, public readonly pattern:
```typescript
private readonly _state = signal<T>(initial);
readonly state = this._state.asReadonly();
```

Explicit generic types for nullable computed signals:
```typescript
readonly item = computed<Item | undefined>(() => this.items().find(i => i.active));
```

### Template Control Flow
Use `@if`, `@for`, `@switch` - structural directives (`*ngIf`, `*ngFor`) are PROHIBITED.

### Streaming Data
Use `AbortController` tied to `DestroyRef` for async iterables:
```typescript
async consumeStream(stream: AsyncIterable<Event>) {
  const abort = new AbortController();
  this.destroyRef.onDestroy(() => abort.abort());
  for await (const event of stream) {
    if (abort.signal.aborted) break;
    // process
  }
}
```

## Project Layout

```
frontend/src/
  app/
    app.ts               # Root component
    app.routes.ts        # Routing
    app.config.ts        # Configuration
    generated/           # Auto-generated proto code
  environments/          # Environment configs
```
