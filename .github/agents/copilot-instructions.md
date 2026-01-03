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

Use the Makefile for all common operations:

```bash
make help           # Show all available commands
make generate       # Generate proto code (Python + TypeScript)
make server         # Start backend gRPC server
make frontend       # Start Angular dev server
make test           # Run all tests
make test-unit      # Run unit tests only
make test-int       # Run integration tests only
make quality        # Run all quality checks
make lint           # Run linters
make format         # Auto-format all code
make docker-up      # Start services via Docker Compose
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
