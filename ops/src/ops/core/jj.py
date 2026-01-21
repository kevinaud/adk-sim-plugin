"""Jujutsu (jj) operations utilities.

This project uses Jujutsu exclusively for version control.
Git commands should only be used via jj (e.g., jj git push).
"""

import subprocess

import typer

from ops.core.console import console
from ops.core.paths import REPO_ROOT
from ops.core.process import ExitCode


def get_status() -> str:
  """Get jj status output."""
  result = subprocess.run(
    ["jj", "status", "--no-pager"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )

  if result.returncode != 0:
    console.print("[red]Error:[/red] Failed to check jj status")
    raise typer.Exit(ExitCode.EXTERNAL)

  return result.stdout


def has_uncommitted_changes() -> bool:
  """Check if working copy has uncommitted changes."""
  status = get_status()
  return "The working copy has no changes" not in status


def ensure_clean_working_copy() -> None:
  """Ensure the jj working copy is clean (no uncommitted changes).

  In jj, the working copy is always a commit, but we want to ensure
  there are no pending changes that haven't been described/sealed.
  """
  if has_uncommitted_changes():
    console.print("[red]Error:[/red] Working copy has uncommitted changes.")
    console.print("\nRelease automation requires a clean working copy.")
    console.print("\nTo fix, seal your current work:")
    console.print("  jj describe -m 'your message'")
    console.print("  jj new")
    console.print("\nOr to see what's changed:")
    console.print("  jj status")
    raise typer.Exit(ExitCode.ERROR)


def get_current_bookmark() -> str | None:
  """Get the bookmark pointing to the current working copy parent, if any."""
  result = subprocess.run(
    ["jj", "log", "-r", "@-", "--no-graph", "-T", 'bookmarks ++ "\n"'],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )

  if result.returncode != 0:
    return None

  # Parse bookmarks (may be multiple, space-separated)
  bookmarks = result.stdout.strip()
  if not bookmarks:
    return None

  # Return first bookmark
  return bookmarks.split()[0] if bookmarks else None


def is_on_main() -> bool:
  """Check if current working copy parent is on main."""
  result = subprocess.run(
    ["jj", "log", "-r", "@- & main", "--no-graph", "-T", "change_id"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )
  return result.returncode == 0 and bool(result.stdout.strip())


def describe(message: str, verbose: bool = False) -> None:
  """Describe the current working copy change."""
  cmd = ["jj", "describe", "-m", message]
  _run_jj(cmd, verbose=verbose)


def new(
  message: str | None = None,
  revision: str | None = None,
  verbose: bool = False,
) -> None:
  """Create a new change.

  Args:
    message: Optional message for the new change
    revision: Optional revision to create the new change on top of (default: @)
    verbose: Show command output
  """
  cmd = ["jj", "new"]
  if revision:
    cmd.append(revision)
  if message:
    cmd.extend(["-m", message])
  _run_jj(cmd, verbose=verbose)


def bookmark_create(name: str, revision: str = "@", verbose: bool = False) -> None:
  """Create a bookmark at the given revision."""
  _run_jj(["jj", "bookmark", "create", name, "-r", revision], verbose=verbose)


def bookmark_set(name: str, revision: str = "@", verbose: bool = False) -> None:
  """Create or move a bookmark to the given revision."""
  _run_jj(["jj", "bookmark", "set", name, "-r", revision], verbose=verbose)


def bookmark_move(name: str, revision: str = "@", verbose: bool = False) -> None:
  """Move a bookmark to the given revision."""
  _run_jj(["jj", "bookmark", "move", name, "--to", revision], verbose=verbose)


def bookmark_delete(name: str, verbose: bool = False) -> None:
  """Delete a bookmark."""
  _run_jj(["jj", "bookmark", "delete", name], verbose=verbose)


def bookmark_track(name: str, remote: str = "origin", verbose: bool = False) -> None:
  """Track a remote bookmark, enabling push to create it."""
  _run_jj(["jj", "bookmark", "track", name, f"--remote={remote}"], verbose=verbose)


def git_fetch(verbose: bool = False) -> None:
  """Fetch from git remote."""
  _run_jj(["jj", "git", "fetch"], verbose=verbose)


def git_push(bookmark: str, verbose: bool = False) -> None:
  """Push a bookmark to git remote."""
  _run_jj(["jj", "git", "push", "--bookmark", bookmark], verbose=verbose)


def git_push_tag(tag: str, revision: str = "main", verbose: bool = False) -> None:
  """Create and push a tag to git remote.

  Args:
    tag: The tag name (e.g., "v1.0.0")
    revision: The revision to tag (default: main)
    verbose: Show command output

  Note: jj doesn't have native tag support, so we use git directly.
  """
  # Create the tag using git
  result = subprocess.run(
    ["git", "tag", tag, revision],
    cwd=REPO_ROOT,
    capture_output=not verbose,
    text=True,
  )
  if result.returncode != 0:
    console.print(f"[red]Error:[/red] Failed to create tag {tag}")
    if not verbose and result.stderr:
      console.print(result.stderr)
    raise typer.Exit(ExitCode.EXTERNAL)

  # Push the tag (with --no-verify to skip pre-commit hooks)
  result = subprocess.run(
    ["git", "push", "origin", tag, "--no-verify"],
    cwd=REPO_ROOT,
    capture_output=not verbose,
    text=True,
  )
  if result.returncode != 0:
    console.print(f"[red]Error:[/red] Failed to push tag {tag}")
    if not verbose and result.stderr:
      console.print(result.stderr)
    raise typer.Exit(ExitCode.EXTERNAL)


def rebase(source: str, destination: str, verbose: bool = False) -> None:
  """Rebase a change and its descendants onto a new destination."""
  _run_jj(["jj", "rebase", "-s", source, "-d", destination], verbose=verbose)


def edit(revision: str, verbose: bool = False) -> None:
  """Edit a specific revision (make it the working copy)."""
  _run_jj(["jj", "edit", revision], verbose=verbose)


def abandon(revision: str, verbose: bool = False) -> None:
  """Abandon a revision."""
  _run_jj(["jj", "abandon", revision], verbose=verbose)


def get_change_id(revision: str = "@") -> str:
  """Get the change ID for a revision."""
  result = subprocess.run(
    ["jj", "log", "-r", revision, "--no-graph", "-T", "change_id"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )

  if result.returncode != 0:
    console.print(f"[red]Error:[/red] Failed to get change ID for {revision}")
    raise typer.Exit(ExitCode.EXTERNAL)

  return result.stdout.strip()


def get_commit_id(revision: str = "@") -> str:
  """Get the commit ID (git hash) for a revision."""
  result = subprocess.run(
    ["jj", "log", "-r", revision, "--no-graph", "-T", "commit_id"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )

  if result.returncode != 0:
    console.print(f"[red]Error:[/red] Failed to get commit ID for {revision}")
    raise typer.Exit(ExitCode.EXTERNAL)

  return result.stdout.strip()


def _run_jj(
  cmd: list[str], *, verbose: bool = False
) -> subprocess.CompletedProcess[str]:
  """Run a jj command with error handling."""
  result = subprocess.run(
    cmd,
    cwd=REPO_ROOT,
    capture_output=not verbose,
    text=True,
  )

  if result.returncode != 0:
    cmd_str = " ".join(cmd)
    console.print(f"[red]Error:[/red] Command failed: {cmd_str}")
    if not verbose and result.stderr:
      console.print(result.stderr)
    raise typer.Exit(ExitCode.EXTERNAL)

  return result
