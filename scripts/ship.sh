#!/usr/bin/env bash
# ============================================================
# ship.sh - One-command release automation
# ============================================================
# Usage: ./scripts/ship.sh {patch|minor|major}
#
# This script automates the full release process:
# 1. Creates a release PR with version bump
# 2. Monitors CI checks until they complete
# 3. Prompts user to merge the PR
# 4. Pulls the merged changes
# 5. Creates and pushes the version tag (triggers publish)
# ============================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Validate arguments
if [[ $# -ne 1 ]] || [[ ! "$1" =~ ^(patch|minor|major)$ ]]; then
    echo "Usage: $0 {patch|minor|major}"
    exit 1
fi

BUMP_TYPE="$1"

# Check prerequisites
command -v gh > /dev/null 2>&1 || error "GitHub CLI (gh) is required"
command -v jq > /dev/null 2>&1 || error "jq is required"

# Ensure we're in the repo root
cd "$(git rev-parse --show-toplevel)"

# Check for uncommitted changes
if [[ -n "$(git status --porcelain)" ]]; then
    error "You have uncommitted changes. Please commit or stash them first."
fi

echo ""
echo "🚀 Starting release process (${BUMP_TYPE} bump)"
echo "================================================"
echo ""

# ============================================================
# Step 1: Create release PR
# ============================================================
info "Creating release PR..."

# Capture the output to extract PR URL
PR_OUTPUT=$(make "release-pr-${BUMP_TYPE}" 2>&1 | tee /dev/tty)

# Extract PR number from output
PR_URL=$(echo "$PR_OUTPUT" | grep -oE 'https://github.com/[^/]+/[^/]+/pull/[0-9]+' | tail -1)
if [[ -z "$PR_URL" ]]; then
    error "Failed to extract PR URL from output"
fi
PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')

success "Created PR #${PR_NUMBER}: ${PR_URL}"
echo ""

# ============================================================
# Step 2: Monitor CI checks
# ============================================================
info "Monitoring CI checks for PR #${PR_NUMBER}..."

check_ci_status() {
    # Get the status of all checks
    # Note: gh pr checks uses 'state' field with values: PENDING, SUCCESS, FAILURE, etc.
    gh pr checks "$PR_NUMBER" --json name,state 2>/dev/null || echo "[]"
}

wait_for_checks() {
    local max_wait=600  # 10 minutes max
    local elapsed=0
    local interval=10
    
    while [[ $elapsed -lt $max_wait ]]; do
        local checks_json
        checks_json=$(check_ci_status)
        
        # Count check states (state field has: PENDING, SUCCESS, FAILURE, CANCELLED, etc.)
        local total pending passed failed
        total=$(echo "$checks_json" | jq 'length')
        pending=$(echo "$checks_json" | jq '[.[] | select(.state == "PENDING" or .state == "IN_PROGRESS" or .state == "QUEUED")] | length')
        passed=$(echo "$checks_json" | jq '[.[] | select(.state == "SUCCESS" or .state == "SKIPPED")] | length')
        failed=$(echo "$checks_json" | jq '[.[] | select(.state == "FAILURE" or .state == "CANCELLED" or .state == "ERROR")] | length')
        
        if [[ "$total" -eq 0 ]]; then
            echo -ne "\r⏳ Waiting for checks to start...                    "
        elif [[ "$pending" -gt 0 ]]; then
            echo -ne "\r⏳ Checks: ${passed}/${total} passed, ${pending} pending...    "
        elif [[ "$failed" -gt 0 ]]; then
            echo ""
            echo ""
            warn "Some checks failed:"
            echo "$checks_json" | jq -r '.[] | select(.state == "FAILURE" or .state == "ERROR") | "  - \(.name)"'
            echo ""
            return 1
        else
            echo ""
            success "All ${total} checks passed!"
            return 0
        fi
        
        sleep "$interval"
        elapsed=$((elapsed + interval))
    done
    
    echo ""
    warn "Timed out waiting for checks (${max_wait}s)"
    return 1
}

if ! wait_for_checks; then
    echo ""
    read -rp "$(echo -e "${YELLOW}Checks did not all pass. Continue anyway? [y/N]: ${NC}")" continue_anyway
    if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
        info "Aborting. You can check the PR at: ${PR_URL}"
        exit 1
    fi
fi

echo ""

# ============================================================
# Step 3: Prompt to merge
# ============================================================
read -rp "$(echo -e "${GREEN}Ready to merge PR #${PR_NUMBER}. Proceed? [Y/n]: ${NC}")" do_merge
if [[ "$do_merge" =~ ^[Nn]$ ]]; then
    info "Skipping merge. You can merge manually at: ${PR_URL}"
    exit 0
fi

info "Merging PR #${PR_NUMBER}..."
gh pr merge "$PR_NUMBER" --squash --delete-branch

success "PR merged!"
echo ""

# ============================================================
# Step 4: Pull merged changes
# ============================================================
info "Pulling merged changes..."
git checkout main
git pull origin main

success "Local main branch updated"
echo ""

# ============================================================
# Step 5: Create and push tag
# ============================================================
# Extract version from pyproject.toml
VERSION=$(grep -m1 'version' packages/adk-sim-protos/pyproject.toml | cut -d'"' -f2)
TAG="v${VERSION}"

info "Creating and pushing tag ${TAG}..."
git tag "$TAG"
git push origin "$TAG"

success "Tag ${TAG} pushed!"
echo ""

# ============================================================
# Done!
# ============================================================
echo "================================================"
success "Release ${TAG} initiated!"
echo ""
info "The publish workflow should now be running."
info "Monitor it at: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions/workflows/publish.yaml"
echo ""
