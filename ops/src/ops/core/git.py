"""Git operations utilities."""

import subprocess

import typer

from ops.core.console import console
from ops.core.paths import REPO_ROOT
from ops.core.process import ExitCode


def ensure_clean_tree() -> None:
  """Ensure the git working tree is clean (no uncommitted changes)."""
  result = subprocess.run(
    ["git", "status", "--porcelain"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )

  if result.returncode != 0:
    console.print("[red]Error:[/red] Failed to check git status")
    raise typer.Exit(ExitCode.EXTERNAL)

  if result.stdout.strip():
    lines = result.stdout.strip().split("\n")
    console.print("[red]Error:[/red] Uncommitted changes detected.")
    console.print(
      f"\nYou have {len(lines)} modified files that haven't been committed."
    )
    console.print("Release automation requires a clean working directory.")
    console.print("\nTo fix:")
    console.print("  git stash              # Stash changes temporarily")
    console.print("  ops release <type>     # Run release")
    console.print("  git stash pop          # Restore changes")
    console.print("\nOr to see what's changed:")
    console.print("  git status")
    raise typer.Exit(ExitCode.ERROR)


def get_current_branch() -> str:
  """Get the current git branch name."""
  result = subprocess.run(
    ["git", "rev-parse", "--abbrev-ref", "HEAD"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )

  if result.returncode != 0:
    console.print("[red]Error:[/red] Failed to get current branch")
    raise typer.Exit(ExitCode.EXTERNAL)

  return result.stdout.strip()


def get_upstream_branch() -> str:
  """Get the upstream tracking branch, or origin/main as fallback."""
  result = subprocess.run(
    ["git", "rev-parse", "--abbrev-ref", "@{upstream}"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )

  if result.returncode == 0:
    return result.stdout.strip()
  return "origin/main"


def get_merge_base(upstream: str = "origin/main") -> str:
  """Get the merge base between HEAD and upstream."""
  result = subprocess.run(
    ["git", "merge-base", "HEAD", upstream],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )

  if result.returncode == 0:
    return result.stdout.strip()
  return upstream


def get_changed_files(since: str = "origin/main") -> list[str]:
  """Get list of files changed since a given ref."""
  merge_base = get_merge_base(since)
  result = subprocess.run(
    ["git", "diff", "--name-only", merge_base, "HEAD"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )

  if result.returncode != 0:
    return []

  return [f for f in result.stdout.strip().split("\n") if f]
