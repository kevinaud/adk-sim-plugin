#!/usr/bin/env bash
# ============================================================
# ship.sh - One-command release automation
# ============================================================
# Usage: ./scripts/ship.sh [options] {patch|minor|major}
#
# Options:
#   --skip-presubmit  Don't wait for CI checks on the release PR
#   --yes             Merge PR without prompting for confirmation
#
# This script automates the full release process:
# 1. Creates a release PR with version bump
# 2. Monitors CI checks until they complete (unless --skip-presubmit)
# 3. Prompts user to merge the PR (unless --yes)
# 4. Pulls the merged changes
# 5. Creates and pushes the version tag (triggers publish)
# 6. Monitors the publish workflow and reports results
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

# Default options
SKIP_PRESUBMIT=false
AUTO_YES=false
BUMP_TYPE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-presubmit)
            SKIP_PRESUBMIT=true
            shift
            ;;
        --yes)
            AUTO_YES=true
            shift
            ;;
        patch|minor|major)
            BUMP_TYPE="$1"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options] {patch|minor|major}"
            echo ""
            echo "Options:"
            echo "  --skip-presubmit  Don't wait for CI checks on the release PR"
            echo "  --yes             Merge PR without prompting for confirmation"
            echo ""
            echo "Examples:"
            echo "  $0 patch                    # Interactive patch release"
            echo "  $0 --yes minor              # Auto-merge minor release"
            echo "  $0 --skip-presubmit patch   # Skip CI wait, prompt for merge"
            echo "  $0 --skip-presubmit --yes patch  # Fully automated"
            exit 0
            ;;
        *)
            error "Unknown argument: $1. Use --help for usage."
            ;;
    esac
done

# Validate bump type was provided
if [[ -z "$BUMP_TYPE" ]]; then
    echo "Usage: $0 [options] {patch|minor|major}"
    echo "Use --help for more options."
    exit 1
fi

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
[[ "$SKIP_PRESUBMIT" == "true" ]] && echo "   (--skip-presubmit: will not wait for CI)"
[[ "$AUTO_YES" == "true" ]] && echo "   (--yes: will auto-merge)"
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
# Step 2: Monitor CI checks (unless --skip-presubmit)
# ============================================================
check_ci_status() {
    gh pr checks "$PR_NUMBER" --json name,state 2>/dev/null || echo "[]"
}

wait_for_checks() {
    local max_wait=600  # 10 minutes max
    local elapsed=0
    local interval=10

    while [[ $elapsed -lt $max_wait ]]; do
        local checks_json
        checks_json=$(check_ci_status)

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

if [[ "$SKIP_PRESUBMIT" == "true" ]]; then
    info "Skipping CI check monitoring (--skip-presubmit)"
else
    info "Monitoring CI checks for PR #${PR_NUMBER}..."
    if ! wait_for_checks; then
        echo ""
        if [[ "$AUTO_YES" == "true" ]]; then
            warn "CI checks did not pass, but --yes was specified. Continuing..."
        else
            read -rp "$(echo -e "${YELLOW}Checks did not all pass. Continue anyway? [y/N]: ${NC}")" continue_anyway
            if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
                info "Aborting. You can check the PR at: ${PR_URL}"
                exit 1
            fi
        fi
    fi
fi

echo ""

# ============================================================
# Step 3: Merge PR
# ============================================================
if [[ "$AUTO_YES" == "true" ]]; then
    info "Merging PR #${PR_NUMBER} (--yes)..."
else
    read -rp "$(echo -e "${GREEN}Ready to merge PR #${PR_NUMBER}. Proceed? [Y/n]: ${NC}")" do_merge
    if [[ "$do_merge" =~ ^[Nn]$ ]]; then
        info "Skipping merge. You can merge manually at: ${PR_URL}"
        exit 0
    fi
    info "Merging PR #${PR_NUMBER}..."
fi

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
VERSION=$(grep -m1 'version' packages/adk-sim-protos/pyproject.toml | cut -d'"' -f2)
TAG="v${VERSION}"

info "Creating and pushing tag ${TAG}..."
git tag "$TAG"
git push origin "$TAG"

success "Tag ${TAG} pushed!"
echo ""

# ============================================================
# Step 6: Monitor publish workflow
# ============================================================
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
WORKFLOW_URL="https://github.com/${REPO}/actions/workflows/publish.yaml"

info "Monitoring publish workflow for ${TAG}..."
echo ""

# Wait for the workflow run to appear
sleep 5

# Get the run ID for this tag
get_run_id() {
    gh run list --workflow=publish.yaml --limit=5 --json databaseId,headBranch,status \
        | jq -r ".[] | select(.headBranch == \"${TAG}\") | .databaseId" \
        | head -1
}

RUN_ID=""
for i in {1..12}; do
    RUN_ID=$(get_run_id)
    if [[ -n "$RUN_ID" ]]; then
        break
    fi
    echo -ne "\r⏳ Waiting for publish workflow to start...  "
    sleep 5
done

if [[ -z "$RUN_ID" ]]; then
    warn "Could not find publish workflow run for ${TAG}"
    info "Check manually at: ${WORKFLOW_URL}"
    exit 0
fi

echo ""
info "Publish workflow started (Run ID: ${RUN_ID})"
info "View at: https://github.com/${REPO}/actions/runs/${RUN_ID}"
echo ""

# Monitor the workflow
monitor_publish() {
    local max_wait=600  # 10 minutes
    local elapsed=0
    local interval=10

    while [[ $elapsed -lt $max_wait ]]; do
        local run_json
        run_json=$(gh run view "$RUN_ID" --json status,conclusion,jobs 2>/dev/null)

        local status conclusion
        status=$(echo "$run_json" | jq -r '.status')
        conclusion=$(echo "$run_json" | jq -r '.conclusion')

        if [[ "$status" == "completed" ]]; then
            echo ""
            if [[ "$conclusion" == "success" ]]; then
                success "🎉 Publish workflow completed successfully!"
                echo ""
                echo "Published packages:"
                echo "  PyPI: https://pypi.org/project/adk-sim-server/${VERSION}/"
                echo "  npm:  https://www.npmjs.com/package/@adk-sim/protos/v/${VERSION}"
                return 0
            else
                echo ""
                warn "Publish workflow failed with conclusion: ${conclusion}"
                echo ""
                echo "Failed jobs:"
                echo "$run_json" | jq -r '.jobs[] | select(.conclusion == "failure") | "  - \(.name)"'
                echo ""
                info "View logs at: https://github.com/${REPO}/actions/runs/${RUN_ID}"
                return 1
            fi
        fi

        # Show job progress
        local jobs_summary
        jobs_summary=$(echo "$run_json" | jq -r '[.jobs[] | "\(.name): \(.status)"] | join(", ")')
        echo -ne "\r⏳ ${jobs_summary}    "

        sleep "$interval"
        elapsed=$((elapsed + interval))
    done

    echo ""
    warn "Timed out waiting for publish workflow (${max_wait}s)"
    info "Check manually at: https://github.com/${REPO}/actions/runs/${RUN_ID}"
    return 1
}

if monitor_publish; then
    echo ""
    echo "================================================"
    success "Release ${TAG} complete! 🚀"
    echo "================================================"
else
    echo ""
    echo "================================================"
    warn "Release ${TAG} publishing failed. Check the logs above."
    echo "================================================"
    exit 1
fi
