"""Release management commands.

Uses Jujutsu (jj) for version control operations.
"""

import json
from enum import Enum
from pathlib import Path

import tomlkit
import typer
from rich.progress import Progress, SpinnerColumn, TextColumn

from ops.core import jj
from ops.core.console import console
from ops.core.github import GitHubClient
from ops.core.paths import PACKAGES_DIR, REPO_ROOT
from ops.core.process import ExitCode, require_tools

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


# Python packages to update (relative to repo root)
_PYTHON_PACKAGES = [
  Path("packages/adk-sim-protos/pyproject.toml"),
  Path("packages/adk-sim-testing/pyproject.toml"),
  Path("server/pyproject.toml"),
  Path("plugins/python/pyproject.toml"),
]

# TypeScript packages to update (relative to repo root)
_TS_PACKAGES = [
  Path("packages/adk-sim-protos-ts/package.json"),
  Path("packages/adk-converters-ts/package.json"),
]

# Internal package names that should use exact version pinning
_INTERNAL_PACKAGES = frozenset(
  {
    "adk-sim-protos",
    "adk-sim-testing",
    "adk-sim-server",
    "adk-agent-sim",
  }
)


def _update_dependency_version(dep: str, version: str) -> str | None:
  """Update an internal dependency string to use exact version pinning.

  Args:
      dep: The dependency string (e.g., "adk-sim-protos" or "adk-sim-protos>=1.0.0")
      version: The new version to pin to

  Returns:
      Updated dependency string with exact version, or None if not an internal package
  """
  # Extract package name (before any version specifier)
  package_name = dep.split(">=")[0].split("==")[0].split("<")[0].split(">")[0].strip()

  if package_name in _INTERNAL_PACKAGES:
    return f"{package_name}=={version}"

  return None


def _update_pyproject(path: Path, version: str) -> bool:
  """Update a pyproject.toml file with the new version.

  Args:
      path: Path to the pyproject.toml file
      version: The new version to set

  Returns:
      True if changes were made, False otherwise
  """
  with path.open() as f:
    doc = tomlkit.load(f)

  changed = False

  # Update project.version
  project = doc.get("project")
  if project is not None:
    if project.get("version") != version:  # type: ignore[union-attr]
      project["version"] = version  # type: ignore[index]
      changed = True

    # Update internal dependencies in project.dependencies
    if "dependencies" in project:
      deps = list(project["dependencies"])  # type: ignore[index]
      for i, dep in enumerate(deps):
        updated = _update_dependency_version(str(dep), version)
        if updated and deps[i] != updated:
          deps[i] = updated
          changed = True
      if changed:
        project["dependencies"] = deps  # type: ignore[index]

  # Update internal dependencies in dependency-groups.dev (if present)
  dep_groups = doc.get("dependency-groups")
  if dep_groups is not None and "dev" in dep_groups:  # type: ignore[operator]
    dev_deps = list(dep_groups["dev"])  # type: ignore[index]
    deps_changed = False
    for i, dep in enumerate(dev_deps):
      updated = _update_dependency_version(str(dep), version)
      if updated and dev_deps[i] != updated:
        dev_deps[i] = updated
        deps_changed = True
    if deps_changed:
      dep_groups["dev"] = dev_deps  # type: ignore[index]
      changed = True

  if changed:
    with path.open("w") as f:
      tomlkit.dump(doc, f)

  return changed


def _update_ts_package(path: Path, version: str) -> bool:
  """Update a TypeScript package.json with the new version.

  Args:
      path: Path to the package.json file
      version: The new version to set

  Returns:
      True if changes were made, False otherwise
  """
  with path.open() as f:
    data = json.load(f)

  if data.get("version") == version:
    return False

  data["version"] = version
  with path.open("w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")  # Trailing newline for POSIX compliance

  return True


def _sync_versions(version: str, verbose: bool = False) -> None:
  """Update version in all package files.

  Updates:
  - TypeScript package.json files
  - Python pyproject.toml files (version and internal dependency pins)
  """
  updated_files: list[str] = []

  # Update TypeScript packages
  for path in _TS_PACKAGES:
    full_path = REPO_ROOT / path
    if not full_path.exists():
      if verbose:
        console.print(f"[yellow]Skipping {path} (not found)[/yellow]")
      continue

    if _update_ts_package(full_path, version):
      updated_files.append(str(path))
      if verbose:
        console.print(f"[green]Updated {path}[/green]")

  # Update Python packages
  for path in _PYTHON_PACKAGES:
    full_path = REPO_ROOT / path
    if not full_path.exists():
      if verbose:
        console.print(f"[yellow]Skipping {path} (not found)[/yellow]")
      continue

    if _update_pyproject(full_path, version):
      updated_files.append(str(path))
      if verbose:
        console.print(f"[green]Updated {path}[/green]")

  if verbose:
    console.print(f"\n[green]Synced {len(updated_files)} files to v{version}[/green]")


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

    # Create or update bookmark for the release branch
    progress.update(task, description="Creating bookmark...")
    jj.bookmark_set(bookmark_name, revision="@", verbose=verbose)

    # Track the bookmark on origin so we can push it
    jj.bookmark_track(bookmark_name, verbose=verbose)

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
  jj.git_push_tag(tag_name, revision="main", verbose=verbose)

  # Return to original work if we were somewhere else
  if original_change:
    jj.edit(original_change, verbose=verbose)

  console.print(f"\n[green]![/green] Released {tag_name}!")
  console.print("[dim]Publish workflow triggered[/dim]")
