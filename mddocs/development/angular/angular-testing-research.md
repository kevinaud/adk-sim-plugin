Production-Grade Testing Strategy for Angular v21: A Sociable, Zoneless, and Signal-First Architecture1. Executive SummaryThe release of Angular v21 represents the culmination of a multi-year architectural modernization, fundamentally altering the framework's reactivity model, change detection mechanisms, and testing ecosystem. The stabilization of Zoneless Change Detection, the introduction of Signal Forms as a developer preview-turned-standard, and the adoption of Vitest as the default test runner necessitate a comprehensive re-evaluation of enterprise testing strategies.1 The "Classic" Angular testing patterns—characterized by heavy reliance on Zone.js patching, fakeAsync scheduling, extensive TestBed overrides, and invasive spying on private service methods—are now considered obsolete and often incompatible with the new primitives.4This research report defines a rigorously engineered, production-grade testing strategy tailored for Angular v21 applications. It explicitly advocates for a Classicist (Sociable) Testing Philosophy, rejecting the fragile "Mockist" isolation patterns that have historically plagued Angular codebases. Instead of isolating components from their dependencies via spies and stubs, this strategy emphasizes testing units in integration with their real dependencies, strictly utilizing high-fidelity fakes only at the system boundaries—specifically the network layer via Mock Service Worker (MSW).6The architecture detailed herein leverages Angular v21's Zoneless core for superior runtime performance and debugging clarity, Signal Forms for granular, reactive state management, Vitest for high-velocity test execution, MSW for network isolation driven by OpenAPI contracts, and Dockerized Playwright for deterministic visual regression free of SaaS dependencies. This stack ensures that tests verify the observable behavior of the application—the DOM state and network interactions visible to the user—rather than the implementation details, resulting in a test suite that is robust, refactor-resistant, and aligned with the "Zero Drift" principle of modern software verification.2. The Paradigm Shift: From Zone.js to Native ReactivityTo understand the necessity of the proposed testing strategy, one must first dissect the fundamental shift in Angular's runtime architecture. For over a decade, Angular relied on Zone.js to manage change detection. This dependency allowed the framework to "magically" detect when to update the view by monkey-patching standard browser APIs such as Promise, setTimeout, and addEventListener. While this lowered the barrier to entry by removing the need for manual update calls, it introduced significant complexity, runtime overhead, and famously obscure stack traces.42.1. The Mechanics of Zoneless Angular v21In Angular v21, the default application state is Zoneless. This means the zone.js polyfill is removed from the build pipeline, and Angular no longer intercepts asynchronous operations globally. Instead, Change Detection (CD) is triggered explicitly by specific reactive events.The implications for application architecture are profound. In a Zone-based app, any generic Promise resolution would trigger a tick. In a Zoneless app, CD runs only when:Signal Updates: A signal value bound in a template is updated.Event Listeners: A host or template event listener (e.g., (click)) fires.Async Pipe: An Observable subscribed via the async pipe emits a new value.Explicit Notification: The developer or a library calls markForCheck() or ComponentRef.setInput().8This shift eliminates the "coarse-grained" detection cycles where the entire tree was checked regardless of relevance, replacing it with a "fine-grained" reactivity model where updates are localized. For testing, this means the environment is no longer "patched." A test that relies on fixture.detectChanges() to magically pick up a state change caused by a setTimeout inside a component will fail in v21, as the framework is no longer listening to setTimeout.2.2. The Obsolescence of fakeAsync and tickHistorically, fakeAsync was the standard tool for testing asynchronous logic in Angular. It operated by running the test body inside a special "Proxy Zone" that intercepted timer functions, allowing developers to simulate the passage of time synchronously using tick().This utility is fundamentally incompatible with a pure Zoneless environment because it relies on the very Zone.js patches that v21 removes. While Angular provides compatibility layers, relying on fakeAsync in a Zoneless application creates a divergence between the test environment (which is patched) and the production environment (which is native).Legacy Pattern (Zone.js):TypeScriptit('should show loader', fakeAsync(() => {
  component.initiateLoad(); // Triggers internal setTimeout
  tick(100); // Manually advances virtual time
  fixture.detectChanges();
  expect(loader).toBeTruthy();
}));
Modern Pattern (Zoneless v21):The new strategy exclusively utilizes native JavaScript async/await patterns. This aligns with modern browser capabilities and Vitest's architecture.TypeScriptit('should show loader', async () => {
  await component.initiateLoad(); // Await the actual Promise
  await fixture.whenStable();     // Wait for pending framework tasks
  fixture.detectChanges();        // Explicitly refresh the view
  expect(loader).toBeTruthy();
});
The critical primitive here is fixture.whenStable(). In Zone.js, stability was defined by the NgZone microtask queue being empty. In Zoneless, stability is defined by the PendingTasks service and the resolution of Promises known to the scheduler.42.3. Signal Effect Synchronization: The TestBed.tick() APIA distinct challenge in testing Signals is the asynchronous nature of effect(). Signals are synchronous, but effects—which often drive side effects like logging, DOM mutation outside templates, or navigation—are scheduled on the microtask queue to prevent "glitching" (unnecessary intermediate updates).In versions prior to v21 (v17-v20), developers often used TestBed.flushEffects() to force these effects to run during tests. However, this API was experimental and strictly limited to effects. Angular v21 deprecates flushEffects() in favor of TestBed.tick().TestBed.tick() is a comprehensive synchronization primitive. Unlike flushEffects, which only processed the effect queue, TestBed.tick() advances the broader framework state, processing effects, animation frames, and other scheduled internal tasks. It represents a "step forward" in the application's reactive graph.9Table 1: Evolution of Synchronization APIsFeatureAngular v16 (Zone.js)Angular v21 (Zoneless)Recommended UsageAsync HandlingfakeAsync / tick()Native async / awaitUse await for Promises; vi.useFakeTimers for intervals.Change DetectionAuto (mostly) / detectChangesExplicit / detectChangesCall detectChanges after user interactions.Effect FlushingN/A (Effects didn't exist)TestBed.tick()Call after setting signals that drive effects.StabilitywhenStable() (Zone queue)whenStable() (PendingTasks)Await before asserting final state.3. The New Testing Stack: Vitest and the Zoneless EnvironmentAngular v21 promotes Vitest to stable status as the default test runner, replacing the Karma/Jasmine combination that served the framework for a decade.1 This is not merely a swap of libraries but a fundamental upgrade in execution architecture.3.1. Vitest Architecture and PerformanceKarma operated by spinning up a real browser (Chrome Headless), creating a socket connection, and injecting test files into the browser context. While accurate, this introduced significant latency for file watching and re-execution.Vitest, powered by Vite, operates primarily in a Node.js environment using worker threads. It leverages the Vite dev server to transform files on demand. For Angular, this means:ESM Native: Vitest handles ECMAScript Modules natively, eliminating the complex Babel transforms often required for Jest compatibility.Instant HMR: Hot Module Replacement applies to tests. Changing a component file re-runs strictly the tests dependent on that component in milliseconds.Unified Config: The vite.config.ts serves both the build and test configurations, ensuring the test environment mirrors production build settings.33.2. Configuring Vitest for Zoneless ExecutionTo ensure a pure Zoneless environment, the testing configuration must explicitly exclude zone.js. Even if the application logic does not import it, the presence of zone.js in node_modules or polyfills can sometimes lead to accidental patching if not carefully managed in the test setup.File: vitest.config.tsTypeScriptimport { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [
    angular(), // Handles Angular Component compilation via Vite
  ],
  test: {
    globals: true, // Enables describe, it, expect
    environment: 'jsdom', // Simulates DOM in Node
    setupFiles: ['src/test-setup.ts'],
    include: ['**/*.spec.ts'],
    reporters: ['default'],
    // Critical: Exclude zone.js from optimization/transform pipelines
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    pool: 'threads',
    poolOptions: {
      threads: {
        isolate: true, // Ensure test isolation
      },
    },
  },
});
File: src/test-setup.tsIn v21, the test setup file is significantly cleaner. We no longer import zone.js/testing. Instead, we initialize the TestBed with the zoneless provider.TypeScriptimport '@testing-library/jest-dom'; // Extends Vitest assertions
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize the Angular testing environment
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
  {
    teardown: { destroyAfterEach: true } // Memory leak prevention
  }
);

