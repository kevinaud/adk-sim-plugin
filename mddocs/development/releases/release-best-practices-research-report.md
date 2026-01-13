# **Architecting Secure Polyglot Release Pipelines: OIDC Integration and Monorepo Strategy for Python and TypeScript**

## **Executive Summary**

The modernization of software supply chain security has necessitated a fundamental shift in how artifacts are published to public registries. The industry-wide deprecation of long-lived API tokens in favor of OpenID Connect (OIDC) authentication establishes a cryptographic chain of custody between the source code repository and the build artifact. However, implementing this security model within a polyglot monorepo—containing interdependent Python and TypeScript packages—introduces complex architectural challenges regarding identity federation, dependency resolution, and release synchronization.

This report provides a comprehensive architectural analysis and implementation guide for the adk-agent-sim project. It addresses the specific constraints of publishing five interdependent artifacts (Foundation, Utility, Application, Library) from a single GitHub repository to PyPI and NPM. The analysis reveals that while OIDC eliminates credential management overhead, it imposes strict uniqueness constraints on PyPI's "Pending Publisher" model that conflict with naive monorepo CI definitions. Furthermore, the interdependent nature of the artifacts necessitates a "Build-Verify-Publish" strategy that prioritizes local artifact verification over external staging registries like TestPyPI to mitigate dependency confusion attacks and resolution failures.

**Key Architectural Recommendations:**

1. **Consolidated Workflow Topology:** Adoption of a single, unified GitHub Actions workflow to satisfy PyPI's security model while maintaining DRY (Don't Repeat Yourself) principles, utilizing a "Manual Prime" bootstrapping strategy to overcome initial registration constraints.  
2. **Synchronized Polyglot Versioning:** Implementation of **Changesets** in "Fixed Mode," augmented by a custom Python synchronization hook. This provides the requisite version-locked updates across languages and supports the developer-initiated "Release PR" workflow superior to fully automated alternatives like *Release Please*.  
3. **Local-First Verification:** Rejection of TestPyPI for CI staging in favor of **Ephemeral Local Registries** (Verdaccio for NPM) and **Local Wheel Installation** (for Python) using uv. This guarantees that the exact bytes tested are the bytes published, eliminating the "Dependency Hell" associated with mixing test and production indices.

---

**1\. Strategic Context: The Shift to OIDC and SLSA Compliance**

The requirement to implement OpenID Connect (OIDC) is not merely a configuration change; it is an adoption of the Supply Chain Levels for Software Artifacts (SLSA) framework. Understanding the theoretical and mechanical underpinnings of this shift is essential for designing a robust pipeline for adk-agent-sim.

### **1.1 The Vulnerability of Static Credentials**

Historically, publishing to PyPI or NPM required generating an API token (e.g., pypi-AgEI...) and storing it as a long-lived secret in the CI environment (e.g., PYPI\_PASSWORD). This model presents several critical security surface areas:

* **Scope Creep:** Tokens are often created with excessive permissions (e.g., user-scoped rather than project-scoped) to reduce administrative friction.  
* **Leakage:** Tokens can be inadvertently logged, exposed in forks, or compromised via compromised maintainer accounts.  
* **Lack of Provenance:** A token validates *who* is publishing (the account holder) but not *where* or *how* the artifact was built. A compromised developer laptop could upload a malicious wheel using a valid token, and the registry would accept it.

### **1.2 OpenID Connect (OIDC): The Identity-Based Paradigm**

OIDC inverts the authentication model. Instead of a secret "something you have" (the token), it relies on "who you are" (the identity of the workload).

The Mechanics of the Exchange:  
When the proposed GitHub Actions workflow runs, the following cryptographic handshake occurs:

1. **Token Request:** The publish.yaml job requests a JSON Web Token (JWT) from GitHub's internal OIDC provider.  
2. **Claim Generation:** GitHub mints a JWT signed with its private key. This token contains specific "claims" about the execution context:  
   * iss (Issuer): https://token.actions.githubusercontent.com  
   * sub (Subject): repo:org/adk-agent-sim:ref:refs/tags/v0.2.0  
   * aud (Audience): pypi (or npm)  
   * job\_workflow\_ref: org/adk-agent-sim/.github/workflows/publish.yaml@refs/tags/v0.2.0  
