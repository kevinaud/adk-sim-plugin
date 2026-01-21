"""GitHub API utilities using gh CLI."""

import json
import subprocess
from dataclasses import dataclass

import typer

from ops.core.console import console
from ops.core.paths import REPO_ROOT
from ops.core.process import ExitCode


@dataclass
class PullRequest:
  """Pull request information."""

  number: int
  url: str
  state: str

  @property
  def is_open(self) -> bool:
    return self.state == "open"


@dataclass
class CheckStatus:
  """CI check status."""

  name: str
  state: str  # SUCCESS, FAILURE, PENDING, etc.


class GitHubClient:
  """Wrapper around gh CLI for GitHub operations."""

  def __init__(self) -> None:
    self._ensure_authenticated()

  def _ensure_authenticated(self) -> None:
    """Verify gh is authenticated."""
    try:
      subprocess.run(
        ["gh", "auth", "status"],
        check=True,
        capture_output=True,
        cwd=REPO_ROOT,
      )
    except subprocess.CalledProcessError:
      console.print("[red]Error:[/red] GitHub CLI not authenticated.")
      console.print("\nTo fix:")
      console.print("  gh auth login")
      raise typer.Exit(ExitCode.PREREQ) from None
    except FileNotFoundError:
      console.print("[red]Error:[/red] GitHub CLI (gh) not found.")
      console.print("\nTo install:")
      console.print("  brew install gh  # or see https://cli.github.com/")
      raise typer.Exit(ExitCode.PREREQ) from None

  def _run(self, args: list[str]) -> str:
    """Run gh command and return stdout."""
    result = subprocess.run(
      ["gh", *args],
      check=True,
      capture_output=True,
      text=True,
      cwd=REPO_ROOT,
    )
    return result.stdout.strip()

  def create_pr(
    self,
    title: str,
    branch: str,
    body: str = "",
    base: str = "main",
  ) -> str:
    """Create a pull request, return URL."""
    return self._run(
      [
        "pr",
        "create",
        "--title",
        title,
        "--body",
        body,
        "--head",
        branch,
        "--base",
        base,
      ]
    )

  def get_pr_checks(self, pr_number: int) -> list[CheckStatus]:
    """Get status of PR checks."""
    output = self._run(
      [
        "pr",
        "checks",
        str(pr_number),
        "--json",
        "name,state",
      ]
    )
    data = json.loads(output)
    return [CheckStatus(name=c["name"], state=c["state"]) for c in data]

  def wait_for_checks(
    self, pr_number: int, timeout_minutes: int = 30, poll_interval: int = 15
  ) -> bool:
    """Wait for all PR checks to complete. Returns True if all pass.

    Polls the GitHub API instead of using `gh pr checks --watch` which
    requires an interactive terminal.
    """
    import time

    start = time.time()
    timeout_seconds = timeout_minutes * 60

    while True:
      elapsed = time.time() - start
      if elapsed > timeout_seconds:
        console.print(
          f"[yellow]Warning:[/yellow] Checks timed out after {timeout_minutes}m"
        )
        return False

      # Get check status via API
      try:
        output = self._run(
          [
            "pr",
            "view",
            str(pr_number),
            "--json",
            "statusCheckRollup",
            "-q",
            ".statusCheckRollup",
          ]
        )
        checks = json.loads(output) if output else []
      except (subprocess.CalledProcessError, json.JSONDecodeError):
        checks = []

      if not checks:
        # No checks yet, wait for them to start
        time.sleep(poll_interval)
        continue

      # Check status of all checks
      pending = []
      failed = []
      for check in checks:
        status = check.get("status", "")
        conclusion = check.get("conclusion", "")
        name = check.get("name", "unknown")

        if status != "COMPLETED":
          pending.append(name)
        elif conclusion not in ("SUCCESS", "SKIPPED", "NEUTRAL"):
          failed.append(name)

      if failed:
        console.print(f"[red]Failed checks:[/red] {', '.join(failed)}")
        return False

      if not pending:
        # All checks completed successfully
        return True

      # Still waiting
      time.sleep(poll_interval)

  def merge_pr(self, pr_number: int, squash: bool = True, rebase: bool = False) -> None:
    """Merge a pull request.

    Args:
      pr_number: The PR number to merge
      squash: Use squash merge (default)
      rebase: Use rebase merge (preferred for jj compatibility)

    Note: When using jj, prefer rebase=True so jj recognizes merged commits.
    Note: We don't use --delete-branch as it fails with jj ("not on any branch").
          The remote branch is deleted automatically by GitHub after merge.
    """
    args = ["pr", "merge", str(pr_number)]
    if rebase:
      args.append("--rebase")
    elif squash:
      args.append("--squash")
    self._run(args)

  def get_repo_name(self) -> str:
    """Get the repository name in owner/repo format."""
    return self._run(
      [
        "repo",
        "view",
        "--json",
        "nameWithOwner",
        "-q",
        ".nameWithOwner",
      ]
    )
