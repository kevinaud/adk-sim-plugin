#!/usr/bin/env bash
# Updates vendored Google AI Generative Language protos from googleapis
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$REPO_ROOT/protos/google/ai/generativelanguage/v1beta"

# Base URL for raw proto files from googleapis
BASE_URL="https://raw.githubusercontent.com/googleapis/googleapis/master/google/ai/generativelanguage/v1beta"

# Proto files to vendor
PROTOS=(
  "generative_service.proto"
  "content.proto"
  "citation.proto"
  "retriever.proto"
  "safety.proto"
)

echo "🔄 Updating vendored Google AI protos..."
echo "   Target: $VENDOR_DIR"

# Ensure directory exists
mkdir -p "$VENDOR_DIR"

# Download each proto file
for proto in "${PROTOS[@]}"; do
  echo "   📥 Downloading $proto..."
  curl -sL "${BASE_URL}/${proto}" -o "${VENDOR_DIR}/${proto}"
done

echo "✅ Vendored protos updated!"
echo ""
echo "Next steps:"
echo "  1. Run 'buf dep update' to update dependencies"
echo "  2. Run './scripts/gen_protos.sh' to regenerate code"