3. **Verification:** The workflow sends this JWT to the package registry (PyPI/NPM).  
4. **Trust Evaluation:** The registry fetches GitHub's public keys to verify the signature. It then checks the claims against a pre-configured "Trusted Publisher" policy.  
   * *PyPI Check:* Does the sub match the configured repository? Does the job\_workflow\_ref match the registered workflow filename?.1  
5. **Token Minting:** If verified, the registry mints a strictly scoped, ephemeral API token valid only for the duration of the upload (typically 15 minutes).2

Implication for adk-agent-sim:  
This architecture mandates that the workflow filename and the repository structure become part of the security identity. Changing the workflow filename (publish.yaml to release.yaml) breaks the trust relationship, causing immediate authentication failures. This rigidity is a feature, not a bug, ensuring that only the specific, audited CI process can publish releases.4

---

**2\. Architectural Analysis of the Polyglot Monorepo**

The adk-agent-sim project is a classic Polyglot Monorepo. Unlike single-language repositories, it faces the "Dual Dependency Graph" problem where dependencies exist both within a language ecosystem (Python importing Python) and arguably across the release lifecycle (the Server requires the Protos to be published first).

### **2.1 The Topology and Artifact Map**

We must formally define the artifacts and their relationships to understand the constraints on the release pipeline.

| Artifact | Language | Type | Dependency Tier | Dependencies |
| :---- | :---- | :---- | :---- | :---- |
| **A: adk-sim-protos** | Python | Library | Foundation (Tier 0\) | None |
| **B: @adk-sim/protos** | TypeScript | Library | Foundation (Tier 0\) | None |
| **C: adk-sim-testing** | Python | Utility | Intermediate (Tier 1\) | Requires **A** |
| **D: adk-sim-server** | Python | Application | Leaf (Tier 2\) | Requires **A**, **C** |
| **E: adk-agent-sim** | Python | Library | Leaf (Tier 2\) | Requires **A**, **C** |

Constraint 2.1.1 (Version Locking):  
The requirement states: "All packages are version-locked (e.g., if one bumps to 0.2.0, they all bump)."  
This simplifies the decision-making process (we do not need complex independent versioning logic) but complicates the publishing process. We cannot publish Artifact D (v0.2.0) until Artifact A (v0.2.0) is available on the public index. If D is installed before A propagates, pip install adk-sim-server will fail because adk-sim-protos==0.2.0 cannot be found.6

### **2.2 The Development vs. Distribution Dichotomy**

A critical insight is the difference between *Development* dependency resolution and *Distribution* dependency resolution.

**Development (Local):**

* **Python (uv):** Uses \[tool.uv.sources\] workspace \= true. uv resolves dependencies by looking at the local file system (e.g., ../adk-sim-protos). This allows developers to iterate on A and D simultaneously without publishing.7  
* **TypeScript (npm):** Uses workspaces in package.json. NPM links local folders in node\_modules.

**Distribution (Public):**

* **Python (PyPI):** The published wheel for D must *not* have local path references. It must declare a dependency on adk-sim-protos==0.2.0 (from PyPI). uv build handles this translation automatically if configured correctly, stripping local workspace references in favor of standard PEP 621 metadata.7  
* **TypeScript (NPM):** The published package must reference the version number, not the local file path.

**Architectural Risk:** If the CI pipeline verifies the build using *local* links but publishes artifacts expecting *remote* links, we introduce a verification gap. The "Staging Strategy" (Section 5\) must address this by verifying the *installability* of the artifacts as if they were remote, even if they are local.

---

**3\. Deep Dive: PyPI Trusted Publisher Constraints**

The user's observation—"PyPI rejected the second configuration silently. When we changed the filename for the second package, it worked"—is a documented but often misunderstood behavior of PyPI's "Pending Publisher" system.

### **3.1 The Uniqueness Constraint Explained**

PyPI distinguishes between two states:

1. **Pending Publisher:** A configuration for a project that does *not yet exist* on PyPI.  
2. **Trusted Publisher:** A configuration for an *existing* project.