// Global mock for browser APIs not in JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
3.3. Vitest Browser Mode for Visual FidelityWhile JSDOM is sufficient for logical unit tests, it is strictly a simulation of a DOM. It does not perform layout, paint, or actual style computation. For tests that require these—specifically Visual Regression Tests (VRT)—we utilize Vitest's Browser Mode or, more robustly, Playwright (discussed in Section 8).4. Signal Forms: A New Primitive for Data EntryAngular v21 introduces Signal Forms (@angular/forms/signals) as a modern alternative to Reactive Forms and Template-Driven Forms. This is not just a syntax update; it is a shift from an RxJS-stream-based model to a Signal-graph-based model.134.1. The Signal Form Model StructureIn legacy Reactive Forms, the FormGroup was the source of truth. In Signal Forms, the Form Model—a signal containing the raw data—is the source of truth. The form() function creates a FieldTree, a reactive proxy structure that mirrors the data model but augments it with state metadata (valid, touched, dirty).14Code Example: The Form ModelTypeScript// user-profile.component.ts
import { Component, signal, computed } from '@angular/core';
import { form, Field } from '@angular/forms/signals';
import { required, email } from './validators'; 

@Component({
  selector: 'user-profile',
  standalone: true,
  imports: [Field], // The directive for binding
  template: `
    <form (submit)="save()">
      <div class="field">
        <label>Email</label>
        <input [field]="form.email" type="email" />
        @if (form.email.errors().length) {
          <span class="error">{{ form.email.errors() }}</span>
        }
      </div>
      
      <button type="submit" [disabled]="form.invalid()">Save</button>
    </form>
  `
})
export class UserProfileComponent {
  // 1. The Data Source (Signal)
  user = signal({ email: '', age: 0 });

