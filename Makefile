# ============================================================
# ADK Agent Simulator - Developer Makefile
# ============================================================

.PHONY: help generate clean server frontend dev docker-up docker-down test test-e2e quality bundle build

.DEFAULT_GOAL := help

# Directories
PYTHON_GEN_DIR := packages/adk-sim-protos/src/adk_sim_protos
TS_GEN_DIR := packages/adk-sim-protos-ts/src
PROTO_MARKER := .proto-generated
PROTO_FILES := $(shell find protos -name '*.proto' 2>/dev/null)

# ============================================================
# Help
# ============================================================
help:
	@echo "ADK Agent Simulator - Developer Commands"
	@echo ""
	@echo "Development:"
	@echo "  make server       - Start backend gRPC server"
	@echo "  make frontend     - Start frontend dev server"
	@echo "  make docker-up    - Start via Docker Compose"
	@echo ""
	@echo "Quality & Testing:"
	@echo "  make quality      - Run all quality checks (pre-commit)"
	@echo "  make test         - Run unit + integration tests"
	@echo "  make test-e2e     - Run E2E tests (requires Docker)"
	@echo ""
	@echo "Build:"
	@echo "  make generate     - Generate proto code"
	@echo "  make bundle       - Bundle frontend into server"
	@echo "  make build        - Full release build (protos + frontend + packages)"
	@echo "  make clean        - Remove generated files"

# ============================================================
# Proto Generation (with index.ts preservation)
# ============================================================
$(PROTO_MARKER): $(PROTO_FILES) buf.yaml buf.gen.yaml
	@echo "🔧 Generating proto code..."
	@# Save custom index.ts if it exists
	@if [ -f "$(TS_GEN_DIR)/index.ts" ]; then cp "$(TS_GEN_DIR)/index.ts" /tmp/index.ts.bak; fi
	@rm -rf "$(PYTHON_GEN_DIR)/adksim" "$(PYTHON_GEN_DIR)/google"
	@rm -rf "$(TS_GEN_DIR)/adksim" "$(TS_GEN_DIR)/google"
	@PATH="$(PWD)/.venv/bin:$$PATH" buf generate
	@# Restore custom index.ts
	@if [ -f /tmp/index.ts.bak ]; then mv /tmp/index.ts.bak "$(TS_GEN_DIR)/index.ts"; fi
	@uv run ruff check --fix "$(PYTHON_GEN_DIR)" 2>/dev/null || true
	@uv run ruff format "$(PYTHON_GEN_DIR)"
	@# Fix trailing whitespace in docstrings (ruff doesn't fix this)
	@find "$(PYTHON_GEN_DIR)" -name '*.py' -exec sed -i 's/[[:space:]]*$$//' {} \;
	@cd frontend && npx prettier --write "../$(TS_GEN_DIR)/**/*.ts" 2>/dev/null || true
	@touch $(PROTO_MARKER)
	@echo "✅ Proto generation complete!"

generate: $(PROTO_MARKER)

clean:
	@rm -rf "$(PYTHON_GEN_DIR)/adksim" "$(PYTHON_GEN_DIR)/google"
	@rm -rf "$(TS_GEN_DIR)/adksim" "$(TS_GEN_DIR)/google"
	@rm -f $(PROTO_MARKER)
	@echo "✅ Clean complete!"

# ============================================================
# Development
# ============================================================
server: generate
	uv run adk-sim

frontend: generate
	cd frontend && npm start

dev:
	@echo "Run 'make server' and 'make frontend' in separate terminals"

docker-up:
	docker compose up

docker-down:
	docker compose down

# ============================================================
# Quality & Testing
# ============================================================
quality: generate
	uv run pre-commit run --all-files

test: generate
	uv run pytest server/tests/unit plugins/python/tests -v

test-e2e:
	uv run pytest server/tests/e2e --run-e2e -v

# ============================================================
# Build (for releases)
# ============================================================
bundle: generate
	@echo "📦 Bundling frontend into server..."
	cd frontend && CI=TRUE npm run build
	rm -rf server/src/adk_sim_server/static/*
	cp -r frontend/dist/frontend/* server/src/adk_sim_server/static/
	@echo "✅ Frontend bundled!"

build: generate bundle
	@echo "📦 Building all packages..."
	npm run build --workspace=packages/adk-sim-protos-ts
	npm run build --workspace=packages/adk-converters-ts
	uv build --package adk-sim-protos --out-dir dist/
	uv build --package adk-sim-testing --out-dir dist/
	uv build --package adk-sim-server --out-dir dist/
	uv build --package adk-agent-sim --out-dir dist/
	@echo "✅ All packages built in dist/"

# ============================================================
# Release Management
# ============================================================
.PHONY: release-pr-patch release-pr-minor release-pr-major release-tag

_create_release_pr:
	@if [ -z "$(BUMP)" ]; then echo "Error: BUMP not set"; exit 1; fi
	@if ! command -v gh > /dev/null 2>&1; then echo "Error: gh CLI required"; exit 1; fi
	@if [ -n "$$(git status --porcelain)" ]; then echo "Error: uncommitted changes"; exit 1; fi
	@echo "Creating release PR ($(BUMP) bump)..."
	git fetch origin main
	git checkout main
	git pull origin main
	$(eval VERSION := $(shell uv run python scripts/get_next_version.py $(BUMP)))
	@echo "Bumping to version $(VERSION)..."
	git checkout -b release/v$(VERSION)
	uv run python scripts/sync_versions.py $(VERSION)
	uv lock
	npm install
	git add -A
	git commit -m "chore: release v$(VERSION)"
	git push -u origin HEAD
	gh pr create --title "chore: release v$(VERSION)" --body "Automated release PR for version $(VERSION)"

release-pr-patch:
	@$(MAKE) _create_release_pr BUMP=patch

release-pr-minor:
	@$(MAKE) _create_release_pr BUMP=minor

release-pr-major:
	@$(MAKE) _create_release_pr BUMP=major

release-tag:
	@VERSION=$$(grep -m1 'version' packages/adk-sim-protos/pyproject.toml | cut -d'"' -f2) && \
	echo "Creating tag v$$VERSION..." && \
	git tag "v$$VERSION" && \
	git push origin "v$$VERSION" && \
	echo "✅ Tag v$$VERSION pushed - publish workflow will run"