**The Pending Constraint:** To prevent ambiguity, PyPI enforces strict uniqueness on Pending Publishers. You cannot map the tuple (Owner, Repo, Workflow, Environment) to multiple potential future projects.

* *Why?* When the OIDC token arrives asserting "I am publish.yaml from repo/adk," PyPI needs to know *exactly* which pending project to create. If both adk-sim-protos and adk-sim-server are registered as pending with the same workflow, PyPI cannot deterministically decide which project to create upon the first upload.9

**The Trusted Capability:** Conversely, once projects exist, PyPI *does* allow a one-to-many relationship. A single publish.yaml can be configured as a Trusted Publisher for adk-sim-protos, adk-sim-server, and adk-sim-testing simultaneously. The OIDC token is valid for *all* projects that trust it.3

### **3.2 Solving the Bootstrapping Deadlock**

The user asked: "Does this force us to split our CI definition?"  
The answer is: Only for the first five minutes.  
We have two architectural options to bootstrap the repository:

#### **Option A: The "Split-Then-Merge" Pattern**

1. Create publish-protos.yaml, publish-server.yaml, publish-testing.yaml.  
2. Register each as a distinct Pending Publisher on PyPI.  
3. Trigger a release to create the projects.  
4. Delete the split files and consolidate to publish.yaml.  
5. Update PyPI to trust publish.yaml for all projects.

*Critique:* This pollutes the git history and requires unnecessary CI churn.

#### **Option B: The "Manual Prime" Pattern (Recommended)**

1. Generate a standard API Token (scoped to the user or a temporary scope).  
2. Manually build and upload the initial version (0.0.1 or 0.1.0) of all artifacts to PyPI using twine or uv publish \--token....  
   * *Note:* This "primes" the projects. They now exist.  
3. Go to PyPI settings for each project \-\> Publishing \-\> Add Trusted Publisher.  
4. Configure all 5 projects to trust the **same** publish.yaml workflow.  
5. There is no "Pending" uniqueness constraint because the projects already exist.

**Conclusion for Area 1:** PyPI does *not* enforce a permanent 1:1 mapping for existing projects. It only enforces it for *pending* projects to resolve the creation ambiguity. Use the "Manual Prime" method to allow a consolidated, DRY publish.yaml workflow.3

---

**4\. Deep Dive: NPM OIDC Implementation**

NPM's OIDC implementation differs from PyPI's. It is tightly coupled with **Provenance**, a mechanism powered by Sigstore that signs the package with the OIDC identity.

### **4.1 The Gold Standard: npm publish \--provenance**

The current gold standard for NPM publishing from GitHub Actions is utilizing the native NPM CLI support for provenance.

**Requirements:**

1. **NPM Version:** Must be v9.5.0 or later (which supports provenance).  
2. **Access:** The package must be public (or the organization must have a paid plan that supports private provenance, though typically provenance is for public verification).11  
3. **Permissions:** The GitHub Action job must have id-token: write permission to request the OIDC token.13

### **4.2 Configuration Details (package.json)**

The package.json requires specific metadata to link the artifact back to the source. If this is missing, provenance generation will fail.

**Required Fields:**

* publishConfig: Used to force public access (for scoped packages like @adk-sim/protos) and enable provenance explicitly (though often default in newer CLIs, explicit is better).12  
* repository: NPM uses this to verify the OIDC token's repository claim matches the package metadata.

JSON

// packages/protos/package.json  
{  
  "name": "@adk-sim/protos",  
  "version": "0.2.0",  
  "repository": {  
    "type": "git",  
    "url": "git+https://github.com/my-org/adk-agent-sim.git",  
    "directory": "packages/protos"  // Crucial for monorepos  
  },  
  "publishConfig": {  
    "access": "public",  
    "provenance": true,  
    "registry": "https://registry.npmjs.org/"  
  }  
}

*Insight:* The directory field in the repository object is vital in a monorepo. It tells the provenance verifier exactly where in the repo this package lives.15

---

**5\. Release Orchestration: The "Release PR" Workflow**

The user requires a specific workflow: make release-pr-minor \-\> Branch \-\> PR \-\> Merge \-\> Tag \-\> Publish. This explicitly places the human in the loop for *initiating* the release, but wants automation for the *execution*.

