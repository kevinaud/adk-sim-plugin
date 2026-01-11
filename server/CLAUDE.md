# Python Backend (server/)

Async gRPC server with SQLAlchemy persistence.

## Commands

```bash
uv sync                      # Install dependencies
uv run python -m adk_sim_server  # Run server
uv run pytest tests/         # Run all tests
uv run pytest tests/path/to/test.py -k test_name  # Run single test (preferred)
```

IMPORTANT: Always use `uv run` for script execution. Direct `pip install` is prohibited.

## Quality Tools

```bash
uv run ruff check .          # Linting
uv run ruff format .         # Formatting
uv run pyright               # Type checking (strict mode)
```

## Testing

- Follow Classicist testing (real implementations > fakes > mocks)
- Shared fakes MUST go in `tests/fixtures/`
- Ad-hoc inline fakes are prohibited
- Prefer running single tests over the whole suite for performance
- Test markers: `@pytest.mark.integration`, `@pytest.mark.e2e`

## Project Layout

```
server/
  src/adk_sim_server/
    main.py              # Entry point
    cli.py               # CLI interface
    services/            # gRPC service implementations
    persistence/         # SQLAlchemy database layer
    session_manager.py   # Session management
    broadcaster.py       # Event broadcasting
  tests/
    fixtures/            # Shared fakes go here
```