  // 2. The Form Tree
  // 'form' becomes a FieldTree<User>
  form = form(this.user, {
    validators: {
      email: [required(), email()],
      age: [required()]
    }
  });

  save() {
    if (this.form.valid()) {
      console.log('Saved:', this.user());
    }
  }
}
4.2. Testing Signal Forms: The State Access PatternTesting Signal Forms requires accessing the specific state signals exposed by the Field objects. Each field exposes signals for value(), valid(), touched(), dirty(), disabled(), and errors().14There is a critical distinction in testing patterns here.Legacy: We queried formGroup.get('email').setValue(...).Signal Forms: We update the underlying data signal or interact with the DOM via the Field directive.Key Testing Insight: The Field directive does not currently support exportAs, meaning we cannot easily reference the directive instance in the template using #myField="field".17 This reinforces the Sociable Testing requirement: we should interact with the <input> element directly, not the directive instance.Example Test Spec (Zoneless + Signal Forms):TypeScriptimport { render, screen, fireEvent } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { UserProfileComponent } from './user-profile.component';
import { TestBed } from '@angular/core/testing';

it('should validate email and manage button state', async () => {
  const { fixture } = await render(UserProfileComponent);
  const user = userEvent.setup();

  const input = screen.getByLabelText(/email/i);
  const button = screen.getByRole('button', { name: /save/i });

  // 1. Assert Initial State via DOM (Sociable)
  expect(button).toBeDisabled();

  // 2. Interact (Triggers Signal Update -> MarkForCheck -> CD)
  await user.type(input, 'invalid-email');
  await user.tab(); // Blur to set 'touched' state

  // 3. Await Stability
  // In Zoneless, we wait for the microtask queue where signals settle
  await fixture.whenStable();
  fixture.detectChanges(); // Update view with error message

  // 4. Assert Error State
  expect(screen.getByText('Invalid email format')).toBeVisible();
  expect(button).toBeDisabled();

  // 5. Correct the input
  await user.clear(input);
  await user.type(input, 'valid@company.com');
  
  await fixture.whenStable();
  fixture.detectChanges();

  // 6. Assert Success
  expect(screen.queryByText('Invalid email format')).toBeNull();
  expect(button).toBeEnabled();
});
This test interacts purely through the user interface layers (Input/Button), validating that the Signal Form logic correctly bridges the gap between user input and application state.5. Sociable Testing and the "No-Mock" ImperativeThe core philosophy of this strategy is Sociable Testing (often called "Classicist" testing). This contrasts with the "Mockist" (or London School) approach that has dominated Angular development.65.1. The Failure of the Mockist ApproachIn a Mockist test, every dependency is replaced with a Spy.Pros: Total isolation. If the test fails, it is definitely the component's fault.Cons: Extremely brittle. If ServiceB changes its method signature or return type, the mock in ComponentA.spec.ts becomes a lie. The test passes, but the application crashes in production. Furthermore, internal refactoring (extracting logic to a private helper in the service) breaks the spies.5.2. The Sociable DefinitionIn a Sociable test, we verify the Unit of Work, not the Unit of Code. A "Unit" is defined as the Component plus its tree of internal dependencies (Services, Pipes, Directives). We only mock at the System Boundaries.Boundaries include:The Network: HTTP requests (flaky, slow).Browser APIs: localStorage, window.location (global state pollution).Time: Date.now() (non-deterministic).Hardware: Camera, Geolocation.We DO NOT mock:UserService (Logic).FormatPipe (Transformation).SharedUiComponent (Presentation).5.3. Implementing the "No-Mock" PolicyTo enforce this, we avoid jasmine.createSpyObj or vi.fn() for services. Instead, we provide the real services in the TestBed.Table 2: Mockist vs. Sociable ConfigurationFeatureMockist Pattern (Banned)Sociable Pattern (Required)Service Provision{ provide: ApiService, useValue: spyObj }providers: [provideHttpClient()]Verificationexpect(spy.getUsers).toHaveBeenCalled()expect(screen.getByText('John')).toBeVisible()Networkspy.getUsers.and.returnValue(of(data))msw.use(rest.get('/users',...))Refactoring SafetyLow (Internal implementation is leaked)High (Only public behavior is tested)This approach shifts the burden of correctness from "did I call the function?" to "did the system behave as expected?". It aligns perfectly with Signal Forms, where we care about the outcome (is the button enabled?) rather than the mechanism (was form.valid() accessed?).6. The Network Seam: High-Fidelity Faking with MSW and ContractsSince we are using real services, they will attempt to make real HTTP requests. We must intercept these requests at the network layer. We utilize Mock Service Worker (MSW) for this, integrated into a "Zero Drift" pipeline using Orval and OpenAPI.196.1. The Zero-Drift PipelineThe greatest danger in using fakes is that the fake diverges from the real backend. To solve this, we treat the OpenAPI Specification (OAS) as the single source of truth.Workflow:Backend publishes openapi.yaml.Frontend Build runs Orval.Orval generates:TypeScript Interfaces (Models).Angular HttpClient services (Production code).MSW Request Handlers (Test code).Zod Schemas (Validation code).6.2. Orval ConfigurationThe following configuration automates the generation of both the production services and the test fixtures.File: orval.config.tsTypeScriptimport { defineConfig } from 'orval';