### **5.1 Tooling Selection: Changesets vs. Release Please**

The market leaders for monorepo versioning are **Changesets** and **Release Please**.

| Feature | Release Please | Changesets | Fit for Project |
| :---- | :---- | :---- | :---- |
| **Trigger Model** | **Automatic**: Watches main, creates PRs automatically based on commits. | **Manual/Hybrid**: Developer creates "intent files". Explicit command generates PR. | **Changesets** aligns with "Developer runs command". |
| **Versioning Logic** | Strict Semantic Versioning based on Commit Messages. | Semantic Versioning based on Intent Files (Manual override possible). | **Changesets** allows easier manual grouping. |
| **Locked Versioning** | Supported via linked-versions plugin. | Supported natively via "Fixed Mode". | Both work, but Changesets' fixed mode is more explicit.17 |
| **Polyglot Support** | Native plugins for Python, Java, Node. | Primarily JS-focused, requires plugins/scripts for others. | **Release Please** is stronger natively, but **Changesets** is more flexible for custom workflows. |

**Decision:** **Changesets** is the superior choice for this specific requirement. *Release Please* fights against the "manual trigger" requirement (it wants to own the PR creation loop). Changesets allows the developer to decide *when* to version by running changeset version.

### **5.2 Adapting Changesets for Python**

Changesets natively updates package.json and CHANGELOG.md. It does not know how to update pyproject.toml.  
We must implement a Synchronization Hook.  
**The Workflow:**

1. **Intent:** Developers commit changes. They run npx changeset to add a markdown file describing the change.  
2. **Version:** Developer runs make release-pr-minor.  
   * This runs npx changeset version.  
   * Changesets calculates the new version (e.g., 0.2.0) and updates package.json for the TypeScript artifacts.  
3. **Sync (The Missing Link):** We execute a custom script (e.g., python scripts/sync\_versions.py) immediately after the version command.  
   * This script reads the new version from the "Source of Truth" (e.g., packages/protos/package.json or the changeset state).  
   * It iterates through all pyproject.toml files.  
   * It updates version \= "0.2.0".  
   * It updates dependencies: adk-sim-protos \== 0.2.0.

This approach keeps the tooling simple (Changesets handles the math and changelogs; Python handles the file IO) and satisfies the "Version Locked" requirement perfectly.

---

**6\. Pre-Publish Verification: The Staging Strategy**

The requirement is to "prove packages are installable as a user would experience them" before publishing.

### **6.1 The TestPyPI Fallacy**

Using TestPyPI for CI in a monorepo is an anti-pattern.

* **Dependency Resolution Failure:** If you publish adk-sim-server to TestPyPI, and it depends on requests (public PyPI) and adk-sim-protos (TestPyPI), pip fails.  
  * \--index-url testpypi: Finds adk-sim-protos but fails on requests.  
  * \--extra-index-url pypi: Vulnerable to "Dependency Confusion." If a malicious actor uploads adk-sim-protos v99.9.9 to the *real* PyPI, pip might install that instead of your TestPyPI version.6  
* **Speed & Flakiness:** TestPyPI is slower, often pruned, and adds network latency.

### **6.2 Recommended Strategy: Local Artifact Verification**

The most robust "Staging" is not a remote server, but a local, isolated environment using the *exact build artifacts* that are about to be published.

Python Strategy (uv):  
uv and pip support installing from a local directory of wheels while resolving external dependencies from PyPI.  
Command:

Bash

uv pip install \--find-links./dist adk-sim-server

* \--find-links./dist: Tells the installer to look for packages (like adk-sim-protos) in the local ./dist folder first.  
* Default Index: Tells the installer to look for missing packages (like requests) on PyPI.  
* **Result:** This exactly mimics the user experience of "installing from PyPI" without actually publishing to PyPI. It verifies the dependency metadata in the wheels is correct and compatible.

NPM Strategy (Verdaccio):  
For NPM, local file linking (npm link) behaves differently than registry installation (symlinks vs copies). To verify strictly, we use Verdaccio, a lightweight private registry proxy.

