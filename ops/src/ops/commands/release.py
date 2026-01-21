"""Release management commands.

Uses Jujutsu (jj) for version control operations.
"""

import json
from enum import Enum

import typer
from rich.progress import Progress, SpinnerColumn, TextColumn

from ops.core import jj
from ops.core.console import console
from ops.core.github import GitHubClient
from ops.core.paths import PACKAGES_DIR, REPO_ROOT
from ops.core.process import ExitCode, require_tools, run

app = typer.Typer(help="Create and publish releases.")


class BumpType(str, Enum):
  """Version bump types."""

  patch = "patch"
  minor = "minor"
  major = "major"


def _get_current_version() -> str:
  """Read version from TypeScript package.json (source of truth)."""
  pkg = PACKAGES_DIR / "adk-sim-protos-ts" / "package.json"
  return str(json.loads(pkg.read_text())["version"])


def _bump_version(current: str, bump: BumpType) -> str:
  """Calculate next version."""
  parts = current.split(".")
  major, minor, patch_num = int(parts[0]), int(parts[1]), int(parts[2])
  if bump == BumpType.major:
    return f"{major + 1}.0.0"
  if bump == BumpType.minor:
    return f"{major}.{minor + 1}.0"
  return f"{major}.{minor}.{patch_num + 1}"


def _sync_versions(version: str, verbose: bool = False) -> None:
  """Update version in all package files."""
  run(
    ["uv", "run", "python", "scripts/sync_versions.py", version],
    cwd=REPO_ROOT,
    verbose=verbose,
  )


@app.command()
def status() -> None:
  """
  Show current version and release status.

  Example:
    ops release status
  """
  version = _get_current_version()

  console.print(f"Current version: [cyan]{version}[/cyan]")

  # Check working copy status via jj
  status_output = jj.get_status()
  if "The working copy has no changes" in status_output:
    console.print("Working copy:    [green]clean[/green]")
  else:
    console.print("Working copy:    [yellow]has changes[/yellow]")

  # Check if on main
  if jj.is_on_main():
    console.print("On main:         [green]yes[/green]")
  else:
    bookmark = jj.get_current_bookmark()
    if bookmark:
      console.print(f"Current bookmark: [cyan]{bookmark}[/cyan]")
    else:
      console.print("On main:         [yellow]no[/yellow]")