export default defineConfig({
  // 1. API Client Generation
  petstore: {
    input: './src/api/openapi.yaml',
    output: {
      mode: 'tags-split',
      target: './src/api/endpoints',
      schemas: './src/api/models',
      client: 'angular', // Generates Angular Services
      mock: true,        // Generates MSW Handlers with FakerJS
      override: {
        header: (info) => `// Generated by Orval - DO NOT EDIT\n`,
      },
    },
  },
  // 2. Zod Schema Generation
  petstoreZod: {
    input: './src/api/openapi.yaml',
    output: {
      mode: 'tags-split',
      client: 'zod',
      target: './src/api/schemas',
      fileExtension: '.zod.ts',
    },
  },
});
6.3. Using Generated Handlers in TestsOrval generates handlers that automatically return random mock data matching the API schema (using Faker.js). We can override this data per test.TypeScript// user.spec.ts
import { setupServer } from 'msw/node';
import { getUserMockHandler } from './api/endpoints/user/user.msw';
import { render, screen } from '@testing-library/angular';
import { UserComponent } from './user.component';
import { provideHttpClient } from '@angular/common/http';

// Setup MSW Server
const server = setupServer(
  // Default: Returns random data matching schema
  getUserMockHandler() 
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('should display specific user data', async () => {
  // Override: Return specific test data
  server.use(
    getUserMockHandler((req, res, ctx) => {
      return res(ctx.json({ id: '123', name: 'Specific User' }));
    })
  );

  await render(UserComponent, {
    providers: [provideHttpClient()]
  });

  expect(await screen.findByText('Specific User')).toBeVisible();
});
This guarantees that our "Fake" API behaves exactly like the real API, including data types and structural constraints.236.4. The Zod Validator BridgeTo fully close the loop, we use the Zod schemas generated by Orval to drive the Signal Forms validation. This ensures that frontend form validation logic is mathematically identical to the backend API validation logic.25TypeScript// util/zod-validator.ts
import { Validator } from '@angular/forms/signals';
import { z } from 'zod';

export function zodValidator<T>(schema: z.ZodSchema<T>): Validator<T> {
  return (control) => {
    const result = schema.safeParse(control.value());
    if (result.success) return null;
    return result.error.errors.map(e => e.message); // Return array of strings
  };
}
Usage in Component:TypeScriptimport { userSchema } from '../api/schemas/user.zod';

form = form(this.user, {
  validators: {
    // Apply the OpenAPI-derived schema directly to the form
    name:
  }
});
7. Layer Definitions and Component HarnessesTo maintain testability as complexity grows, we strictly define application layers and use CDK Harnesses to abstract DOM interactions.277.1. Layer DefinitionsLogic Layer (Services/Stores/Signals):Responsibility: Business rules, API communication, State transformations.Test Strategy: Unit tests with MSW. No DOM dependence. Strict input/output verification.Interaction Layer (Component Classes):Responsibility: Binding signals to templates, handling user events.Test Strategy: Sociable tests via Testing Library + Harnesses.Presentation Layer (Templates/CSS):Responsibility: Layout, styling, visual feedback.Test Strategy: Visual Regression Testing (VRT) via Playwright.7.2. Component Harnesses: The Interaction AbstractionWe adopt the Angular CDK Harness pattern not just for consuming Material components, but for authoring our own. A Harness acts as a Page Object Model (POM) for a component unit.Why Harnesses?If a test selects a button via button.save, and the developer changes the class name to btn-primary, the test breaks. If the test uses a harness await component.save(), the test is resilient to internal DOM changes.Custom Harness Example:TypeScript// user-profile.harness.ts
import { ComponentHarness } from '@angular/cdk/testing';

export class UserProfileHarness extends ComponentHarness {
  static hostSelector = 'user-profile';

  protected getSubmitButton = this.locatorFor('button[type="submit"]');
  protected getEmailInput = this.locatorFor('input[type="email"]');
  protected getErrorMessages = this.locatorForAll('.error');

  async enterEmail(email: string) {
    const input = await this.getEmailInput();
    await input.setInputValue(email);
    await input.blur();
  }

  async save() {
    const button = await this.getSubmitButton();
    await button.click();
  }

  async isSaveDisabled() {
    const button = await this.getSubmitButton();
    return button.isDisabled();
  }
  
  async getErrors() {
    const errors = await this.getErrorMessages();
    return Promise.all(errors.map(e => e.text()));
  }
}
This harness creates a stable API for testing the component, decoupling the test suite from the HTML structure.278. Visual Regression: Determinism via DockerWhile functional tests verify logic, they cannot verify that the UI looks correct. A pixel-perfect layout on macOS might break on Windows due to font rendering differences. To achieve "Production-Grade" VRT, we must eliminate environment variables.298.1. The Font Rendering ProblemBrowser rendering engines (Skia in Chrome) rely on the host operating system's font rasterization strategies (CoreText on macOS vs FreeType on Linux). This causes sub-pixel differences in text rendering, leading to "flaky" visual tests where a 1% pixel difference fails the pipeline.Solution: All VRT must run in a containerized Linux environment with pinned font binaries.8.2. Dockerized Playwright ArchitectureWe utilize Storybook to render components in isolation states (Loading, Error, Success). Playwright navigates to these stories, takes screenshots, and compares them against "Golden Masters" stored in the repo (via Git LFS).Dockerfile.vrt:Dockerfile# Use a specific Playwright version tag for immutability
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

# 1. Install specific fonts for consistent rendering across all machines
# 'fonts-liberation' provides metrics-compatible replacements for Arial/Times
# 'fonts-noto-color-emoji' ensures emojis render identically
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    fonts-noto-color-emoji \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Configure Fontconfig to strictly prefer these fonts
# This prevents the system from falling back to varying system fonts
COPY./.devcontainer/fonts.conf /etc/fonts/local.conf
RUN fc-cache -f -v

WORKDIR /app

# 3. Copy project files
COPY package*.json./
RUN npm ci

COPY..

# 4. Build Storybook (Static)
RUN npm run build-storybook

# 5. Run Playwright against the static build
CMD ["npx", "playwright", "test", "--config=playwright.vrt.config.ts"]
8.3. Playwright VRT ConfigurationWe configure Playwright to launch a local web server for the static Storybook build.TypeScript// playwright.vrt.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './vrt',
  // Fail if the snapshot doesn't match
  updateSnapshots: process.env.CI? 'none' : 'missing', 
  use: {
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  // Automatically spin up the static storybook server
  webServer: {
    command: 'npx http-server./storybook-static -p 6006',
    port: 6006,
    reuseExistingServer:!process.env.CI,
  },
  projects: },
    },
  ],
});
Developer Workflow:Developers do not run VRT directly on their host machine. They use a script:npm run vrt:docker -> Builds the Docker image and runs the tests inside it.npm run vrt:update -> Runs the Docker image with --update-snapshots to generate new baselines.329. Implementation Guide and Artifacts9.1. Code Template: The "No-Mock" Spec FileThis template brings together Zoneless testing, Sociable principles, MSW, and Harnesses.TypeScript// src/app/features/dashboard/dashboard.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DashboardComponent } from './dashboard.component';
import { DashboardHarness } from './dashboard.harness'; // Custom harness
import { setupServer } from 'msw/node';
import { getDashboardHandlers } from '../../api/endpoints/dashboard.msw'; // Generated by Orval