* **In CI:** Spin up Verdaccio in a background container.  
* **Publish:** Run npm publish \--registry http://localhost:4873.  
* **Install:** In a temporary folder, run npm install @adk-sim/protos \--registry http://localhost:4873.  
* **Verify:** Check if the installation succeeds and the files are present.

This approach guarantees "installability" with 100% fidelity to a public release.18

---

**7\. Implementation Guide**

This section provides the concrete deliverables: configurations and workflows.

### **7.1 Workflow Architecture (The release.yaml File)**

We utilize a **Consolidated Dispatch** pattern. The workflow triggers on tags (v\*), builds everything, verifies locally, and then publishes in topological order.

**Key Architecture Decisions:**

* **Single Workflow:** Satisfies OIDC trust easily.  
* **Serialized Jobs:** publish-foundation runs before publish-application to solve the dependency race condition.  
* **Environment Gates:** Uses GitHub Environments (pypi) to enforce OIDC trust policies.

### **7.2 Configuration Guide**

#### **A. Python (pyproject.toml) \- Artifact D (Server)**

Ini, TOML

\[project\]  
name \= "adk-sim-server"  
version \= "0.2.0" \# Managed by sync script  
dependencies \= \[  
  "adk-sim-protos==0.2.0",  \# Exact pin for lock-step  
  "adk-sim-testing==0.2.0"  
\]

\# uv Local Development Sources  
\# This allows 'uv sync' to work locally without publishing  
\[tool.uv.sources\]  
adk-sim-protos \= { workspace \= true }  
adk-sim-testing \= { workspace \= true }

\[build-system\]  
requires \= \["hatchling"\]  
build-backend \= "hatchling.build"

#### **B. TypeScript (package.json) \- Artifact B (Protos)**

JSON

{  
  "name": "@adk-sim/protos",  
  "version": "0.2.0",  
  "publishConfig": {  
    "access": "public",  
    "provenance": true,  
    "registry": "https://registry.npmjs.org/"  
  },  
  "repository": {  
    "type": "git",  
    "url": "git+https://github.com/org/adk-agent-sim.git",  
    "directory": "packages/protos"  
  }  
}

### **7.3 Tooling Recommendations: The "Sync Script"**

We need a script to bridge Changesets (JS) and Python.

**File:** scripts/sync\_versions.py

Python

import tomlkit  
import json  
import os

\# Define the monorepo structure  
PROJECTS \= \[  
    "adk-sim-protos",  
    "adk-sim-testing",  
    "adk-sim-server",  
    "adk-agent-sim"  
\]

def sync():  
    \# 1\. Read the 'Source of Truth' (The JS Foundation package updated by Changesets)  
    with open("packages/protos/package.json") as f:  
        new\_version \= json.load(f)\["version"\]  
      
    print(f"Syncing all Python projects to version: {new\_version}")

    for proj in PROJECTS:  
        toml\_path \= os.path.join(proj, "pyproject.toml")  
          
        with open(toml\_path, "r") as f:  
            doc \= tomlkit.parse(f.read())  
          
        \# Update project version  
        doc\["project"\]\["version"\] \= new\_version  
          
        \# Update internal dependencies to match the new version  
        if "dependencies" in doc\["project"\]:  
            deps \= doc\["project"\]\["dependencies"\]  
            for i, dep in enumerate(deps):  
                \# Check if dependency is one of our internal projects  
                for internal\_proj in PROJECTS:  
                    if dep.startswith(internal\_proj):  
                        \# Force exact match \==new\_version  
                        deps\[i\] \= f"{internal\_proj}\=={new\_version}"  
          
        with open(toml\_path, "w") as f:  
            f.write(doc.as\_string())

if \_\_name\_\_ \== "\_\_main\_\_":  
    sync()

### **7.4 The Makefile Orchestrator**

This connects the developer intent to the tooling.

Makefile

**.PHONY**: release-pr-minor

