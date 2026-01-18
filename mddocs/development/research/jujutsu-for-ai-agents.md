# **Architectural Operational Protocols for Autonomous AI Agents Using Jujutsu (jj) in GitHub Environments**

## **Executive Summary**

The integration of autonomous AI agents into software development lifecycles represents a fundamental shift in how version control systems (VCS) are utilized. Traditional systems like Git are designed with a "human-in-the-loop" assumption, relying on transient staging areas (the Index), complex command flags, and interactive conflict resolution mechanisms. For an autonomous agent such as Claude Code, these features—while powerful for humans—present significant state-tracking challenges and non-deterministic failure modes.

This report presents a comprehensive operational framework for leveraging Jujutsu (jj), a Git-compatible VCS, as the primary interface for autonomous agents. jj fundamentally alters the VCS paradigm by treating the working copy as a mutable commit, eliminating the need for an explicit staging index, and providing first-class support for conflicts and operation logs.1 These architectural choices significantly reduce the cognitive load on the agent by ensuring that every repository state is persistent and addressable.

However, jj's current ecosystem heavily prioritizes Terminal User Interface (TUI) interactions for complex tasks such as history rewriting (split) and conflict resolution (resolve).3 This creates a critical operational gap for headless agents that cannot interact with visual editors. This research establishes deterministic, Command Line Interface (CLI)-driven protocols to bridge this gap, allowing agents to perform advanced graph manipulation—including non-interactive hunk splitting, stacked diff management, and squash-merge recovery—using only standard input/output streams.

The following playbook details six core workflows, supported by theoretical graph analysis and precise command sequences, to enable robust, safe, and autonomous VCS management.

## ---

**1\. The Operational Theory of Jujutsu for Agents**

### **1.1 The "Working Copy as Commit" Paradigm**

In Git, the working directory is an unversioned scratchpad. To persist work, an agent must explicitly move changes to the Index (git add) and then to the Repository (git commit). This three-stage state machine is a frequent source of agent error, particularly regarding untracked files and partial stages.

Jujutsu simplifies this topology by treating the working copy (@) as a mutable commit that is automatically snapshotted on every command.2 For an autonomous agent, this means there is no distinction between "saving" and "working." The repository state is always captured.

| Operational Concept | Git (Human Model) | Jujutsu (Agent Model) | Implication for Agent Protocol |
| :---- | :---- | :---- | :---- |
| **Current State** | Mutable Working Directory \+ Index | Mutable Commit (@) | State is always addressable via ID. |
| **Persisting Work** | git add \+ git commit | jj new (creates new @) | "Committing" is an act of graph extension, not snapshotting. |
| **History Rewriting** | git rebase \-i (Interactive) | jj edit, squash, rebase | Rewriting is a graph traversal operation. |
| **Conflict State** | Blocks operation; requires immediate fix | Recorded in commit; operation succeeds | Conflicts can be deferred and fixed contextually. |

### **1.2 Identity Persistence: Change IDs vs. Commit Hashes**

A critical challenge in Git automation is the volatility of Commit Hashes (SHA-1). Any rebase or amend operation changes the hash, causing the agent to lose track of the commit it was working on. jj introduces the **Change ID**, an identity that persists across rewrites.1

**Agent Rule:** The agent must exclusively track and reference **Change IDs** (e.g., zsowkzkt) rather than Commit Hashes. This ensures that even if the agent rebases a stack or amends a commit, its internal reference to that unit of work remains valid.

## ---

**2\. Core Workflow 1: The "Implicit" Working Copy Loop**

### **2.1 Context and Mechanism**

The "Implicit" Working Copy Loop is the foundational heartbeat of the agent's interaction with the codebase. Because jj automatically snapshots the working copy, the agent does not need to perform a "save" action. Instead, the workflow focuses on *labeling* the current state and *transitioning* to a new state.

The critical decision point for the agent is distinguishing between an empty working copy (ready for new work) and a dirty working copy (containing uncommitted changes from a previous step).

### **2.2 State Verification Protocol**

Before initiating any task, the agent must perform a deterministic check of the @ revision to ascertain its state. Relying on assumptions about previous commands is unsafe; the agent must sense the live graph.

