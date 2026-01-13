# **Strategic Implementation of Agent Skills in Polyglot Monorepo Architectures: A Comprehensive Technical Report**

## **Executive Summary**

The convergence of generative AI and software engineering has reached a critical inflection point, transitioning from passive code completion to active, agentic collaboration. For enterprise-grade development environments, particularly those characterized by complex monorepo architectures encompassing diverse technology stacks such as Python, Angular, and Java, this shift presents both significant opportunities and profound challenges. The introduction of the "Agent Skills" standard—specifically the SKILLS.md specification—within the GitHub Copilot ecosystem represents a fundamental architectural evolution designed to address the scalability limits of context windows and the enforcement of rigid engineering standards.

This report provides an exhaustive analysis of the Agent Skills standard, evaluating its utility for enforcing strict development practices and managing extensive documentation in a polyglot environment. Through a detailed examination of the technical specification, integration mechanics within GitHub Copilot, and strategic application to monorepo governance, the analysis demonstrates that Agent Skills offer a robust solution to the "context saturation" problem. By shifting from static instruction files to dynamic, executable capabilities, development teams can operationalize "Long Documents" into just-in-time knowledge retrieval systems, ensuring that AI agents adhere to framework-specific best practices without cognitive overload. Furthermore, the report outlines a migration path for integrating existing "Orchestrator" and "Implementation" custom agents with the new Skills standard, culminating in a unified architecture that enforces rigorous version control and validation workflows through deterministic script execution.

## **1\. The Agentic Transformation of Software Engineering Context**

The software development industry is currently navigating a paradigm shift from "Prompt Engineering"—the art of crafting inputs to elicit better text generation—to "Context Engineering"—the systematic architecture of the information environment in which AI agents operate. This transition is driven by the recognition that while Large Language Models (LLMs) possess vast general knowledge, their ability to function effectively within a specific corporate codebase is constrained by the "Context Window"—the finite amount of information the model can process at any given moment.1

### **1.1 The Context Saturation Crisis in Monorepos**

In a monolithic repository (monorepo), the surface area of relevant domain knowledge is immense. A project containing a Python gRPC server, an Angular frontend, a Java client, and a TypeScript client represents a collision of distinct syntactic rules, architectural patterns, and testing philosophies. The traditional approach to AI configuration—loading a global .github/copilot-instructions.md file—fails catastrophically in this environment.

When a developer works on the Python backend, a global instruction file forces the LLM to ingest guidelines regarding Angular component lifecycles or Java memory management. This phenomenon, known as "Context Saturation," has two deleterious effects:

1. **Hallucination and Confusion:** The model, overwhelmed by irrelevant constraints, may attempt to apply frontend patterns to backend logic (e.g., suggesting a TypeScript interface for a Python dataclass).  
2. **Latency and Cost:** Transmitting thousands of tokens of irrelevant documentation increases the time-to-first-token and computational cost, degrading the developer experience (DX).

The user's specific challenge—managing "multiple LONG documents" describing best practices for disparate technologies—is the canonical use case for a new architectural primitive. Static text files are passive; they rely on the model's ability to retrieve and prioritize information amidst noise. To enforce "rigid development flows," a more active, structural mechanism is required.2

### **1.2 The Rise of Agent Skills**

The "Agent Skills" standard (SKILLS.md), originally championed by Anthropic and now adopted by GitHub Copilot, introduces the principle of "Progressive Disclosure" to AI interactions. Unlike static instructions which are always present, Skills are modular, self-contained capabilities that are discovered and loaded only when relevant to the user's immediate intent.

This architecture fundamentally alters the economics of context. Instead of paying the token cost for the entire "Angular Testing Best Practices" document on every query, the system pays only for the metadata (Name and Description). The full content is loaded only when the router determines the user is actually writing a test.1 This capability allows organizations to encode essentially infinite depth of documentation into their repositories without impacting the performance of general coding tasks.

### **1.3 Strategic Alignment with "Rigid Flows"**

Beyond documentation management, the user's requirement for "rigid development flows" (version control, PRs, validation) necessitates a move from *generative* behavior to *deterministic* execution. Text generation is probabilistic; a model asked to "check the build" might hallucinate a success message. Agent Skills bridge this gap by bundling executable scripts (Bash, Python) alongside instructions. This allows the agent to trigger a deterministic validation script—verifying the build *actually* passed—before generating the Pull Request description, thereby ensuring strict conformance to the development process.4

