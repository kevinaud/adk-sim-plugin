# **Cryptographic Identity Negotiation Failures in Software Supply Chains: A Comprehensive Analysis of npm OIDC Trusted Publisher Authentication Vectors and Resolution Strategies**

## **Executive Summary**

The modernization of the global software supply chain has necessitated a fundamental shift in authentication paradigms, moving from static, long-lived credentials to dynamic, ephemeral identity assertions. The introduction of Trusted Publishing on the npm registry, leveraging the OpenID Connect (OIDC) standard, represents a critical advancement in this domain. By allowing Continuous Integration and Continuous Deployment (CI/CD) providers, specifically GitHub Actions, to authenticate directly with the registry without the management of persistent secrets, the industry aims to eliminate the attack vector of credential exfiltration. However, the operationalization of this protocol has introduced a complex class of authentication failures that manifest paradoxically to the end-user. The most prevalent and debilitating of these is the npm notice Access token expired or revoked error accompanied by a 404 Not Found status code, occurring even—and especially—when no traditional access token is in use.

This report provides an exhaustive technical analysis of this specific failure mode. The research indicates that this error is rarely a symptom of token expiration in the traditional sense. Rather, it is a generic failure response from the npm Command Line Interface (CLI) when the OIDC handshake fails to establish a trust relationship due to strict claim mismatches. These mismatches most frequently occur during workflow\_dispatch (manual) events, where the Git reference (ref) transmitted in the OIDC token deviates from the rigid string matching configured in the npm Trust Policy. Furthermore, configuration drift regarding "Environment" definitions—often conflated with PyPI's implementation—and the nuances of reusable workflows (workflow\_call) serve as primary contributors to this breakdown. This document serves as a definitive guide for security engineers and DevOps architects to deconstruct, diagnose, and rectify these identity negotiation failures.

## ---

**1\. The Paradigm Shift: From Long-Lived Secrets to Ephemeral Identity**

To fully comprehend the mechanics of the "Access token expired" error in a modern context, one must first deconstruct the underlying architecture of npm's Trusted Publishing system and how it fundamentally diverges from the legacy authentication models that preceded it. The error in question is not merely a technical glitch; it is a symptom of the friction generated when legacy tooling interacts with modern identity theory.

### **1.1 The Legacy Security Model and Its Liabilities**

Historically, the authentication mechanism for publishing packages to the npm registry relied on the generation of an automation token. This token, an opaque string representing a user or organization's authority, was statically placed into the CI/CD environment's secrets manager (e.g., stored as NPM\_TOKEN in GitHub Secrets). This model, while simple to implement, carried significant operational and security risks that have plagued the JavaScript ecosystem for over a decade.

The primary liability of the legacy model was **static exposure**. Once generated, an npm automation token remained valid indefinitely until manually revoked. If this token were to be exfiltrated—whether through a compromised developer workstation, a leaked log file in a CI run, or a supply chain attack on the CI provider itself—it could be used by an attacker to publish malicious versions of trusted packages without detection. This vector has been exploited in numerous high-profile attacks, including the "Shai-Hulud" campaign and the compromised ua-parser-js and coa libraries.1

Furthermore, the legacy model suffered from **rotation friction**. Security best practices dictate that credentials should be rotated frequently. However, rotating npm tokens required manual intervention: a human operator had to log in to npmjs.com, revoke the old token, generate a new one, and update the secret in the GitHub repository settings. In practice, this friction led to tokens being left active for years, often owned by former employees or associated with forgotten service accounts.3 The static nature of these tokens also meant they lacked **provenance**. A token usage event proved only that the holder possessed the token; it provided no cryptographic evidence regarding *where* the code was built, *which* source commit was used, or *what* build instructions were executed.

### **1.2 The Architecture of Trusted Publishing (OIDC)**

Trusted Publishing in npm leverages the OpenID Connect (OIDC) standard to establish a trust relationship between the package registry (acting as the Relying Party, or RP) and the CI/CD provider (acting as the Identity Provider, or IdP). In this model, there is no shared secret stored in GitHub. Instead, authentication is based on the verification of a cryptographically signed identity assertion generated at runtime.