**Scenario:** The agent is initialized or wakes up to perform a task. It must determine if it needs to create a new commit or if it is already in a mutable state.

**Logic/Check:**

1. Execute jj status or parse jj log focused on @.  
2. Analyze the output for specific string patterns indicating emptiness or file modifications.

**Exact Command Sequence:**

Bash

\# Query the status of the working copy without pagination  
\# \[5\] 'jj st' shows working copy changes or 'no changes'.  
jj status \--no-pager

**Agent Parsing Logic:**

* **Condition A (Empty):** If the output contains the string The working copy has no changes, the agent interprets @ as a clean slate.  
  * *Action:* Proceed to modify files or run jj describe to set the intention.  
* **Condition B (Dirty):** If the output contains Working copy changes: followed by a list of file paths (e.g., M src/main.rs), the agent interprets @ as containing a work-in-progress.  
  * *Action:* The agent must decide whether to append to this work (continue editing) or seal it (describe and new).

### **2.3 The "Commit" Sequence (Describe & New)**

In jj, the command jj commit exists but is often an anti-pattern for stacked workflows because it duplicates the snapshotting logic.3 The preferred workflow for an agent is the **Describe-then-New** pattern. This pattern separates the act of *naming* the work from the act of *closing* the work.

**Objective:** The agent has modified files (implicitly snapshotted) and wishes to finalize this unit of work (Commit A) and prepare for the next unit (Commit B).

**Exact Command Sequence:**

Bash

\# Step 1: Assign a descriptive message to the current working copy (@).  
\# This transforms the anonymous mutable commit into a named mutable commit.  
\# Constraint: \-m is mandatory to bypass the TUI editor.  
\# \[6\] 'jj describe' updates the description of the checked-out commit.  
jj describe \-m "feat: implement resilient retry logic for API client"

\# Step 2: Seal the current commit and create a new working copy.  
\# This pushes the current \`@\` down to \`@-\` (parent) and creates a new empty \`@\`.  
\# \[6\] 'jj new' creates a new empty change on top of the current one.  
jj new

**Graph Topology Change:**

* **Before:** @ (Change ID: x, Status: Dirty, Desc: (none))  
* **After Step 1:** @ (Change ID: x, Status: Dirty, Desc: "feat:...")  
* **After Step 2:** @ (Change ID: y, Status: Empty) \-\> Parent: x (Change ID: x, Status: Closed)

### **2.4 Amending Without Commands**

A common Git operation is git commit \--amend. In jj, this concept is obsolete for the working copy.

**Scenario:** The agent realizes it forgot to add a comment to a file in the commit it is currently building (before running jj new).

**Protocol:**

1. **Action:** The agent simply writes the updated content to the file system.  
2. **Mechanism:** jj detects the file change and updates the snapshot of @ instantly.7  
3. **Result:** The "commit" is amended. No CLI command is required.

Safety Check:  
If the agent needs to update the message of the current work, it simply re-runs:

Bash

jj describe \-m "feat: implement resilient retry logic and documentation"

## ---

**3\. Core Workflow 2: Non-Interactive Stack Management (The "Deep Edit")**

### **3.1 Context and Mechanism**

Modern development often requires "Stacked Diffs"—a linear chain of dependent features (e.g., Refactor \-\> Backend \-\> UI). An agent working on the UI (tip) may detect a bug in the Refactor (root). In Git, fixing this requires git rebase \-i, stash management, and often results in a detached HEAD or conflict hell.

jj enables a non-linear editing workflow. The agent can "checkout" any commit in the stack, edit it, and jj will automatically handle the rebasing of all descendant commits.1 This capability is termed the "Deep Edit."

### **3.2 Navigation and Targeting Protocol**

To perform a deep edit, the agent must first locate the target commit. Using relative references like @-- is fragile; the agent should use **Revsets** to target commits by stable properties (description or Change ID).

**Scenario:** The agent is at the tip (UI) and needs to fix a bug in the commit described as "Refactor".

**Exact Command Sequence:**

Step 1: Identification  
The agent queries the log to find the Change ID associated with the target description.

Bash

\# Search for the commit ID where description contains 'Refactor'  
\# \[8\] Revsets allow filtering by description.  
jj log \-r 'description("Refactor")' \--no-graph \-T 'change\_id "\\n"'