## **2\. Technical Architecture of the Agent Skills Standard**

To leverage Agent Skills for monorepo governance, one must understand the specification's precise mechanics. It acts as an interface layer between the raw capability of the LLM and the structured requirements of the engineering environment.

### **2.1 The Directory-as-a-Skill Paradigm**

Unlike previous configuration methods that relied on single files (e.g., .copilot-instructions.md), a Skill is defined as a directory. This distinction is critical. A folder structure allows for the colocation of three distinct types of context: Declarative (Metadata), Instructional (Prompts), and Executable (Scripts).5

**Table 1: Comparative Analysis of Configuration Primitives**

| Feature | Static Instructions (.md) | Custom Agents (.agent.md) | Agent Skills (SKILLS.md) |
| :---- | :---- | :---- | :---- |
| **Primary Unit** | Single File | Single File | Directory Structure |
| **Discovery Mechanism** | Global or Glob Pattern | Explicit User Selection | Semantic Routing via Description |
| **Context Loading** | Always / Condition-based | Always when Active | On-Demand (Progressive) |
| **Executable Assets** | None | Limited (via Tools) | Bundled Scripts & Templates |
| **Use Case** | General Style/Formatting | Role/Persona Definition | Complex Workflows & Deep Expertise |

### **2.2 The SKILL.md Manifest**

The nucleus of any skill is the SKILL.md file. It serves a dual purpose: it acts as the advertisement for the skill (via frontmatter) and the instruction manual (via body).

#### **2.2.1 YAML Frontmatter: The Semantic Router**

