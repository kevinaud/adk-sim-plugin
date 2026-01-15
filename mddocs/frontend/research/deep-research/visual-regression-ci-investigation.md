# Deep Research Request: Playwright Visual Regression Test Failures Between Local and CI Environments

## Problem Statement

Our Playwright visual regression tests pass locally but fail on GitHub Actions CI with approximately 2% pixel difference when our threshold is 1%. The tests generate visually different screenshots in each environment despite using the same Playwright version and web fonts.

**Key symptom**: Local baseline snapshots are ~19KB, but CI generates ~21KB screenshots for the identical test, indicating fundamentally different rendering output.

---

## Environment Details

### Local Development Environment

- **Container base image**: `mcr.microsoft.com/devcontainers/python:3.14`
  - This is a Debian-based image (Debian Bookworm)
- **Node.js version**: 22 (installed via devcontainer features)
- **Playwright version**: 1.57.0
- **Browser**: Chromium (installed via `npx playwright install chromium --with-deps`)
- **Font strategy**: Web fonts via `@fontsource/roboto` npm package (bundled in CSS, not system fonts)

### CI Environment (GitHub Actions)

- **Runner**: `ubuntu-latest` (Ubuntu 24.04 as of 2025)
- **Node.js version**: 24 (via `actions/setup-node@v6`)
- **Playwright version**: 1.57.0 (same as local)
- **Browser**: Chromium (same installation method)
- **Font strategy**: Same web fonts via `@fontsource/roboto`

### Playwright Configuration

```typescript
// playwright.config.ts (relevant sections)
export default defineConfig({
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01, // 1% pixel diff threshold
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4200',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'NG_CLI_ANALYTICS=false npx ng serve --host 127.0.0.1 --port 4200 --allowed-hosts=all --live-reload=false',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: !process.env['CI'],
  },
});
```

---

## What Has Been Tried

1. **Regenerated snapshots locally**: Running `npx playwright test --update-snapshots` produces no changes to committed baselines, confirming local rendering is consistent.

2. **Verified font loading**: The application uses `@fontsource/roboto` web fonts which are bundled in CSS via npm, not relying on system fonts.

3. **Downloaded CI artifacts**: Examined the actual vs expected screenshots from CI. The diff shows subtle layout/positioning differences across the entire page, not just text areas.

4. **Verified Playwright versions match**: Both environments use Playwright 1.57.0.

5. **Added CI artifact upload**: Modified CI workflow to upload `test-results/` and `playwright-report/` directories on failure for debugging.

---

## Key Observations

1. **File size difference**: Local snapshots are 19,292 bytes; CI generates 21,523 bytes for the same screenshot - a 12% file size difference.

2. **Diff pattern**: The visual diff shows differences scattered across the page, not localized to specific components. This suggests a systemic rendering difference rather than a code bug.

3. **Threshold exceeded**: Actual pixel diff ratio is ~0.02 (2%), exceeding the 0.01 (1%) threshold.

4. **Both E2E and component tests affected**: The issue affects both Playwright E2E tests (`playwright.config.ts`) and Playwright component tests (`playwright-ct.config.ts`).

5. **Tests pass locally with high reliability**: 30/30 E2E tests and 24/24 component tests pass locally with no flakiness.

---

## Potential Root Causes to Investigate

### 1. Operating System Rendering Differences
- Debian (devcontainer) vs Ubuntu (CI runner)
- Different versions of system libraries (fontconfig, freetype, harfbuzz, etc.)
- Different subpixel antialiasing settings

### 2. Chromium Browser Differences
- Same Playwright version but potentially different Chromium builds for different OS targets
- GPU/software rendering differences between environments

### 3. Display/DPI Configuration
- Virtual display settings differences
- Screen DPI or scaling differences
- Headless mode rendering variations

### 4. Font Rendering Pipeline
- Even with web fonts, the underlying font rendering engine differs
- FreeType/HarfBuzz versions between Debian and Ubuntu
- Font hinting differences

### 5. Node.js Version Difference
- Local: Node.js 22
- CI: Node.js 24
- Could affect how the dev server builds/serves assets

---

## Specific Research Questions

1. **Is it a known issue?** Are there documented cases of Playwright visual regression tests producing different results between Debian and Ubuntu environments?

2. **Chromium rendering consistency**: Does Playwright's bundled Chromium guarantee pixel-perfect rendering across Linux distributions? If not, what are the documented sources of variance?

3. **Best practices for cross-environment visual testing**: What do Playwright maintainers recommend for ensuring visual regression tests pass in both local dev and CI environments?

4. **Docker-based CI**: Should we run CI inside the same devcontainer image to guarantee environment parity? What are the trade-offs (build time, caching, complexity)?

5. **Font rendering normalization**: Are there Playwright configuration options or Docker/system configurations that normalize font rendering across environments?

6. **Alternative approaches**: Should we use a different visual testing strategy (e.g., Playwright's `stylePath` option, CSS-only snapshots, or Percy/Chromatic-style cloud rendering)?

---

## Constraints

- **Do not want to increase the pixel diff threshold** beyond 1% as it would hide real regressions
- **Do not want to change the devcontainer base image** from the official Microsoft Python image
- **Prefer solutions that don't require running the full devcontainer in CI** due to ~5 minute startup overhead vs ~30 second lightweight setup

---

## Desired Outcome

A clear recommendation for ensuring Playwright visual regression tests produce consistent results between our local development environment (Debian-based devcontainer) and CI environment (Ubuntu-based GitHub Actions runner), without masking real visual regressions.

Ideal solution would either:
1. Configure both environments to render identically, OR
2. Provide a different visual testing architecture that handles environmental differences gracefully
