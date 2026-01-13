#!/bin/bash
# ============================================================
# build.sh - Unified build for all artifacts
# ============================================================
# Usage:
#   ./scripts/build.sh           # Full build
#   ./scripts/build.sh protos    # Proto generation only
#   ./scripts/build.sh ts        # TypeScript packages only
#   ./scripts/build.sh frontend  # Frontend bundle only
#   ./scripts/build.sh packages  # Python packages only
# ============================================================

set -e
cd "$(dirname "${BASH_SOURCE[0]}")/.."

PYTHON_GEN_DIR="packages/adk-sim-protos/src/adk_sim_protos"
TS_GEN_DIR="packages/adk-sim-protos-ts/src"

build_protos() {
    echo "🔧 Generating proto code..."

    # Preserve hand-written index.ts
    if [ -f "$TS_GEN_DIR/index.ts" ]; then
        cp "$TS_GEN_DIR/index.ts" /tmp/index.ts.bak
    fi

    # Clean generated directories (but not index.ts)
    rm -rf "$PYTHON_GEN_DIR/adksim" "$PYTHON_GEN_DIR/google"
    rm -rf "$TS_GEN_DIR/adksim" "$TS_GEN_DIR/google"

    # Generate
    PATH="$PWD/.venv/bin:$PATH" buf generate

    # Restore index.ts
    if [ -f /tmp/index.ts.bak ]; then
        mv /tmp/index.ts.bak "$TS_GEN_DIR/index.ts"
    fi

    # Format generated code
    uv run ruff check --fix "$PYTHON_GEN_DIR" 2>/dev/null || true
    uv run ruff format "$PYTHON_GEN_DIR"
    npx prettier --write "$TS_GEN_DIR/**/*.ts" 2>/dev/null || true

    echo "✅ Protos generated!"
}

build_ts_packages() {
    echo "📦 Building TypeScript packages..."
    npm run build --workspace=packages/adk-sim-protos-ts
    npm run build --workspace=packages/adk-converters-ts
    echo "✅ TypeScript packages built!"
}

build_frontend() {
    echo "📦 Building and bundling frontend..."
    cd frontend && CI=TRUE npm run build && cd ..
    rm -rf server/src/adk_sim_server/static/*
    cp -r frontend/dist/frontend/* server/src/adk_sim_server/static/
    echo "✅ Frontend bundled into server!"
}

build_python_packages() {
    echo "📦 Building Python packages..."
    rm -rf dist/
    uv build --package adk-sim-protos --out-dir dist/
    uv build --package adk-sim-testing --out-dir dist/
    uv build --package adk-sim-server --out-dir dist/
    uv build --package adk-agent-sim --out-dir dist/
    echo "✅ Python packages built in dist/!"
}

# Main
case "${1:-all}" in
    protos)
        build_protos
        ;;
    ts|typescript)
        build_ts_packages
        ;;
    frontend)
        build_ts_packages  # Required dependency
        build_frontend
        ;;
    packages|python)
        build_python_packages
        ;;
    all)
        build_protos
        build_ts_packages
        build_frontend
        build_python_packages
        echo ""
        echo "🎉 Full build complete!"
        ;;
    *)
        echo "Usage: $0 {protos|ts|frontend|packages|all}"
        exit 1
        ;;
esac
