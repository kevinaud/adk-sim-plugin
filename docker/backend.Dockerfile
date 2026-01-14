FROM python:3.14-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock ./
COPY packages/ ./packages/
COPY server/pyproject.toml ./server/
COPY plugins/python/pyproject.toml ./plugins/python/
COPY ops/pyproject.toml ./ops/

# Install dependencies (without project itself - installed later with source)
RUN uv sync --frozen --no-install-project

# Copy source (for initial build; volume mount overrides in dev)
COPY server/src/ ./server/src/
COPY plugins/python/src/ ./plugins/python/src/
COPY ops/src/ ./ops/src/

# Install the project itself now that source is available
RUN uv sync --frozen