release-pr-minor:  
	@echo "Creating Release PR for Minor Version..."  
	\# 1\. Ensure clean state  
	git checkout main  
	git pull  
	  
	\# 2\. Create Branch  
	$(eval NEW\_BRANCH := release/$(shell date \+%s))  
	git checkout \-b $(NEW\_BRANCH)  
	  
	\# 3\. Calculate Version (JS)  
	\# Assumes.changeset/config.json is set to "fixed" mode  
	npx changeset version  
	  
	\# 4\. Sync Python Versions  
	python3 scripts/sync\_versions.py  
	  
	\# 5\. Commit and PR  
	git add.  
	git commit \-m "chore: version packages for release"  
	git push origin $(NEW\_BRANCH)  
	gh pr create \--title "Release: Version Bump" \--body "Automated release prep."

### **7.5 The GitHub Action (.github/workflows/publish.yaml)**

YAML

name: Polyglot Publish

on:  
  push:  
    tags:  
      \- 'v\*'  \# Trigger on tag push

permissions:  
  contents: read  
  id-token: write  \# Critical for OIDC

jobs:  
  \# PHASE 1: BUILD & VERIFY (Staging)  
  verify-and-build:  
    runs-on: ubuntu-latest  
    steps:  
      \- uses: actions/checkout@v4  
      \- uses: astral-sh/setup-uv@v1  
      \- uses: actions/setup-node@v4  
        with:  
          node-version: '20'

      \# Build Python  
      \- name: Build Wheels  
        run: uv build \--all  
        
      \# Build TS  
      \- name: Build NPM  
        run: npm ci && npm run build \--workspaces

      \# STAGING STRATEGY: Local Install Verification  
      \- name: Verify Python Installation  
        run: |  
          uv venv.verify  
          source.verify/bin/activate  
          \# Install 'Leaf' artifact (Server).   
          \# \--find-links tells it to look in./dist for the Foundation artifact  
          uv pip install adk-sim-server \--no-index \--find-links./dist  
          \# Smoke test import  
          python \-c "import adk\_sim\_server; print('Server Importable')"

      \# STAGING STRATEGY: Verdaccio Verification  
      \- name: Verify NPM Installation  
        uses: verdaccio/github-actions/publish@v1  
        with:  
          publish-cmd: npm publish \--workspaces \--registry http://localhost:4873  
        
      \# Persist Artifacts for Publishing Phase  
      \- uses: actions/upload-artifact@v4  
        with:  
          name: dist-artifacts  
          path: |  
            dist/  
            packages/\*/dist/

  \# PHASE 2: PUBLISH FOUNDATION (A/B)  
  publish-foundation:  
    needs: verify-and-build  
    runs-on: ubuntu-latest  
    environment: pypi  
    steps:  
      \- uses: actions/checkout@v4  
      \- uses: actions/download-artifact@v4  
        with:  
          name: dist-artifacts  
        
      \- name: Publish Python Protos  
        uses: pypa/gh-action-pypi-publish@release/v1  
        with:  
          packages-dir: dist/adk\_sim\_protos/  
        
      \- name: Publish NPM Protos  
        run: npm publish packages/protos \--provenance \--access public  
        env:  
          NODE\_AUTH\_TOKEN: ${{ secrets.NPM\_TOKEN }}

  \# PHASE 3: PUBLISH DEPENDENTS (C/D/E)  
  publish-application:  
    needs: publish-foundation  
    runs-on: ubuntu-latest  
    environment: pypi  
    steps:  
      \- uses: actions/checkout@v4  
      \- uses: actions/download-artifact@v4  
        with:  
          name: dist-artifacts

      \# Wait loop to ensure PyPI consistency (Dependency Availability)  
      \- name: Wait for Protos Availability  
        run: |  
          echo "Waiting for adk-sim-protos to appear on PyPI..."  
          for i in {1..20}; do  
            uv pip install \--dry-run \--index-url https://pypi.org/simple adk-sim-protos==${GITHUB\_REF\_NAME\#v} && break  
            echo "Not found yet, sleeping..."  
            sleep 10  
          done

      \- name: Publish Remaining Python Packages  
        uses: pypa/gh-action-pypi-publish@release/v1  
        with:  
          packages-dir: dist/  
          skip-existing: true \# In case Protos is in the same dir

---

**8\. Conclusion**