*Output:* kkmpptxz

Step 2: The Jump (Checkout)  
The agent moves the working copy @ to the target revision.

Bash

\# Edit the specific revision.  
\# \[9\] 'jj edit' updates the working copy to the specified revision.  
jj edit kkmpptxz

*State Transition:* The working directory now reflects the state of the "Refactor" commit. The commits Backend and UI are now *descendants* of @.

Step 3: The Modification  
The agent performs the necessary file edits (e.g., fixing the bug in lib.rs). jj implicitly snapshots these changes into the kkmpptxz commit.

### **3.3 The Return and Verification Loop**

After the fix, the agent must return to the tip of the stack. Crucially, jj performs an **automatic rebase** of the descendants when the agent moves away from the edited commit.5 This rebase can succeed cleanly or result in conflicts.

Step 4: Returning to Tip  
The agent must know the identity of the tip. If it bookmark-tracked the tip (e.g., feature-ui), it jumps there. If not, it can query for leaf descendants.

Bash

\# Return to the bookmark 'feature-ui'  
jj edit feature-ui

\# OR, if using IDs, return to the previously known tip ID  
jj edit \<original\_tip\_id\>

Step 5: Rebase Verification (Safety Check)  
The agent must verify that the automatic rebase of the intermediate commits (Backend, UI) was successful. jj will not abort the operation on conflict; it will simply mark the commits as "Conflicted."  
**Command:**

Bash

\# Check for conflicts in the stack of descendants from the edited commit  
\# \[11\] Querying for conflicts in the ancestry path.  
jj log \-r '::@' \--template 'change\_id " " conflict "\\n"'

**Output Parsing:**

* **Clean:** zsowkzkt false  
* **Conflict:** zsowkzkt true

**Agent Logic:**

* If conflict \== true, the agent detects a **Ripple Effect Conflict**.  
* The agent must then identify which specific commit is conflicted (via the Change ID in the log output) and enter the **Conflict Resolution Workflow** (Section 7\) for that commit.  
* *Note:* Unlike Git, the agent does not need to "abort" the rebase. The graph is stable, just conflicted. The agent can fix the conflicts one by one.

## ---

**4\. Core Workflow 3: Non-Interactive Splitting & Refactoring**

### **4.1 The Constraint Challenge**

Refactoring often requires splitting a large commit into two smaller, atomic commits (e.g., separating "Formatting" from "Logic"). In jj, the standard command for this is jj split, which launches an interactive TUI diff editor.3 **This command is strictly forbidden for the agent.**

To achieve a split without a TUI, the agent must use "Constructive Refactoring"—manipulating the graph using squash \--into or by creating sibling commits and manually reconstructing the file states.

### **4.2 Scenario A: File-Level Splitting (The squash Method)**

**Scenario:** The agent has modified src/logic.rs and src/style.css in the current working copy (@). It wants to move src/style.css into the *parent* commit (effectively splitting it out from the current work).

Mechanism:  
The jj squash command supports moving specific paths from a source (default @) to a destination (default parent @-).5  
**Exact Command Sequence:**

Bash

\# Move changes to 'src/style.css' from @ into the parent commit  
\# \[12\] 'jj squash' moves changes to parent non-interactively if paths are provided.  
jj squash \--into @- src/style.css

**Result:**

* **Parent Commit:** Now includes the changes to src/style.css.  
* **Working Copy (@):** Now contains *only* the changes to src/logic.rs.  
* The commit has been effectively split by file.

### **4.3 Scenario B: Hunk-Level Splitting (The Construction Method)**

**Scenario:** The agent has modified src/main.rs. Lines 1-10 are a bug fix (Commit A), and lines 20-30 are a new feature (Commit B). Both are currently in @. The agent cannot use jj split to select these hunks.

Algorithm:  
The agent must essentially "rewrite history" by constructing the desired commits sequentially. It relies on its ability to read the file, internally separate the code, and write it to disk.  
**Logic Flow:**

