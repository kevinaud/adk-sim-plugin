"""Release management commands."""

import json
import subprocess
from enum import Enum

import typer
from rich.progress import Progress, SpinnerColumn, TextColumn

from ops.core.console import console
from ops.core.git import ensure_clean_tree, get_current_branch
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
  branch = get_current_branch()

  console.print(f"Current version: [cyan]{version}[/cyan]")
  console.print(f"Current branch:  [cyan]{branch}[/cyan]")

  # Check for uncommitted changes
  result = subprocess.run(
    ["git", "status", "--porcelain"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
    check=False,
  )
  if result.stdout.strip():
    lines = result.stdout.strip().split("\n")
    console.print(f"Uncommitted:     [yellow]{len(lines)} files[/yellow]")
  else:
    console.print("Working tree:    [green]clean[/green]")

  # Check for unpushed commits
  result = subprocess.run(
    ["git", "log", "@{u}..HEAD", "--oneline"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
    check=False,
  )
  if result.returncode == 0 and result.stdout.strip():
    commits = result.stdout.strip().split("\n")
    console.print(f"Unpushed:        [yellow]{len(commits)} commits[/yellow]")


@app.command()
def patch(
  skip_ci: bool = typer.Option(
    False, "--skip-ci", help="Don't wait for CI checks"
  ),
  yes: bool = typer.Option(
    False, "--yes", "-y", help="Auto-confirm prompts"
  ),
  dry_run: bool = typer.Option(
    False, "--dry-run", "-n", help="Show what would happen"
  ),
  verbose: bool = typer.Option(
    False, "--verbose", "-v", help="Show detailed output"
  ),
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
  """Execute the release workflow."""
  require_tools("git", "gh")

  # 1. Validation
  console.print("Validating prerequisites...")
  ensure_clean_tree()

  current = _get_current_version()
  next_version = _bump_version(current, bump)
  branch_name = f"release/v{next_version}"

  console.print(f"Version: [cyan]{current}[/cyan] -> [green]{next_version}[/green]")

  if dry_run:
    console.print("\n[yellow]Dry run - no changes made[/yellow]")
    console.print("\nWould execute:")
    console.print(f"  1. Create branch {branch_name}")
    console.print("  2. Update version in all package files")
    console.print("  3. Create PR and wait for CI")
    console.print(f"  4. Merge PR and tag v{next_version}")
    return

  # 2. Confirmation (unless --yes)
  if not yes:
    proceed = typer.confirm(f"Create {bump.value} release v{next_version}?")
    if not proceed:
      raise typer.Abort()

  # 3. Create release branch
  with Progress(
    SpinnerColumn(),
    TextColumn("[progress.description]{task.description}"),
    console=console,
  ) as progress:
    task = progress.add_task("Creating release branch...", total=None)

    run(
      ["git", "checkout", "-b", branch_name],
      cwd=REPO_ROOT,
      verbose=verbose,
    )

    progress.update(task, description="Updating version files...")
    _sync_versions(next_version, verbose=verbose)

    run(
      ["git", "add", "-A"],
      cwd=REPO_ROOT,
      verbose=verbose,
    )

    run(
      ["git", "commit", "-m", f"chore: release v{next_version}"],
      cwd=REPO_ROOT,
      verbose=verbose,
    )

    progress.update(task, description="Pushing branch...")
    run(
      ["git", "push", "-u", "origin", branch_name],
      cwd=REPO_ROOT,
      verbose=verbose,
    )

    progress.update(task, description="Creating PR...")

  gh = GitHubClient()
  pr_url = gh.create_pr(
    title=f"chore: release v{next_version}",
    branch=branch_name,
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
    progress.add_task("Merging PR...", total=None)
    gh.merge_pr(pr_number, squash=True)

  # Pull the merged changes and tag
  run(["git", "checkout", "main"], cwd=REPO_ROOT, verbose=verbose)
  run(["git", "pull"], cwd=REPO_ROOT, verbose=verbose)

  tag_name = f"v{next_version}"
  run(
    ["git", "tag", "-a", tag_name, "-m", f"Release {tag_name}"],
    cwd=REPO_ROOT,
    verbose=verbose,
  )
  run(["git", "push", "origin", tag_name], cwd=REPO_ROOT, verbose=verbose)

  console.print(f"\n[green]![/green] Released {tag_name}!")
  console.print("[dim]Publish workflow triggered[/dim]")