The frontmatter is the only portion of the skill that is indexed globally. The description field is not merely a comment; it is a prompt used by the orchestrator (Copilot's router) to determine relevance.

YAML

\---  
name: angular-testing-expert  
description: Use this skill when the user asks to create, refactor, or debug Angular unit tests (Jasmine/Karma). It contains strict guidelines on TestBed configuration and mocking strategies.  
license: MIT  
\---

For the user's monorepo, the precision of this description is paramount. A description like "Angular help" is too vague and might trigger during HTML editing. A description like "Angular Testing and Validation" ensures the skill is loaded specifically when the user is engaged in that phase of the lifecycle.6

#### **2.2.2 Markdown Body: The System Prompt**

The body of the SKILL.md file replaces the need for "Long Documents" in the global context. When triggered, this text is injected into the system prompt. This is where the user's "General Angular Best Practices" should be codified.

* **Role Definition:** "You are a Senior Angular Architect."  
* **Constraint Enforcement:** "You must use OnPush change detection for all components."  
* **Workflow Steps:** "Before generating code, you must check for existing services in src/app/core."

### **2.3 Bundled Resources: Scripts and References**

The directory structure enables the inclusion of auxiliary files that support the skill but are not loaded into the context window until explicitly requested by the agent.7

* **scripts/**: This directory houses the executable logic required for "rigid development flows." For a Python gRPC server, this might include a script generate\_protos.sh that ensures the correct compiler flags are always used. The agent is instructed to *execute* this script rather than attempting to remember the flags itself.6  
* **references/**: This directory is the ideal repository for the user's "Long Documents." Instead of putting the full "Angular Testing Best Practices" text into SKILL.md, one can place the document in references/testing-guide.md. The SKILL.md body then acts as a summary, instructing the agent: "If the user asks about advanced mocking scenarios, read references/testing-guide.md." This implies a **tertiary level of progressive disclosure**: Metadata \-\> Summary Instructions \-\> Deep Reference Material.9

## **3\. GitHub Copilot Integration Mechanics**

The integration of Agent Skills into GitHub Copilot transforms the IDE from a text editor into a managed runtime for agentic capabilities. Understanding the specific configuration and security models of VS Code is essential for safe implementation.

### **3.1 Enabling the Experimental Runtime**

As of early 2026, Agent Skills support in VS Code is managed through the chat.useAgentSkills setting. This flag enables the "Agent Mode" of Copilot to scan the .github/skills/ directory.10

* **Setting:** chat.useAgentSkills: true  
* **Discovery Path:** Copilot recursively scans .github/skills/ (project-scoped) and \~/.github/skills/ (user-scoped).  
* **Indexing:** The indexing process occurs on workspace load. Changes to SKILL.md descriptions may require a window reload or a specific command to refresh the skill index.12

### **3.2 The Security Sandbox: Auto-Approval and Allow-Lists**

The user's requirement for "presubmit validation checks" implies the execution of shell commands (e.g., running a linter or a test suite). Security is a primary concern here. If an agent can execute arbitrary code, it poses a risk. VS Code manages this through a permission system.

* **Terminal Approval:** By default, Copilot requests user confirmation before running any terminal command. For a "rigid flow" where the agent might run five different validation scripts in sequence, this manual approval is friction that destroys the "agentic" experience.  
* **Configuration:** The user can configure chat.tools.terminal.enableAutoApprove to true. Crucially, to maintain security while enabling automation, specific allow-lists can be defined.  
  * *Strategy:* Configure chat.tools.terminal.autoApprove to allow specific non-destructive commands (git status, npm test, ./scripts/\*.sh) while blocking potentially dangerous ones (rm, mv, upload). This creates a "Paved Road" where the agent can move fast within safe boundaries.10

### **3.3 Convergence with Custom Agents**

The user currently utilizes "Orchestrator" and "Implementation" agents. A common misconception is that Skills replace Agents. In reality, they are orthogonal and complementary.

* **Agents define the "Who":** The Orchestrator agent is configured with a persona focused on planning and decomposition.  
* **Skills define the "What":** The Skills provide the specialized knowledge required to execute the plan.

In the unified architecture, the "Implementation Agent" acts as the runtime container. It is the entity that "wields" the skills. When the user selects the Implementation Agent and asks for a Python change, the Agent's system prompt (which defines its obedient, execution-focused persona) is augmented by the python-grpc skill (which defines the technical rules). This layering ensures that the *style* of interaction remains consistent (via the Agent) while the *technical content* adapts (via the Skill).6

## **4\. Monorepo Strategy: The Federated Context Model**

The core challenge in the user's monorepo is the diversity of the stack (Python, Angular, Java). The Agent Skills standard enables a "Federated Context Model," where knowledge is strictly scoped to its domain.

### **4.1 De-coupling Knowledge**

In the legacy model, a global copilot-instructions.md would contain:

"For Angular, use RxJS. For Python, use asyncio. For Java, use CompletableFuture."  
This is brittle. The model must actively suppress the Java rules when writing Python.

In the Federated Model, we create strict boundaries:

* **.github/skills/angular-core/**: Activated only by Angular keywords.  
* **.github/skills/python-backend/**: Activated only by Python/gRPC keywords.  
* **.github/skills/java-client/**: Activated only by Java keywords.

This ensures that the "context pollution" is eliminated. When the agent is working on the Python server, the Angular skills remain unloaded, maximizing the tokens available for Python code analysis.6

### **4.2 Handling "Long Documents"**

The user's "Long Documents" describing best practices are valuable assets that typically go unused. We can convert them into **Active Reference Skills**.

#### **Case Study: The Angular Testing Guide**

Source Document: "Angular Testing Best Practices" (20 pages).  
Transformation Strategy:

1. **Extract the Rules:** Identify the "Must-Do" and "Must-Not-Do" rules (e.g., "Must use MockProvider"). Put these in the SKILL.md body.  
2. **Extract the Philosophy:** Identify the educational content (e.g., "Why we prefer unit tests over E2E"). Keep this in references/philosophy.md.  
3. **Extract the Boilerplate:** Identify the code templates. Put these in templates/spec.ts.

Resulting Skill Structure:  
.github/skills/angular-testing/  
├── SKILL.md (Contains the strict rules and triggers)  
├── scripts/  
│ └── validate-spec.sh (Runs 'ng test' for a specific file)  
├── templates/  
│ └── component.spec.ts (The 'Golden' template)  
└── references/  
└── full-guide.md (The original long document)  
When the user says "Write a test for this component," the agent loads SKILL.md. It sees the instruction: "Use the template at templates/component.spec.ts." It reads that file and generates the code. If the user asks "Why do we mock services?", the agent sees the instruction: "For reasoning, read references/philosophy.md," and loads that file. This is Just-In-Time Knowledge Management.14

### **4.3 Shared Infrastructure Skills**

Some flows cut across the monorepo, such as "Version Control Management." This requires a shared skill.  
Skill: git-workflow  
Description: "Use this skill for all git operations, commit messages, and branch management."  
Instructions: Enforces "Conventional Commits" standards, branch naming strategies (feature/, fix/), and strictly prohibits direct pushes to main. Because this skill has a broad description, it will be available to the agent regardless of whether it is working on Python or Angular code.

## **5\. Operationalizing Rigid Workflows**

The user's requirement for "rigid development flows" (PRs, presubmit checks) moves the discussion from code generation to workflow automation. This is where the Agentic capabilities of Copilot are most powerful.

### **5.1 The "Presubmit Validation" Pattern**

To ensure strict adherence to validation checks, we remove the human memory factor and the AI hallucination factor. We rely on **Deterministic Script Execution**.

**Skill Definition: release-gatekeeper**

* **Trigger:** User asks "Is this ready?" or "Create PR."  
* **Mechanism:** The skill instructs the agent that it *cannot* declare a task complete until it has successfully executed the bundled validation script.

The Script (scripts/verify.sh):  
This script acts as the source of truth. It detects which sub-project was modified (using git diff) and runs the appropriate test suite.

Bash

\#\!/bin/bash  
\# scripts/verify.sh  
CHANGED\_FILES=$(git diff \--name-only main)  
if echo "$CHANGED\_FILES" | grep \-q "frontend/"; then  
  echo "Angular changes detected. Running lint and test..."  
  npm run lint && npm run test:headless  
fi  
if echo "$CHANGED\_FILES" | grep \-q "backend/"; then  
  echo "Python changes detected. Running mypy..."  
  poetry run mypy.  
fi

The Instruction:  
In SKILL.md, the instruction is explicit:  
"Before generating a Pull Request description, you MUST execute scripts/verify.sh. If the script fails, you must fix the errors and re-run it. You are forbidden from creating a PR description until this script returns Exit Code 0."

This forces the "Implementation Agent" to enter a **Rejection Loop**:

1. Agent writes code.  
2. Agent runs verify.sh.  
3. Script fails (e.g., lint error).  
4. Agent reads error log.  
5. Agent fixes code.  
6. Agent runs verify.sh \-\> Success.  
7. Agent confirms readiness.

This satisfies the requirement for "conformance to rigid development flows" by leveraging the agent's ability to use tools (the terminal) as a constraint on its output.15

### **5.2 The "Pull Request Architect" Skill**

Once validation passes, the PR must be created. The user likely has a strict template.

**Skill Definition: pr-architect**

* **Asset:** templates/pr-structure.md (The template).  
* **Instruction:** "Read the template. Analyze the git diff. Fill out the template sections. In the 'Verification' section, explicitly list the output of the verify.sh script you just ran."

This links the validation step to the documentation step, creating a verified chain of custody for the code change.

## **6\. Implementation Roadmap: Converting Documents to Skills**

To achieve the user's desired state, a structured migration roadmap is recommended. This plan transitions from the current "Custom Agent" setup to the "Skills-First" architecture.

### **Phase 1: Knowledge Segmentation (Day 1-2)**

**Goal:** Break down the "Long Documents" into atomic units.

1. **Audit:** Review "General Angular Best Practices" and "Angular Testing Best Practices."  
2. **Categorize:** Tag sections as either "Rules" (Instructions), "Templates" (Assets), or "Background" (References).  
3. **Clean:** Remove any text that assumes a human reader (e.g., "Welcome to the team"). The AI needs direct imperatives.

### **Phase 2: Infrastructure Setup (Day 3\)**

**Goal:** Establish the directory structure.

1. Create .github/skills/.  
2. Initialize subdirectories: angular-dev, python-dev, java-dev, workflow-control.  
3. Configure VS Code settings.json:  
   JSON  
   "chat.useAgentSkills": true,  
   "chat.tools.terminal.enableAutoApprove": true,  
   "chat.tools.terminal.autoApprove": {  
       "git": true,  
       "npm": true,  
       ".github/skills/\*\*/\*.sh": true  
   }

   *Note: The autoApprove setting for specific paths is a crucial security feature to prevent unchecked execution while enabling the workflow.*.10

