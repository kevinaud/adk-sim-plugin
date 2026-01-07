FROM python:3.14-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy workspace dependency files
COPY pyproject.toml uv.lock ./

# Copy workspace packages
COPY packages/ ./packages/
COPY server/pyproject.toml ./server/pyproject.toml

# Install dependencies (without project itself - installed later with source)
RUN uv sync --frozen --no-install-project

# Copy server source (for initial build; volume mount overrides in dev)
COPY server/src/ ./server/src/

# Install the project itself now that source is available
RUN uv sync --frozen