1. **Snapshot:** Ensure current state is saved.  
2. **Branch:** Create a new sibling commit off the *parent* of the current work.  
3. **Construct A:** Write the file content for the bug fix (Commit A).  
4. **Chain:** Create a child commit (Commit B).  
5. **Construct B:** Write the full file content (Fix \+ Feature).  
6. **Replace:** Abandon the original commit.

**Exact Command Sequence:**

Bash

\# 1\. Identify current ID (Source)  
\# Let's say current ID is \<ORIG\_ID\>

\# 2\. Create a sibling commit off the parent  
\# \[6\] 'jj new' accepts a revision argument.  
jj new @-

\# 3\. (Agent Action) Write 'src/main.rs' containing ONLY the bug fix.  
\# The agent generates this content internally.  
echo "fn main() { fix(); }" \> src/main.rs

\# 4\. Describe the first commit (The Split Part 1\)  
jj describe \-m "fix: resolve critical bug"

\# 5\. Create the child commit (The Split Part 2\)  
jj new

\# 6\. (Agent Action) Write 'src/main.rs' containing the FULL content (Fix \+ Feature).  
\# Alternatively, restore it from the original commit to ensure byte-perfect copy.  
\# \[13\] 'jj restore' allows pulling file content from another revision.  
jj restore \--from \<ORIG\_ID\> src/main.rs

\# 7\. Describe the second commit  
jj describe \-m "feat: add new feature"

\# 8\. Clean up the original unsplit commit  
\#  'jj abandon' removes the commit from the graph.  
jj abandon \<ORIG\_ID\>

Safety Check:  
Before abandoning \<ORIG\_ID\>, the agent should run jj diff \--from \<ORIG\_ID\> \--to @ to ensure the final state of the new chain matches the original work (the diff should be empty).

## ---

**5\. Core Workflow 4: GitHub Synchronization (Bookmarks & PRs)**

### **5.1 Context and Mechanism**

jj decouples local commits from remote branches. To interface with GitHub, the agent must explicitly manage **Bookmarks**. A "Stacked PR" on GitHub is simply a chain of branches, where each branch points to a subsequent commit in the stack.1

### **5.2 Bookmark Naming and Management**

The agent must ensure every commit intended for a PR has a unique bookmark.

Logic:  
The agent should iterate through the stack and assign bookmarks. Deterministic naming is crucial for the agent to retrieve these later.

* *Convention:* agent/task-\<task\_id\>-\<change\_id\_short\>

**Exact Command Sequence:**

Bash

\# Create a bookmark for the current commit  
\# \[15\] 'jj bookmark create' associates a name with a revision.  
jj bookmark create agent/task-101-zso \-r @

### **5.3 Pushing Stacks**

To create the PR chain, the agent pushes the bookmarks.

Bash

\# Push a specific bookmark  
\# \[16\] 'jj git push' pushes the bookmark to the configured remote.  
jj git push \--bookmark agent/task-101-zso

\# OR, Push all bookmarks (Bulk Sync)  
\# \[11\] '--all' pushes all bookmarks tracking a remote.  
jj git push \--all

**Table: GitHub vs. Jujutsu Push Behavior**

| Feature | git push | jj git push | Agent Insight |
| :---- | :---- | :---- | :---- |
| **Target** | Current Branch | Specific Bookmark | Agent acts on bookmarks, not "current branch." |
| **Dependencies** | Pushes reachable commits | Pushes reachable commits | Pushing the tip bookmark pushes the whole stack. |
| **Force Push** | Requires \--force | Implicit check | jj checks if remote position matches known local position (safety). |

### **5.4 Handling "Squash and Merge" (The Critical Failure Mode)**

**The Scenario:**

1. Agent pushes stack A \-\> B.  
2. Maintainer merges A using **Squash and Merge**.  
3. GitHub creates commit S on main.  
4. Agent runs jj git fetch.

The Disconnect:  
jj sees S as a new commit from origin. It sees local A as a divergent, unmerged commit. Local B is based on A. The graph is broken. The agent must "rebase" B onto S and discard A.  
The Recovery Protocol:  
The agent must detect this topology and repair it using jj rebase.  
**Logic/Check:**

1. **Fetch:** jj git fetch.  
2. **Detect:** Check if the bookmark for A (e.g., feature-a) is in a divergent state or if main has moved past it.  
3. **Action:** Rebase the *children* of A onto the new main.

