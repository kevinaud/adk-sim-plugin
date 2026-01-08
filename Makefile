# ============================================================
# ADK Agent Simulator - Developer Makefile
# ============================================================
# This Makefile is the entry point for all common developer workflows.
# It ensures proto generation is always run before dependent tasks.
#
# Usage:
#   make help        - Show available targets
#   make generate    - Generate proto code (Python + TypeScript)
#   make server      - Start backend server
#   make frontend    - Start frontend dev server
#   make test        - Run all tests
#   make quality     - Run all quality checks
# ============================================================

.PHONY: help generate clean server frontend test test-unit test-integration test-e2e quality lint format all dev docker-up docker-up-d docker-down docker-rebuild bundle-frontend

# Default target
.DEFAULT_GOAL := help

# Directories
PYTHON_GEN_DIR := packages/adk-sim-protos/src/adk_sim_protos
TS_GEN_DIR := packages/adk-sim-protos-ts/src

# Marker file to track when protos were last generated
# This avoids regenerating if proto files haven't changed
PROTO_MARKER := .proto-generated

# Find all proto files
PROTO_FILES := $(shell find protos -name '*.proto' 2>/dev/null)

# ============================================================
# Help
# ============================================================
help:
	@echo "ADK Agent Simulator - Developer Commands"
	@echo ""
	@echo "Proto Generation:"
	@echo "  make generate     - Generate proto code (Python + TypeScript)"
	@echo "  make clean        - Remove all generated code"
	@echo ""
	@echo "Development Servers:"
	@echo "  make server       - Start backend gRPC server"
	@echo "  make frontend     - Start frontend Angular dev server"
	@echo "  make dev          - Start both backend and frontend (requires tmux)"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up    - Start all services via Docker Compose"
	@echo "  make docker-up-d  - Start all services (detached)"
	@echo "  make docker-down  - Stop all Docker Compose services"
	@echo "  make docker-rebuild - Full rebuild (use after adding dependencies)"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run all tests"
	@echo "  make test-unit    - Run unit tests only"
	@echo "  make test-int     - Run integration tests only"
	@echo "  make test-e2e     - Run E2E tests (requires Docker)"
	@echo ""
	@echo "Quality:"
	@echo "  make quality      - Run all quality checks (lint, format, types)"
	@echo "  make lint         - Run linters only"
	@echo "  make format       - Auto-format all code"

# ============================================================
# Proto Generation
# ============================================================

# Generate protos only if source files changed
$(PROTO_MARKER): $(PROTO_FILES) buf.yaml buf.gen.yaml
	@echo "🔧 Generating code from proto files..."
	@rm -rf "$(PYTHON_GEN_DIR)/adksim" "$(PYTHON_GEN_DIR)/google"
	@rm -rf "$(TS_GEN_DIR)/adksim" "$(TS_GEN_DIR)/google"
	@PATH="$(PWD)/.venv/bin:$$PATH" buf generate
	@echo "🎨 Formatting Python generated code..."
	@uv run ruff check --fix "$(PYTHON_GEN_DIR)" 2>/dev/null || true
	@uv run ruff format "$(PYTHON_GEN_DIR)"
	@echo "🎨 Formatting TypeScript generated code..."
	@cd frontend && npx prettier --write "../$(TS_GEN_DIR)/**/*.ts" 2>/dev/null || true
	@touch $(PROTO_MARKER)
	@echo "✅ Proto generation complete!"

generate: $(PROTO_MARKER)

# Force regeneration
regenerate:
	@rm -f $(PROTO_MARKER)
	@$(MAKE) generate

clean:
	@echo "🧹 Cleaning generated code..."
	@rm -rf "$(PYTHON_GEN_DIR)/adksim" "$(PYTHON_GEN_DIR)/google"
	@rm -rf "$(TS_GEN_DIR)/adksim" "$(TS_GEN_DIR)/google"
	@rm -f $(PROTO_MARKER)
	@echo "✅ Clean complete!"

# ============================================================
# Development Servers
# ============================================================

server: generate
	@echo "🚀 Starting ADK Agent Simulator server..."
	uv run adk-sim

frontend: generate
	@echo "🚀 Starting frontend Angular dev server..."
	cd frontend && npm start

# Start both servers (requires tmux or run in separate terminals)
dev:
	@echo "Starting development environment..."
	@echo "Run 'make server' and 'make frontend' in separate terminals"
	@echo "Or use: tmux new-session 'make server' \\; split-window 'make frontend'"

# ============================================================
# Docker
# ============================================================

# Start Docker Compose services
docker-up:
	@echo "🐳 Starting Docker Compose services..."
	docker compose up

# Start Docker Compose services (detached)
docker-up-d:
	@echo "🐳 Starting Docker Compose services (detached)..."
	docker compose up -d

# Stop Docker Compose services
docker-down:
	@echo "🐳 Stopping Docker Compose services..."
	docker compose down

# Full rebuild of Docker images (use after adding new dependencies)
docker-rebuild:
	@echo "🐳 Rebuilding Docker images from scratch..."
	docker compose down -v
	docker compose build --no-cache
	@echo "✅ Docker rebuild complete! Run 'make docker-up' to start."

# ============================================================
# Testing
# ============================================================

test: generate
	@echo "🧪 Running all tests..."
	uv run pytest server/tests plugins/python/tests

test-unit: generate
	@echo "🧪 Running unit tests..."
	uv run pytest server/tests/unit plugins/python/tests/unit -v

test-int: generate
	@echo "🧪 Running integration tests..."
	uv run pytest plugins/python/tests/integration -v

test-e2e:
	@echo "🧪 Running E2E tests (requires Docker)..."
	uv run pytest server/tests/e2e --run-e2e -v

# ============================================================
# Frontend Bundling
# ============================================================

bundle-frontend:
	@echo "📦 Building and bundling frontend..."
	cd frontend && CI=TRUE npm run build
	rm -rf server/src/adk_sim_server/static/*
	cp -r frontend/dist/frontend/* server/src/adk_sim_server/static/
	@echo "✅ Frontend bundled into server/src/adk_sim_server/static/"

# ============================================================
# Quality Checks
# ============================================================

quality: generate
	@echo "🔍 Running quality checks..."
	./scripts/check_quality.sh

lint: generate
	@echo "🔍 Running linters..."
	@echo "--- Proto ---"
	buf lint
	@echo "--- Python ---"
	uv run ruff check server/src plugins/python/src packages/
	uv run pyright
	@echo "--- TypeScript ---"
	cd frontend && npm run lint

format:
	@echo "🎨 Formatting all code..."
	@echo "--- Proto ---"
	buf format -w
	@echo "--- Python ---"
	uv run ruff check --fix server/src plugins/python/src packages/ || true
	uv run ruff format server/src plugins/python/src packages/
	@echo "--- TypeScript ---"
	cd frontend && npm run format
	@echo "✅ Formatting complete!"
