# ADK Agent Simulator

A simulation server for testing ADK-based agents with gRPC streaming.

## Installation

Install from PyPI:

```bash
# Using uv (recommended)
uv add adk-sim-server --prerelease=allow

# Using pip
pip install adk-sim-server --pre
```

> **Note**: The `--prerelease=allow` (uv) or `--pre` (pip) flag is required because this package depends on `betterproto>=2.0.0b7`, which is a pre-release version.

## Usage

```bash
# Start the simulator server
adk-sim --port 50051 --web-port 8080

# Or with uv
uv run adk-sim --help
```

## Development Setup

1. Install `uv` if you haven't already.
2. Run `uv sync` to install dependencies.
3. Copy `.env.example` to `.env` and fill in the values.

## Development

### Quality Checks

Run the quality check script:
```bash
./scripts/check_quality.sh
```

### Testing

Run tests:
```bash
uv run pytest
```

Run integration tests:
```bash
uv run pytest --run-integration
```