The authentication flow represents a sophisticated negotiation of machine identity:

1. **Token Request:** The GitHub Action workflow, during execution, requests a JSON Web Token (JWT) from GitHub's internal OIDC provider. This request is authorized by the presence of the permissions: id-token: write directive in the workflow's YAML configuration.4 Without this permission, the job cannot request the identity token, and the process fails before it begins.  
2. **Claim Generation:** GitHub generates a signed JWT containing specific "claims"—key-value pairs describing the current execution context. These claims are rigorous and granular. They include the repository owner, the repository name, the workflow file path, the Git reference (ref) that triggered the run, the actor (user), and the environment.5  
3. **Exchange:** The npm CLI, detecting the presence of OIDC capability (or explicitly configured to use it), presents this JWT to the npm registry's authentication endpoint.  
4. **Verification:** The npm registry verifies the cryptographic signature of the JWT against GitHub's public keys (retrieved via the OIDC discovery endpoint). Crucially, the registry then compares the *claims* inside the token against the "Trusted Publisher" settings configured by the package owner on npmjs.com.  
5. **Session Grant:** If—and only if—the claims match the configured policy exactly, the npm registry issues a short-lived, scoped access token valid only for the duration of that specific publish operation (typically 15 minutes to an hour).6

This mechanism eliminates the need for secret management. The "secret" is effectively the configuration itself—the policy that dictates which specific workflow in which specific repository is authorized to publish.

### **1.3 The Semantics of the Failure**

The core subject of this analysis is the error message npm notice Access token expired or revoked coupled with a 404 Not Found status code. This response is highly misleading and is a byproduct of the npm CLI's legacy error handling routines.

When the OIDC verification fails during the "Verification" step described above, the registry refuses to issue the short-lived session token. Consequently, the npm CLI does not possess a valid credential to perform the subsequent PUT request to upload the package payload. When the CLI attempts the upload (or an associated authentication check), the registry returns a 401 Unauthorized or 404 Not Found (often masking the 401 for security or architectural reasons regarding package visibility).

The npm CLI (particularly versions prior to extremely recent patches, though still prevalent in v10/v11) interprets this sequence through the lens of legacy authentication. In the legacy world, if a publish failed with an auth error, the most probable cause was that the developer's stored token had expired or been revoked. Thus, the CLI prints the heuristic suggestion: "Access token expired or revoked. Please try logging in again".7

In an OIDC context, this message is a red herring. The user cannot "login again" because they never logged in to begin with—the machine identity negotiation failed. The "token" that is "expired" is actually a non-existent session token that was never issued because the trust condition was not met. The 404 error code often specifically refers to the inability to find a package or a permission scope that allows the write operation, which is the downstream effect of the upstream identity rejection.9

## ---

**2\. Anatomy of the Failure: The workflow\_dispatch Divergence**

The most sophisticated and common cause of OIDC failure in GitHub Actions is the subtle variance in token claims generated during a workflow\_dispatch (manual trigger) event compared to a standard push event. This variance strikes at the heart of how npm's Trust Policies are evaluated.

### **2.1 The ref Claim and Static Policy Validation**

When configuring a Trusted Publisher on npmjs.com, the user is required to specify a "Git Ref" (often defaulting to refs/heads/main or a specific release tag pattern). This setting creates a strict validator on the npm side. The registry expects the incoming OIDC token to contain a ref claim that matches this string *exactly*.

The OIDC standard defines the ref claim as the Git reference that triggered the workflow run.11

* **Push Event:** When code is pushed to the main branch, the ref claim generated by GitHub is refs/heads/main. If the Trust Policy on npm expects refs/heads/main, authentication succeeds.  
* **Workflow Dispatch Event:** When a user manually triggers a workflow using the "Run Workflow" button in the GitHub UI or the gh workflow run command, the ref claim reflects the context of that dispatch.

Critically, discrepancies arise in *how* the dispatch is invoked. The ref claim is not static for a workflow file; it depends on the target of the execution.

#### **2.1.1 Branch Dispatch vs. Tag Dispatch**