### **Phase 3: Skill Fabrication (Day 4-7)**

**Goal:** specific implementation of the skills.

* **Angular Skill:** Create .github/skills/angular-dev/SKILL.md. Populate frontmatter. Paste the "Rules" into the body. Save templates to templates/.  
* **Workflow Skill:** Create .github/skills/workflow-control/scripts/verify.sh. Implement the logic to detect changed monorepo paths and run tests.

### **Phase 4: Agent Integration (Day 8\)**

**Goal:** Connect the existing Custom Agents to the new Skills.

1. **Orchestrator Agent:** Update .github/agents/orchestrator.agent.md.  
   * *Prompt Update:* "You are aware of the workflow-control skill. Always verify that the Implementation Agent has run the validation scripts before marking a plan as complete."  
2. **Implementation Agent:** Update .github/agents/implementation.agent.md.  
   * *Prompt Update:* "You are a polyglot engineer. You must check for available skills in .github/skills relevant to the technology you are touching. You must strictly adhere to the guidelines found in those skills."

### **Phase 5: Verification (Day 9\)**

**Goal:** Test the "Rejection Loop."

1. Intentionally introduce a linting error in an Angular file.  
2. Ask the Implementation Agent: "Prepare this for PR."  
3. Verify that it activates the workflow-control skill, runs the script, sees the failure, and attempts to fix it *before* presenting the PR text.