**Exact Command Sequence:**

Bash

\# Rebase the stack (B) onto the new main  
\# \-s (Source): The first commit of the remaining work (B)  
\# \-d (Destination): The new upstream tip (main@origin)  
\# \[17\] 'jj rebase' moves a revision and its descendants.  
jj rebase \-s \<Commit\_B\_ID\> \-d main@origin

\# Abandon the redundant local commit (A)  
\# Once B is moved, A is a leaf with no children.  
jj abandon \<Commit\_A\_ID\>

Patch-ID Limitation:  
While jj has some patch-id detection, GitHub's squash merge often changes the commit message or content (e.g., resolving conflicts in the UI), breaking exact patch matching.18 The explicit rebase protocol is the only safe deterministic method for the agent.

## ---

**6\. Core Workflow 5: Conflict Resolution (Text-Based Only)**

### **6.1 Context and Mechanism**

jj treats conflicts as "First-Class Objects." A conflict does not halt an operation (like git rebase does). Instead, the conflict is recorded in the commit, and the file content is replaced with conflict markers.10

**Constraint:** The agent cannot use jj resolve (TUI). It must perform resolution by reading and rewriting the file text.

### **6.2 Identification Protocol**

The agent must scan for conflicts before finalizing any work.

**Command:**

Bash

\# List conflicted files  
\# \[20\] 'jj resolve \--list' outputs paths with conflicts.  
jj resolve \--list

*Output:* src/config.rs

### **6.3 Anatomy of a Conflict Marker**

The agent must be trained to parse jj's specific marker style. By default, jj (and Git) uses a 3-way merge display.

\<\<\<\<\<\<\< Conflict A  
pub fn calculate() \-\> i32 {  
100  
}

# **||||||| Base (Ancestor) pub fn calculate() \-\> i32 { 50 }**

pub fn calculate() \-\> i32 {  
200  
}  
Conflict B

### **6.4 The Resolution Protocol (Read-Write-Resolve)**

1. **Read:** Agent reads src/config.rs.  
2. **Parse:** Agent uses regex or string parsing to identify the \<\<\<\<\<\<\<, |||||||, \=======, and \>\>\>\>\>\>\> blocks.  
3. **Synthesize:** Agent logic determines the correct merged code (e.g., return 200;).  
4. **Write:** Agent overwrites src/config.rs with the clean code (no markers).

### **6.5 Finalizing Resolution**

In Git, one must git add to mark resolved. In jj, the *act of resolving the text* updates the commit. However, to ensure the graph is clean, the agent can optionally run jj squash if the resolution was done in a child commit, or simply check the status.

**Verification Command:**

Bash

\# Verify the file is no longer conflicted  
jj status

*Success Criterion:* The file no longer appears under "Conflicted". The commit description in jj log no longer has the (conflict) tag or × symbol.10

## ---

**7\. Core Workflow 6: Safety & Recovery**

### **7.1 The "Undo" Button**

jj maintains an immutable **Operation Log** (op log). Every command that mutates the graph (new, squash, rebase, edit) creates an operation entry. This provides an infinite undo buffer for the agent.1

**Scenario:** The agent executed a jj rebase that resulted in a tangled graph it cannot understand.

**Exact Command:**

Bash

\# Undo the last operation  
jj undo

*Logic:* This reverts the repository pointers to the state immediately preceding the last command. It is deterministic and safe.

### **7.2 Retrieving Abandoned Code (The "Hidden" Log)**

If the agent accidentally runs jj abandon on a commit that contained important code, the commit is not deleted from the database; it is merely hidden from the default log view.

**Protocol:**

1. **Search:** The agent queries the hidden log.  
   Bash  
   \# Show hidden commits (recently abandoned)  
   \# \[11\] '--hidden' reveals abandoned revisions.  
   jj log \--hidden \-r 'all()' \--limit 10

2. **Identify:** Agent finds the Change ID of the lost commit.  
3. **Resurrect:**  
   Bash  
   \# Create a new commit pointing to the abandoned commit's content  
   jj new \<lost\_change\_id\>

### **7.3 Graph Repair (Resurrecting Detached Heads)**