The transition to OIDC in a polyglot monorepo requires a disciplined approach to identity management and graph orchestration. By manually priming the PyPI projects to bypass pending publisher constraints and adopting a "Local Verification" strategy for staging, adk-agent-sim can achieve a highly secure, automated release pipeline. The integration of Changesets with a custom Python synchronization script bridges the language gap, ensuring that the "version-locked" requirement is met with mathematical precision while preserving the developer's control over the release cadence. This architecture not only satisfies the immediate requirements but establishes a SLSA-compliant foundation for future growth.

#### **Works cited**

1. Trusted Publishers for All Package Repositories \- wg-securing-software-repos, accessed January 8, 2026, [https://repos.openssf.org/trusted-publishers-for-all-package-repositories.html](https://repos.openssf.org/trusted-publishers-for-all-package-repositories.html)  
2. Publishing to PyPI with a Trusted Publisher, accessed January 8, 2026, [https://docs.pypi.org/trusted-publishers/](https://docs.pypi.org/trusted-publishers/)  
3. Internals and Technical Details \- PyPI Docs, accessed January 8, 2026, [https://docs.pypi.org/trusted-publishers/internals/](https://docs.pypi.org/trusted-publishers/internals/)  
4. Security Model and Considerations \- PyPI Docs, accessed January 8, 2026, [https://docs.pypi.org/trusted-publishers/security-model/](https://docs.pypi.org/trusted-publishers/security-model/)  
5. Configuring OpenID Connect in PyPI \- GitHub Docs, accessed January 8, 2026, [https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-pypi](https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-pypi)  
6. PIP Dependency resolution with private repositories is a nightmare : r/learnpython \- Reddit, accessed January 8, 2026, [https://www.reddit.com/r/learnpython/comments/1axfycs/pip\_dependency\_resolution\_with\_private/](https://www.reddit.com/r/learnpython/comments/1axfycs/pip_dependency_resolution_with_private/)  
7. Managing dependencies | uv \- Astral Docs, accessed January 8, 2026, [https://docs.astral.sh/uv/concepts/projects/dependencies/](https://docs.astral.sh/uv/concepts/projects/dependencies/)  
8. Building and publishing a package | uv \- Astral Docs, accessed January 8, 2026, [https://docs.astral.sh/uv/guides/package/](https://docs.astral.sh/uv/guides/package/)  
9. Trusted Publishing: suboptimal UX with pending publishers and monorepos · Issue \#16920 · pypi/warehouse \- GitHub, accessed January 8, 2026, [https://github.com/pypi/warehouse/issues/16920](https://github.com/pypi/warehouse/issues/16920)  
10. Troubleshooting \- PyPI Docs, accessed January 8, 2026, [https://docs.pypi.org/trusted-publishers/troubleshooting/](https://docs.pypi.org/trusted-publishers/troubleshooting/)  
11. Creating and publishing scoped public packages \- npm Docs, accessed January 8, 2026, [https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)  
12. Generating provenance statements \- npm Docs, accessed January 8, 2026, [https://docs.npmjs.com/generating-provenance-statements/](https://docs.npmjs.com/generating-provenance-statements/)  
13. Bootstrapping NPM Provenance with GitHub Actions \- The Candid Startup, accessed January 8, 2026, [https://www.thecandidstartup.org/2024/06/24/bootstrapping-npm-provenance-github-actions.html](https://www.thecandidstartup.org/2024/06/24/bootstrapping-npm-provenance-github-actions.html)  
14. Trusted publishing for npm packages, accessed January 8, 2026, [https://docs.npmjs.com/trusted-publishers/](https://docs.npmjs.com/trusted-publishers/)  
15. Introducing npm package provenance \- The GitHub Blog, accessed January 8, 2026, [https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/)  
16. Publishing a simple client-side JavaScript package to npm with GitHub Actions, accessed January 8, 2026, [https://til.simonwillison.net/npm/npm-publish-github-actions](https://til.simonwillison.net/npm/npm-publish-github-actions)  
17. changesets/docs/fixed-packages.md at main \- GitHub, accessed January 8, 2026, [https://github.com/changesets/changesets/blob/main/docs/fixed-packages.md](https://github.com/changesets/changesets/blob/main/docs/fixed-packages.md)  
18. GitHub Actions \- Verdaccio, accessed January 8, 2026, [https://verdaccio.org/docs/github-actions](https://verdaccio.org/docs/github-actions)