## **7\. Comparative Analysis: Custom Agents vs. Skills**

The user specifically asked about the relationship between their existing Custom Agents and the new standard.

**Table 2: Integration Strategy**

| Dimension | Custom Agents (Current State) | Agent Skills (Target State) | Integration Strategy |
| :---- | :---- | :---- | :---- |
| **Scope** | Broad (e.g., "Implementation Agent") | Narrow (e.g., "Angular Testing") | The Agent *invokes* the Skill. |
| **Maintenance** | Single monolithic prompt file | Distributed, modular files | Skills reduce the size of Agent prompts. |
| **Logic** | "Please remember to run tests" | run-tests.sh (Deterministic) | Move rigid logic from Agent prompt to Skill script. |
| **Context** | Often overloaded with all rules | Loaded on demand | Agent remains lightweight; Skills add weight only when needed. |

**Strategic Insight:** The "Orchestrator" and "Implementation" agents should remain the primary user interface. They represent the "Human-AI Contract" (roles and responsibilities). The Skills represent the "Organizational Knowledge" (rules and tools). By decoupling them, the user ensures that if they hire a new "QA Agent," it can immediately utilize the same angular-testing skill without reconfiguration.

## **8\. Future Trajectory and Strategic Recommendations**

The adoption of SKILLS.md positions the user's monorepo for the next phase of AI development: **Model Context Protocol (MCP) Convergence**.

Currently, Skills are "local"—they live in the file system. MCP Servers are "remote"—they live in processes (e.g., a PostgreSQL database connection or a Jira integration). The industry trend suggests a merger where Skills will define *how* to use MCP tools.17

**Strategic Recommendations:**

1. **Adopt Early, Standardize Strict:** Since the standard is open, building a library of skills now creates a competitive moat of organizational knowledge.  
2. **Audit Scripts Security:** Treat the scripts/ directory as high-risk code. Enforce code reviews on any change to a .sh or .py file inside .github/skills/, as these are executed by the AI with the user's credentials.9  
3. **Metrics and Feedback:** Monitor how often skills are triggered (VS Code often indicates "Used skill: X"). If angular-dev is triggering on Python tasks, refine the description in the frontmatter to be more exclusive.

## **9\. Conclusion**

For a polyglot monorepo owner struggling with "Context Saturation" and "Workflow Variance," the Agent Skills standard is not merely a feature update—it is an architectural necessity. By moving from passive documentation to active, executable Skills, the user can ensure that their "Long Documents" are operationalized into just-in-time guidance.

The "Orchestrator" and "Implementation" agents the user currently employs will evolve from being "prompts that ask for compliance" to "drivers that enforce compliance" via the execution of bundled scripts. This creates a development environment where the rigid flows are safeguarded not by human vigilance, but by the deterministic scaffolding of the Agent Skills architecture. This transition turns the monorepo from a chaotic mix of technologies into a federated system of expert agents, each perfectly knowledgeable about its specific domain and strictly bound by the organization's governance protocols.

#### **Works cited**