Agents may sometimes leave commits "floating" (not reachable by bookmarks or @) during complex splitting operations. These are technically "visible heads" but easy to lose track of.

**Command:**

Bash

\# List all visible heads (tips of anonymous branches)  
jj log \-r 'heads(all())'

*Action:* The agent can inspect these heads and jj rebase valid work back onto the main stack if it "forgot" a branch.

## ---

**8\. Conclusion**

This research report establishes that while Jujutsu (jj) is designed with a TUI-first philosophy, it possesses a robust and deterministic CLI surface that makes it superior to Git for autonomous agent operations. By adopting the protocols defined herein—specifically the **Implicit Working Copy Loop**, **Revset-based Navigation**, and **Constructive Refactoring**—the Claude Code agent can effectively manage complex version control scenarios.

The shift from Git's "Index Management" to jj's "Graph Management" reduces the state-tracking burden on the agent. Critical failure modes, such as the GitHub "Squash and Merge" divergence, are handled deterministically via jj's rebase capabilities. Furthermore, the jj undo and Operation Log features provide a safety net that allows the agent to recover from hallucinations or logic errors without human intervention. This playbook provides the necessary instruction set to transform jj from a human-centric tool into a reliable backend for autonomous software engineering.

#### **Works cited**

1. Jujutsu VCS Introduction and Patterns \- Kuba Martin, accessed January 18, 2026, [https://kubamartin.com/posts/introduction-to-the-jujutsu-vcs/](https://kubamartin.com/posts/introduction-to-the-jujutsu-vcs/)  
2. jj part 1: what is it \- André.Arko.net, accessed January 18, 2026, [https://andre.arko.net/2025/09/28/jj-part-1-what-is-it/](https://andre.arko.net/2025/09/28/jj-part-1-what-is-it/)  
3. jj-commit(1) \- Arch manual pages, accessed January 18, 2026, [https://man.archlinux.org/man/extra/jujutsu/jj-commit.1.en](https://man.archlinux.org/man/extra/jujutsu/jj-commit.1.en)  
4. jj-split man | Linux Command Library, accessed January 18, 2026, [https://linuxcommandlibrary.com/man/jj-split](https://linuxcommandlibrary.com/man/jj-split)  
5. jj/docs/tutorial.md at main · jj-vcs/jj \- GitHub, accessed January 18, 2026, [https://github.com/martinvonz/jj/blob/main/docs/tutorial.md](https://github.com/martinvonz/jj/blob/main/docs/tutorial.md)  
6. Jujutsu VCS Introduction and Patterns : r/programming \- Reddit, accessed January 18, 2026, [https://www.reddit.com/r/programming/comments/1ik3akf/jujutsu\_vcs\_introduction\_and\_patterns/](https://www.reddit.com/r/programming/comments/1ik3akf/jujutsu_vcs_introduction_and_patterns/)  
7. Working copy \- Jujutsu docs, accessed January 18, 2026, [https://docs.jj-vcs.dev/latest/working-copy/](https://docs.jj-vcs.dev/latest/working-copy/)  
8. Dealing with conflicts \- Steve's Jujutsu Tutorial, accessed January 18, 2026, [https://steveklabnik.github.io/jujutsu-tutorial/branching-merging-and-conflicts/conflicts.html](https://steveklabnik.github.io/jujutsu-tutorial/branching-merging-and-conflicts/conflicts.html)  
9. CLI reference \- Jujutsu docs, accessed January 18, 2026, [https://docs.jj-vcs.dev/latest/cli-reference/](https://docs.jj-vcs.dev/latest/cli-reference/)  
10. keanemind/jj-stack: Stacked PRs on GitHub for Jujutsu, accessed January 18, 2026, [https://github.com/keanemind/jj-stack](https://github.com/keanemind/jj-stack)  
11. GitHub squash-merge-based workflow · jj-vcs jj · Discussion \#4328, accessed January 18, 2026, [https://github.com/jj-vcs/jj/discussions/4328](https://github.com/jj-vcs/jj/discussions/4328)  
12. Conflicts \- Jujutsu docs, accessed January 18, 2026, [https://docs.jj-vcs.dev/latest/conflicts/](https://docs.jj-vcs.dev/latest/conflicts/)