// 1. Setup MSW Server with auto-generated handlers
const server = setupServer(...getDashboardHandlers());

describe('DashboardComponent (Sociable)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let harness: DashboardHarness;

  // 2. MSW Lifecycle Management
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports:, // Standalone
      providers:
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    
    // 4. Zoneless Stability: Wait for init
    await fixture.whenStable(); 
    
    // 5. Initialize Harness
    const loader = TestbedHarnessEnvironment.loader(fixture);
    harness = await loader.getHarness(DashboardHarness);
  });

  it('should render stats from API', async () => {
    // 6. Interaction via Harness (Abstracts DOM)
    const stats = await harness.getStats();
    
    // 7. Assertions on visible state
    expect(stats.users).toBeGreaterThan(0); // Data from Faker
    expect(stats.revenue).toContain('$');
  });

  it('should handle API errors gracefully', async () => {
    // 8. Runtime Mock Override
    server.use(
      // Override specific handler for this test
     ...getDashboardHandlers((req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    // Reload component to trigger error
    await harness.refresh();
    
    expect(await harness.getErrorMessage()).toBe('Failed to load dashboard data');
  });
});
9.2. Guide: Setup ChecklistZoneless Config:In angular.json or project.json, ensure polyfills does not include zone.js.In main.ts, use bootstrapApplication(App, { providers: }).Vitest Config:Exclude zone.js in vitest.config.ts.Use jsdom environment.Orval Pipeline:Create orval.config.ts.Add script "gen:api": "orval".Run generation before tests.VRT:Build Dockerfile.vrt.Ensure all devs use the Docker script for snapshot updates.10. Conclusion and Strategic OutlookThis report outlines a rigorous, forward-looking testing strategy for Angular v21. By discarding the legacy of Zone.js and fakeAsync, we align with the framework's performant future. By adopting Signal Forms, we utilize Angular's finest-grained reactivity model. By enforcing Sociable Testing backed by MSW and Harnesses, we create a test suite that is resilient to implementation details and internal refactors. Finally, by containerizing Visual Regression, we solve the "works on my machine" problem once and for all.This architecture is not merely a set of tools but a shift in culture: from testing "code" to testing "behavior." It requires discipline—specifically the rejection of the easy path of mocking—but the reward is a codebase that allows developers to refactor with aggression and deploy with confidence.10.1. Second-Order InsightsThe "Unit" Redefined: In this architecture, a "Unit" expands from a single class to a "Feature Slice" (Component + Services + Pipes). This convergence with the React Testing Library philosophy suggests a unified future for frontend testing standards.Schema as Infrastructure: The usage of Zod and OpenAPI elevates schemas from documentation to critical infrastructure. The type system becomes the primary enforcer of contract integrity, reducing the need for extensive manual integration tests.10.2. Third-Order ImplicationsBackend Quality Pressure: The dependency on an up-to-date OpenAPI spec to drive the frontend test pipeline creates a feedback loop that forces better API documentation and "Spec-First" practices on the backend teams.DevX vs. Setup Cost: While the initial configuration (Docker, MSW, Orval) is high-effort, the reduction in flaky tests and maintenance overhead yields a positive ROI within the first few sprints of a project.End of Report