If a developer triggers a manual run on the main branch, the claim remains refs/heads/main. However, release workflows are frequently triggered on *tags*. A common release pattern involves a developer pushing a tag (e.g., v1.0.0) to git, and then manually triggering the publishing workflow on that tag to ensure the artifacts are built from that specific immutable reference.

In this scenario, the OIDC token generated by GitHub will present a subject claim containing ref:refs/tags/v1.0.0.12

The Failure Mechanism:  
If the npm Trust Policy is configured to authorize "Branch: main" (translating to refs/heads/main), and the developer attempts to manually publish by triggering the workflow on the tag v1.0.0, the OIDC token will present sub:...ref:refs/tags/v1.0.0. The npm registry compares refs/tags/v1.0.0 against the policy refs/heads/main. The comparison fails. The registry rejects the token. The CLI reports "Access token expired."  
This is a false negative. The repository is correct, the user is correct, and the workflow is correct. But the specific *git reference* does not match the static string entered in the npm UI.

### **2.2 The gh workflow run Input Anomaly**

Advanced users utilizing the GitHub CLI (gh) to trigger workflows often encounter this issue with higher frequency. The command gh workflow run publish.yml \--ref v1.0.0 explicitly sets the ref context.13

While the user intends to publish the code at that tag, the Trusted Publisher configuration on npm is frequently static. Unlike PyPI, which allows for more flexible "glob patterns" or less restrictive trust policies in some configurations, npm's UI validation is stringent regarding the exact string match for the reference.15 If the policy was set up using the "GitHub Actions" wizard on npmjs.com, it likely locked the trust to the default branch (main or master).

Snippet 9 highlights a scenario where users attempt to use granular tokens or npm login inside the workflow to bypass this, only to fail again. This secondary failure often occurs because the local .npmrc configuration conflicts with the OIDC context detection, or the granular tokens lack the precise scope required for the package, leading to the same generic 404 error. The presence of OIDC-related environment variables can sometimes cause the npm CLI to ignore the .npmrc authentication tokens, forcing the failed OIDC path even when a fallback token is provided.

### **2.3 The workflow\_call (Reusable Workflow) Identity Crisis**

A "second-order" insight derived from the research material involves the use of Reusable Workflows (workflow\_call). Large organizations often centralize their publishing logic into a shared repository (e.g., org/infrastructure/.github/workflows/publish.yml) to enforce compliance and standardization.

When a caller workflow (in org/app-repo) invokes the reusable workflow, the OIDC token claims become complex. The token contains two distinct reference claims:

* **job\_workflow\_ref:** This claim identifies the reusable workflow being used (e.g., org/infrastructure/.github/workflows/publish.yml@main).  
* **ref:** This claim identifies the *caller's* git reference (e.g., org/app-repo branch main).

If the npm Trust Policy is configured to trust the *workflow file path* of the caller, but the validation logic or the OIDC token emphasizes the *job workflow ref* of the callee (or vice versa depending on how the subject is constructed and interpreted), the match fails.15

Snippet 15 explicitly notes that "validation checks the calling workflow's name instead of the workflow that actually contains the publish command." This is counter-intuitive for security teams who expect the "trusted code" (the centralized pipeline) to be the entity authenticated. If the npm configuration points to publish.yml in the repository root, but the actual logic resides in a referenced action, the path mismatch triggers the 404/403. This is a known limitation in the current implementation of OIDC trust mapping for many package registries, where the "Caller" identity often supersedes the "Callee" identity in the sub claim, or causes confusion in the job\_workflow\_ref claim matching.

## ---

**3\. Configuration Drift: The "Environment" Trap**

