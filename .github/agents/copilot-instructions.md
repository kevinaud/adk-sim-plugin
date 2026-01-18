# adk-sim-plugin Development Guidelines

ADK Agent Simulator - Remote Brain Protocol

## Active Technologies

- **Backend**: Python 3.14 + grpclib (async gRPC), betterproto (proto codegen), Pydantic
- **Frontend**: Angular + TypeScript
- **Proto**: buf for linting/generation
- **Testing**: pytest, pytest-asyncio
- **Quality**: ruff (linting/formatting), pyright (type checking), ESLint (TypeScript)

## Project Structure

```text
adk_agent_sim/          # Python backend package
  ├── plugin/           # Plugin system core
  ├── server/           # gRPC server and services
  │   └── services/     # Service implementations
  ├── settings.py       # Configuration
  └── generated/        # Auto-generated proto code (Python)
frontend/               # Angular frontend
  └── src/app/
      └── generated/    # Auto-generated proto code (TypeScript)
protos/                 # Protocol buffer definitions
  └── adksim/v1/
tests/                  # Test suite
  ├── unit/             # Unit tests
  └── integration/      # Integration tests
docs/                   # Documentation
specs/                  # Feature specifications
scripts/                # Build/quality scripts
docker/                 # Dockerfiles
```

## Commands

Use the `ops` CLI for all common operations:

```bash
ops --help              # Show all available commands
ops build protos        # Generate proto code (Python + TypeScript)
ops dev server          # Start backend gRPC server
ops dev frontend        # Start Angular dev server
ops quality test        # Run all tests
ops quality test unit   # Run unit tests only
ops quality test integration  # Run integration tests only
ops quality             # Run quality checks (via jj quality)
ops docker up           # Start services via Docker Compose
```

Quality gates are defined in `.jj/repo/config.toml` (jj-native quality gates):

```bash
jj fix                  # Auto-format modified files
jj quality              # Quick quality check (format + lint + type-check)
jj secure-push          # Full verification pipeline + push (must pass before push)
ops ci check            # CI-style full validation (equivalent to jj secure-push without push)
```

Direct commands (when needed):

```bash
uv run pytest                    # Run tests
uv run ruff check .              # Lint Python
uv run ruff format .             # Format Python
uv run pyright                   # Type check Python
cd frontend && npm run lint      # Lint TypeScript
cd frontend && npm run format    # Format TypeScript
buf lint                         # Lint protos
buf generate                     # Generate proto code
```

## Code Style

- **Python 3.14**: Modern syntax, use `|` for unions, builtin generics (not `typing.List`), no `__future__` imports
- **TypeScript**: ESLint + Prettier conventions
- **Protos**: buf STANDARD + COMMENTS rules, versioned packages (v1, v1beta1)

## Testing

- Tests mirror source structure: `tests/unit/server/` tests `adk_agent_sim/server/`
- Use `pytest-asyncio` for async tests (`asyncio_mode = "auto"`)
- Integration tests marked with `@pytest.mark.integration`

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