@app.command()
def patch(
  skip_ci: bool = typer.Option(False, "--skip-ci", help="Don't wait for CI checks"),
  yes: bool = typer.Option(False, "--yes", "-y", help="Auto-confirm prompts"),
  dry_run: bool = typer.Option(False, "--dry-run", "-n", help="Show what would happen"),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Create a patch release (x.y.Z).

  This will:
  1. Create a release branch with bumped version
  2. Open a PR and wait for CI (unless --skip-ci)
  3. Merge the PR (with confirmation unless --yes)
  4. Tag and push (triggers publish workflow)

  Examples:
    ops release patch           Interactive release
    ops release patch --yes     Fully automated
    ops release patch --dry-run Show what would happen
  """
  _do_release(
    BumpType.patch, skip_ci=skip_ci, yes=yes, dry_run=dry_run, verbose=verbose
  )


@app.command()
def minor(
  skip_ci: bool = typer.Option(False, "--skip-ci"),
  yes: bool = typer.Option(False, "--yes", "-y"),
  dry_run: bool = typer.Option(False, "--dry-run", "-n"),
  verbose: bool = typer.Option(False, "--verbose", "-v"),
) -> None:
  """
  Create a minor release (x.Y.0).

  Examples:
    ops release minor
    ops release minor --yes
  """
  _do_release(
    BumpType.minor, skip_ci=skip_ci, yes=yes, dry_run=dry_run, verbose=verbose
  )


@app.command()
def major(
  skip_ci: bool = typer.Option(False, "--skip-ci"),
  yes: bool = typer.Option(False, "--yes", "-y"),
  dry_run: bool = typer.Option(False, "--dry-run", "-n"),
  verbose: bool = typer.Option(False, "--verbose", "-v"),
) -> None:
  """
  Create a major release (X.0.0).

  Examples:
    ops release major
    ops release major --yes
  """
  _do_release(
    BumpType.major, skip_ci=skip_ci, yes=yes, dry_run=dry_run, verbose=verbose
  )


def _do_release(
  bump: BumpType,
  *,
  skip_ci: bool,
  yes: bool,
  dry_run: bool,
  verbose: bool,
) -> None:
  """Execute the release workflow using Jujutsu.

  Workflow:
  1. Ensure clean working copy
  2. Create release change with version bumps
  3. Create bookmark and push for PR
  4. Wait for CI (unless --skip-ci)
  5. Merge PR via GitHub
  6. Fetch merged changes, create and push tag
  """
  require_tools("jj", "gh")

  # 1. Validation
  console.print("Validating prerequisites...")
  jj.ensure_clean_working_copy()

  current = _get_current_version()
  next_version = _bump_version(current, bump)
  bookmark_name = f"release/v{next_version}"
  tag_name = f"v{next_version}"

  console.print(f"Version: [cyan]{current}[/cyan] -> [green]{next_version}[/green]")

  if dry_run:
    console.print("\n[yellow]Dry run - no changes made[/yellow]")
    console.print("\nWould execute:")
    console.print(f"  1. Create change with bookmark {bookmark_name}")
    console.print("  2. Update version in all package files")
    console.print("  3. Push bookmark and create PR")
    console.print("  4. Wait for CI")
    console.print(f"  5. Merge PR and tag {tag_name}")
    return

  # 2. Confirmation (unless --yes)
  if not yes:
    proceed = typer.confirm(f"Create {bump.value} release v{next_version}?")
    if not proceed:
      raise typer.Abort()

  # 3. Create release change
  # Save current change ID to return to after release setup
  original_change = jj.get_change_id()

  with Progress(
    SpinnerColumn(),
    TextColumn("[progress.description]{task.description}"),
    console=console,
  ) as progress:
    task = progress.add_task("Creating release change...", total=None)

    # Create new change on main for the release
    jj.new(message=f"chore: release v{next_version}", revision="main", verbose=verbose)

    progress.update(task, description="Updating version files...")
    _sync_versions(next_version, verbose=verbose)

    # Create bookmark for the release branch
    progress.update(task, description="Creating bookmark...")
    jj.bookmark_create(bookmark_name, revision="@", verbose=verbose)

    progress.update(task, description="Pushing bookmark...")
    jj.git_push(bookmark_name, verbose=verbose)

    progress.update(task, description="Creating PR...")

  gh = GitHubClient()
  pr_url = gh.create_pr(
    title=f"chore: release v{next_version}",
    branch=bookmark_name,
    body=f"Release v{next_version}\n\nBump type: {bump.value}",
  )

  console.print(f"\n[green]![/green] PR created: {pr_url}")

  # Extract PR number from URL
  pr_number = int(pr_url.rstrip("/").split("/")[-1])

  # 4. Wait for CI (unless --skip-ci)
  if not skip_ci:
    console.print("\nWaiting for CI checks...")
    with Progress(
      SpinnerColumn(),
      TextColumn("[progress.description]{task.description}"),
      console=console,
    ) as progress:
      progress.add_task("CI running...", total=None)
      passed = gh.wait_for_checks(pr_number)

    if not passed:
      console.print("[red]![/red] CI checks failed")
      console.print(f"[dim]PR left open: {pr_url}[/dim]")
      raise typer.Exit(ExitCode.EXTERNAL)

    console.print("[green]![/green] CI checks passed")

  # 5. Merge and tag
  if not yes:
    proceed = typer.confirm("Merge PR and create tag?")
    if not proceed:
      console.print(f"[dim]PR left open: {pr_url}[/dim]")
      return

  with Progress(
    SpinnerColumn(),
    TextColumn("[progress.description]{task.description}"),
    console=console,
  ) as progress:
    task = progress.add_task("Merging PR...", total=None)
    # Use rebase merge so jj recognizes the commit on main
    gh.merge_pr(pr_number, squash=False, rebase=True)

    # Fetch the merged changes
    progress.update(task, description="Fetching merged changes...")
    jj.git_fetch(verbose=verbose)

    # Clean up the local release change (it's now on main)
    # The bookmark will be deleted automatically after merge
    progress.update(task, description="Creating tag...")

  # Create and push the tag using jj git
  # First, find the commit on main that has the release
  run(
    ["jj", "git", "push", "--change", "main", f"--set-tag={tag_name}"],
    cwd=REPO_ROOT,
    verbose=verbose,
  )

  # Return to original work if we were somewhere else
  if original_change:
    jj.edit(original_change, verbose=verbose)

  console.print(f"\n[green]![/green] Released {tag_name}!")
  console.print("[dim]Publish workflow triggered[/dim]")