One of the most pervasive causes of the "Access token expired" error stems from a fundamental misunderstanding of the "Environment" field in the Trusted Publisher configuration. This misunderstanding is driven by cross-ecosystem confusion (specifically with Python's PyPI) and subtle User Experience (UX) design choices.

### **3.1 The PyPI "Copy-Paste" Effect**

The concept of Trusted Publishing was pioneered largely by PyPI (Python Package Index). In PyPI's implementation, creating a trust relationship often involves specifying an environment, or defaulting to a "pypi" environment in the GitHub Actions configuration to separate publishing privileges from standard build privileges.17

Developers moving from Python to Node.js, or following polyglot tutorials, often erroneously apply PyPI patterns to npm.

* **The Error:** A user configures the npm Trusted Publisher settings and sees an optional field labeled "Environment". Thinking this is for organizational purposes or following a PyPI tutorial, they type "production" or "npm-publish".  
* **The Mismatch:** In their GitHub Actions YAML, they do not specify environment: production.  
* **The Result:** The OIDC token generated by GitHub contains a sub (subject) claim that looks like repo:org/repo:ref:refs/heads/main. However, npm is expecting repo:org/repo:environment:production. Because the environment component is missing from the OIDC token's subject, the match fails.3

The sub claim is constructed differently depending on whether an environment is active.

* **Without Environment:** repo:org/repo:ref:refs/heads/main  
* **With Environment:** repo:org/repo:environment:production

If npm is looking for the latter (because the user typed an environment name in the settings), but receives the former (because the user forgot to add it to the YAML), authentication is denied. Snippet 19 and 20 reinforce that the configuration on npmjs.com must match the repository settings *exactly*.

### **3.2 The Invisible "Faint Text" UI Issue**

A subtle UX issue identified in the research regarding web interfaces contributes to this configuration drift. Snippet 21 and 22 discuss "faint text" placeholders. In some configuration UIs, a placeholder like production or pypi might be displayed to guide the user.

If the user assumes this faint text represents a *default value* that is already active, they may mistakenly believe they have an environment configured when they do not. Conversely, if the user explicitly types "pypi" into the npm configuration environment field (a common error seen in snippet 17 context due to copy-pasting PyPI instructions), the OIDC handshake will fail unless the GitHub Action job is explicitly named:

YAML

jobs:  
  publish:  
    environment: pypi  \# Required if npm trust settings have "pypi" in the environment field  
    runs-on: ubuntu-latest  
    steps:  
      \- run: npm publish \--provenance

If this environment key is missing in the YAML, the Access token expired error is guaranteed. The research indicates that "pypi" text appearing in npm settings is a strong indicator of this specific misconfiguration.3

## ---

**4\. The "First Publish" Paradox and Bootstrap Security**

A critical operational constraint of npm's Trusted Publishing—unlike PyPI's "Pending Publisher" model—is that the package must exist before trust can be configured. This creates a "Chicken-and-Egg" scenario that frequently results in authentication failures for new projects.

### **4.1 The Bootstrap Limitation**

Snippet 23 and 24 highlight that "npm requires a package to exist before you can configure trusted publishing."

* **Scenario:** A developer creates a new library @org/new-lib.  
* **Action:** They set up the GitHub Action with npm publish \--provenance and push code, expecting OIDC to handle the creation of the package.  
* **Result:** Failure. They cannot set up the trust policy on npmjs.com because the package is not in the dropdown list yet (since it has never been published).  
* **Workaround Attempt:** They try to publish locally using OIDC-style commands (impossible outside CI) or get stuck in a loop.

If a user attempts to rely on OIDC for the *very first* publish, the npm registry returns a 404 because the package scope/name combination is not yet mapped to any OIDC policy. The error message, again, defaults to the confusing "Access token expired or revoked," leading the user to debug their OIDC token rather than realizing the package record itself is missing.10

### **4.2 Remediation: The Placeholder Pattern**

The only viable workaround for this, as detailed in the research, is the "Placeholder Pattern".23 The initial publish *must* be done via a legacy method (npm login with a user account) to reserve the name.

1. The developer must perform npm publish locally (or via a one-off token) to push v0.0.0 or v0.0.1.  
2. Once the package exists, the settings page on npmjs.com becomes accessible.  
3. The developer can then link the GitHub repository and workflow.  
4. Only *then* can the GitHub Action successfully publish subsequent versions using OIDC.

Failure to perform this manual bootstrap step is a leading cause of the 404 error for greenfield projects.

### **4.3 Provenance and Private Repositories**

The npm publish \--provenance flag is now the default recommendation when using OIDC.6 This flag instructs the CLI to generate a build attestation signed by Sigstore, linking the package to the build process.

However, provenance generation has strict requirements that can trigger failures:

1. **Public Repositories:** Provenance works seamlessly.  
2. **Private Repositories:** As noted in 6 and 3, "provenance remains unavailable when publishing from private source repositories."

If a user forces \--provenance from a private GitHub repository, or if the OIDC token lacks the permissions to write to the transparency log (though less common now), the publish may fail. The primary failure mode for private repos is usually a 404 on the *attestation* upload endpoint or a refusal to generate it. If the npm CLI retries the publish logic upon this failure, it may bubble up the generic auth error. Users utilizing private source code must currently disable provenance or accept that OIDC trusted publishing works for authentication *without* the provenance attestation.25

## ---

**5\. Technical Deep Dive: Validating the OIDC Token**

To definitively diagnose these issues, relying on the error message is insufficient. One must inspect the raw OIDC claims generated by the workflow to compare them against the policy. The research material points to the use of the actions-oidc-debugger or simple curl scripts to inspect the token.26

### **5.1 The sub (Subject) Claim Architecture**

The sub claim is the primary key for authentication in the OIDC protocol. Its format is conditional and strictly defined by GitHub's OIDC implementation.

**Format A: No Environment Configured**

repo:\<org\>/\<repo\>:ref:\<ref\>

* Example: repo:my-org/my-utils:ref:refs/heads/main  
* This format is used when the environment key is missing from the GitHub Actions job. npm expects this format if the "Environment" field in the Trusted Publisher settings is blank.

**Format B: With Environment Configured**

repo:\<org\>/\<repo\>:environment:\<env\>

* Example: repo:my-org/my-utils:environment:production  
* **Critical Insight:** If an environment is used, the ref is *removed* from the sub string in many cloud provider implementations and OIDC subjects. However, npm's validation logic allows filtering by "Branch" *and* "Environment". The OIDC token contains additional claims (separate from sub) for ref and environment.

The mismatch usually occurs in the **Subject** matching rule. If npm is configured to look for a subject containing the environment, but the token provides a subject containing the ref (Format A), the trust chain breaks.

### **5.2 Diagnostic Script Protocol**

Based on snippets 26 and 28, the following step is the gold standard for verifying why the "Access token expired" error is happening. It prints the actual JWT claims, which can then be compared character-for-character against the npm settings.

YAML

\- name: Debug OIDC Token  
  permissions:  
    id-token: write  
  run: |  
    \# Request the token from the internal runtime  
    URL="$ACTIONS\_ID\_TOKEN\_REQUEST\_URL\&audience=npm"  
    TOKEN=$(curl \-H "Authorization: bearer $ACTIONS\_ID\_TOKEN\_REQUEST\_TOKEN" "$URL")  
      
    \# Decode the payload (second part of JWT)  
    \# WARNING: Do not run this in a public repo where logs are public  
    \# if the token grants access to sensitive cloud resources.  
    echo "--- OIDC TOKEN CLAIMS \---"  
    echo $TOKEN | jq \-r '.value' | cut \-d. \-f2 | base64 \-d 2\>/dev/null | jq.

*Security Note: This script should be run in a debug branch or private repository. While OIDC tokens are short-lived, exposing them in public logs is a bad practice. The script uses standard tools (curl, jq, base64) available on GitHub runners.*

By running this script during a failed workflow\_dispatch event, a developer can see exactly what ref is being sent. If the log shows "ref": "refs/tags/v1.0.1" but the npm policy demands "ref": "refs/heads/main", the root cause is confirmed.

## ---

**6\. Remediation and Best Practices**

To resolve the "Access token expired or revoked" (404) error and establish a robust Trusted Publishing pipeline, the following protocol should be adopted.

### **6.1 Correcting the workflow\_dispatch Mismatch**

If manual publishing is required (e.g., "Click to Release"), the npm Trust Policy must be aligned with the ref that manual triggers generate.

Solution A: Use Tag-Based Publishing (Recommended)  
Instead of relying on branch refs, configure the npm Trust Policy to accept tags. This is the industry standard for immutable releases.

1. **npm Settings:** Set "Git Ref" to a pattern like refs/tags/v\* (if regex is supported) or a specific tag convention.  
2. **Workflow:** Update the trigger to run on tag pushes.  
   YAML  
   on:  
     push:  
       tags:  
         \- 'v\*'

3. **Execution:** The user creates a release tag. The ref claim becomes refs/tags/v1.0.0. This aligns with the policy.

Solution B: Aligning Manual Triggers  
If using workflow\_dispatch on the main branch:

1. **npm Settings:** Ensure "Git Ref" is exactly refs/heads/main.  
2. **Execution:** Ensure the dispatch is triggered *from* the main branch using the GitHub UI defaults.  
3. **Warning:** Do not run gh workflow run \--ref \<tag\> if the policy is set to refs/heads/main. It will fail.

### **6.2 Harmonizing Environment Configurations**

Eliminate ambiguity regarding environments.

**Recommendation:**

* **Simplicity:** For simple libraries, leave the "Environment" field **blank** in npm settings. Do **not** use environment: in the GitHub Actions YAML.  
* **Security:** For critical production packages, create a GitHub Environment named npm-publish. Configure this environment in GitHub settings with "Required Reviewers" (enforcing 2FA via the reviewer).  
  * **npm Settings:** Set "Environment" to npm-publish.  
  * **YAML:** Add environment: name: npm-publish to the job.  
  * **Verify:** Ensure the names match case-sensitively.

### **6.3 Preventing .npmrc Conflicts**

A common source of the 404 error is the presence of a project-level .npmrc file that contains a reference to a legacy auth token variable.

* **Check:** Look for //registry.npmjs.org/:\_authToken=${NPM\_TOKEN} in .npmrc.  
* **Fix:** When using OIDC, the npm publish command does not need this line. In fact, if NPM\_TOKEN is unset in the environment (because you expect OIDC to work), this line might cause the CLI to send an empty or malformed token header, overriding the OIDC logic.  
* **Action:** Remove auth-related lines from .npmrc in the CI environment, or ensure NPM\_TOKEN is removed from secrets if fully migrating to OIDC.8

## ---

**7\. Strategic Implications and Future Outlook**

The transition to Trusted Publishing is not merely a technical upgrade but a shift in the philosophy of supply chain security.

### **7.1 The Decline of Long-Lived Secrets**

The "Access token expired" error, while frustrating, is a symptom of a system failing securely. In the legacy model, a misconfigured token might silently work if it had overly broad permissions (e.g., a token for repo-A working on repo-B). In the OIDC model, the strict claim validation enforces "Least Privilege" by default. A workflow running on a feature branch *cannot* publish to npm if the policy only allows main. This 404 error is essentially a "Access Denied due to Context Mismatch" enforcement.

### **7.2 The Rise of Provenance**

With npm publish \--provenance becoming standard, the OIDC token serves a dual purpose: authentication (to npm) and signing identity (to Sigstore). This creates a verifiable link between the binary package and the GitHub Actions run log. The "Access token" error will likely become more granular in future npm CLI versions (e.g., differentiating between "OIDC Subject Mismatch" and "Registry 404"), as indicated by ongoing discussions in the OpenSSF and npm community.19

### **7.3 Conclusion**

The npm notice Access token expired or revoked 404 error in the context of OIDC is a misnomer for **Trust Policy Mismatch**. It occurs when the strict cryptographic assertions presented by GitHub Actions (the claims) do not align perfectly with the expectations defined in the npm registry's Trusted Publisher settings.

By ensuring that the **Git Ref**, **Environment**, and **Workflow Path** are synchronized between the GitHub YAML and the npm configuration—and by recognizing the distinct claim behaviors of workflow\_dispatch versus push events—developers can eliminate this error. The migration to OIDC, despite this initial configuration hurdle, offers a mathematically verifiable security posture that renders credential theft obsolete.

## ---

**Appendix A: Comparison of Trigger Event Claims**

The following table illustrates why authentication fails during manual interventions if the policy is static.

| Event Type | Trigger | OIDC ref Claim | npm Policy: refs/heads/main | Result |
| :---- | :---- | :---- | :---- | :---- |
| **Push** | Commit to main | refs/heads/main | Matches | ✅ **Success** |
| **Push** | Commit to feat-1 | refs/heads/feat-1 | Mismatch | ❌ **Fail (404)** |
| **Workflow Dispatch** | Manual run on main | refs/heads/main | Matches | ✅ **Success** |
| **Workflow Dispatch** | Manual run on Tag v1 | refs/tags/v1 | Mismatch | ❌ **Fail (404)** |
| **Release** | Created Release v1 | refs/tags/v1 | Mismatch | ❌ **Fail (404)** |

*Note: For the Release event to succeed, the npm Policy must be updated to match refs/tags/v\* or similar glob patterns if supported, or the specific tag.*

## **Appendix B: Verification Checklist**

1. \[ \] **Package Exists:** Is the package already published on npm? (OIDC cannot create new packages).  
2. \[ \] **Permission Grant:** Does the workflow job have permissions: id-token: write?  
3. \[ \] **Environment Sync:** Is the "Environment" field in npm settings blank? If so, ensure environment: is **absent** from the YAML. If present, ensure they match exactly.  
4. \[ \] **Ref Logic:** Are you triggering the workflow from the exact branch defined in the npm settings?  
5. \[ \] **Clean Config:** Is there a local .npmrc interfering with authentication headers?  
6. \[ \] **Workflow Path:** If using reusable workflows, does the npm policy point to the *caller* or the *callee*? (Default behavior usually checks the caller in recent updates, but this can vary).

#### **Works cited**

1. PyPI and Shai-Hulud: Staying Secure Amid Emerging Threats \- The Python Package Index Blog, accessed January 9, 2026, [https://blog.pypi.org/posts/2025-11-26-pypi-and-shai-hulud/](https://blog.pypi.org/posts/2025-11-26-pypi-and-shai-hulud/)  
2. CI/CD Incidents \- StepSecurity, accessed January 9, 2026, [https://www.stepsecurity.io/incidents](https://www.stepsecurity.io/incidents)  
3. Trusted publishing for npm packages, accessed January 9, 2026, [https://docs.npmjs.com/trusted-publishers/](https://docs.npmjs.com/trusted-publishers/)  
4. Securing Your NPM Publishing: Transitioning to Trusted Publishing | Speakeasy, accessed January 9, 2026, [https://www.speakeasy.com/blog/npm-trusted-publishing-security](https://www.speakeasy.com/blog/npm-trusted-publishing-security)  
5. OpenID Connect \- GitHub Docs, accessed January 9, 2026, [https://docs.github.com/en/actions/concepts/security/openid-connect](https://docs.github.com/en/actions/concepts/security/openid-connect)  
6. npm trusted publishing with OIDC is generally available \- GitHub Changelog, accessed January 9, 2026, [https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)  
7. community Npm · Discussions \- GitHub, accessed January 9, 2026, [https://github.com/orgs/community/discussions/categories/npm](https://github.com/orgs/community/discussions/categories/npm)  
8. 如何利用全新的Trusted publishing 方法發佈npm 套件, accessed January 9, 2026, [https://blog.miniasp.com/post/2026/01/06/How-to-publish-npm-packages-using-the-new-Trusted-publishing-method](https://blog.miniasp.com/post/2026/01/06/How-to-publish-npm-packages-using-the-new-Trusted-publishing-method)  
9. Update: Classic token removal moves to December 9, bundled with new CLI improvements · community · Discussion \#179562 \- GitHub, accessed January 9, 2026, [https://github.com/orgs/community/discussions/179562](https://github.com/orgs/community/discussions/179562)  
10. How to set up trusted publishing for npm \- remarkablemark, accessed January 9, 2026, [https://remarkablemark.org/blog/2025/12/19/npm-trusted-publishing/](https://remarkablemark.org/blog/2025/12/19/npm-trusted-publishing/)  
11. OpenID Connect reference \- GitHub Docs, accessed January 9, 2026, [https://docs.github.com/actions/reference/openid-connect-reference](https://docs.github.com/actions/reference/openid-connect-reference)  
12. Claude Code Session \- 43f7e80f-afc8-4c11-b15b-865def591f38 \- tmy.se, accessed January 9, 2026, [https://tmy.se/ai/pycpl-wheels](https://tmy.se/ai/pycpl-wheels)  
13. Manually running a workflow \- GitHub Docs, accessed January 9, 2026, [https://docs.github.com/actions/managing-workflow-runs/manually-running-a-workflow](https://docs.github.com/actions/managing-workflow-runs/manually-running-a-workflow)  
14. Terraform Provider for Microsoft Fabric: \#4 Deploying a Fabric config with Terraform in GitHub Actions | Microsoft Fabric Blog, accessed January 9, 2026, [https://blog.fabric.microsoft.com/en-US/blog/terraform-provider-for-microsoft-fabric-4-deploying-a-fabric-config-with-terraform-in-github-actions/](https://blog.fabric.microsoft.com/en-US/blog/terraform-provider-for-microsoft-fabric-4-deploying-a-fabric-config-with-terraform-in-github-actions/)  
15. Trusted Publishing and shared workflows · community · Discussion \#179952 \- GitHub, accessed January 9, 2026, [https://github.com/orgs/community/discussions/179952](https://github.com/orgs/community/discussions/179952)  
16. Using OpenID Connect with reusable workflows \- GitHub Docs, accessed January 9, 2026, [https://docs.github.com/actions/deployment/security-hardening-your-deployments/using-openid-connect-with-reusable-workflows](https://docs.github.com/actions/deployment/security-hardening-your-deployments/using-openid-connect-with-reusable-workflows)  
17. Trusted Publishers \- projen, accessed January 9, 2026, [https://projen.io/docs/publishing/trusted-publishing/](https://projen.io/docs/publishing/trusted-publishing/)  
18. Help · PyPI, accessed January 9, 2026, [https://pypi.org/help/](https://pypi.org/help/)  
19. npm Adopts OIDC for Trusted Publishing in CI/CD Workflows \- ... \- Socket.dev, accessed January 9, 2026, [https://socket.dev/blog/npm-trusted-publishing](https://socket.dev/blog/npm-trusted-publishing)  
20. Publishing to npm | Fern Documentation, accessed January 9, 2026, [https://buildwithfern.com/learn/sdks/generators/typescript/publishing](https://buildwithfern.com/learn/sdks/generators/typescript/publishing)  
21. 2021 \- Web Almanac | PDF \- Scribd, accessed January 9, 2026, [https://www.scribd.com/document/644834665/2021-Web-almanac](https://www.scribd.com/document/644834665/2021-Web-almanac)  
22. Config \- npm Docs, accessed January 9, 2026, [https://docs.npmjs.com/cli/v8/using-npm/config](https://docs.npmjs.com/cli/v8/using-npm/config)  
23. Setup npm package for trusted publishing with OIDC \- GitHub, accessed January 9, 2026, [https://github.com/azu/setup-npm-trusted-publish](https://github.com/azu/setup-npm-trusted-publish)  
24. \[Feature\] Publish packages to NPM via OIDC · community · Discussion \#127011 \- GitHub, accessed January 9, 2026, [https://github.com/orgs/community/discussions/127011](https://github.com/orgs/community/discussions/127011)  
25. Using private packages in a CI/CD workflow \- npm Docs, accessed January 9, 2026, [https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow/](https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow/)  
26. OpenID Connect reference \- GitHub Enterprise Cloud Docs, accessed January 9, 2026, [https://docs.github.com/en/enterprise-cloud@latest/actions/reference/security/oidc](https://docs.github.com/en/enterprise-cloud@latest/actions/reference/security/oidc)  
27. github/actions-oidc-debugger: An Action for printing OIDC claims in GitHub Actions., accessed January 9, 2026, [https://github.com/github/actions-oidc-debugger](https://github.com/github/actions-oidc-debugger)  
28. GitHub Actions: A Cloudy Day for Security \- Part 2, accessed January 9, 2026, [https://www.binarysecurity.no/posts/2025/09/securing-gh-actions-part2](https://www.binarysecurity.no/posts/2025/09/securing-gh-actions-part2)  
29. Our plan for a more secure npm supply chain · community · Discussion \#174507 \- GitHub, accessed January 9, 2026, [https://github.com/orgs/community/discussions/174507](https://github.com/orgs/community/discussions/174507)