1. Claude's Skills Framework Quietly Becomes an Industry Standard \- Unite.AI, accessed January 9, 2026, [https://www.unite.ai/claudes-skills-framework-quietly-becomes-an-industry-standard/](https://www.unite.ai/claudes-skills-framework-quietly-becomes-an-industry-standard/)  
2. How to build reliable AI workflows with agentic primitives and context engineering, accessed January 9, 2026, [https://github.blog/ai-and-ml/github-copilot/how-to-build-reliable-ai-workflows-with-agentic-primitives-and-context-engineering/?utm\_source=blog-release-oct-2025\&utm\_campaign=agentic-copilot-cli-launch-2025](https://github.blog/ai-and-ml/github-copilot/how-to-build-reliable-ai-workflows-with-agentic-primitives-and-context-engineering/?utm_source=blog-release-oct-2025&utm_campaign=agentic-copilot-cli-launch-2025)  
3. agents/docs/agent-skills.md at main · wshobson/agents \- GitHub, accessed January 9, 2026, [https://github.com/wshobson/agents/blob/main/docs/agent-skills.md](https://github.com/wshobson/agents/blob/main/docs/agent-skills.md)  
4. AL Development Collection: First Skill Available- BC Diagnostics \- Tech Sphere Dynamics, accessed January 9, 2026, [https://techspheredynamics.com/2025/12/23/al-development-collection-first-skill-available-bc-diagnostics/](https://techspheredynamics.com/2025/12/23/al-development-collection-first-skill-available-bc-diagnostics/)  
5. awesome-copilot/docs/README.skills.md at main \- GitHub, accessed January 9, 2026, [https://github.com/github/awesome-copilot/blob/main/docs/README.skills.md](https://github.com/github/awesome-copilot/blob/main/docs/README.skills.md)  
6. Use Agent Skills in VS Code, accessed January 9, 2026, [https://code.visualstudio.com/docs/copilot/customization/agent-skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills)  
7. skillport/guide/creating-skills.md at main \- GitHub, accessed January 9, 2026, [https://github.com/gotalab/skillport/blob/main/guide/creating-skills.md](https://github.com/gotalab/skillport/blob/main/guide/creating-skills.md)  
8. heilcheng/awesome-agent-skills: A curated list of skills, tools, tutorials, and capabilities for AI coding agents (Claude, Codex, Copilot, VS Code) \- GitHub, accessed January 9, 2026, [https://github.com/heilcheng/awesome-agent-skills](https://github.com/heilcheng/awesome-agent-skills)  
9. Equipping agents for the real world with Agent Skills \- Anthropic, accessed January 9, 2026, [https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)  
10. GitHub Copilot in VS Code settings reference, accessed January 9, 2026, [https://code.visualstudio.com/docs/copilot/reference/copilot-settings](https://code.visualstudio.com/docs/copilot/reference/copilot-settings)  
11. Secure AI Prompts with PyRIT Validation & Agent Skills | luke.geek.nz, accessed January 9, 2026, [https://luke.geek.nz/azure/pyrit-agent-skills-prompt-validation/](https://luke.geek.nz/azure/pyrit-agent-skills-prompt-validation/)  
12. GitHub Copilot Agent Skills: Teaching AI Your Repository Patterns \- Medium, accessed January 9, 2026, [https://medium.com/ai-in-quality-assurance/github-copilot-agent-skills-teaching-ai-your-repository-patterns-01168b6d7a25](https://medium.com/ai-in-quality-assurance/github-copilot-agent-skills-teaching-ai-your-repository-patterns-01168b6d7a25)  
13. Creating custom agents \- GitHub Docs, accessed January 9, 2026, [https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents)  
14. Understanding Skills, Agents, Subagents, and MCP in Claude Code: When to Use What, accessed January 9, 2026, [https://colinmcnamara.com/blog/understanding-skills-agents-and-mcp-in-claude-code](https://colinmcnamara.com/blog/understanding-skills-agents-and-mcp-in-claude-code)  
15. Writing Skills \- obra/superpowers \- GitHub, accessed January 9, 2026, [https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md)  
16. Agent Skills: Governing Coding Agents Before They Govern Us | by Dave Patten \- Medium, accessed January 9, 2026, [https://medium.com/@dave-patten/agent-skills-governing-coding-agents-before-they-govern-us-f458c6d0eace](https://medium.com/@dave-patten/agent-skills-governing-coding-agents-before-they-govern-us-f458c6d0eace)  
17. Claude Skills vs. MCP: A Technical Comparison for AI Workflows | IntuitionLabs, accessed January 9, 2026, [https://intuitionlabs.ai/articles/claude-skills-vs-mcp](https://intuitionlabs.ai/articles/claude-skills-vs-mcp)  
18. Agent vs MCP vs Skills | Cirrius Solutions, accessed January 9, 2026, [https://cirriussolutions.com/agent-vs-mcp-vs-skills/](https://cirriussolutions.com/agent-vs-mcp-vs-skills/)