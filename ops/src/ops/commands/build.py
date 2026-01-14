"""Build commands for ops."""

from enum import Enum
from functools import lru_cache

import typer

from ops.core.console import console
from ops.core.paths import (
  FRONTEND_DIR,
  PROTO_MARKER,
  PROTOS_DIR,
  REPO_ROOT,
  TS_PROTOS_DIR,
)
from ops.core.process import require_tools, run

app = typer.Typer(
  help="Build project artifacts.",
  no_args_is_help=False,  # Has default action
)


class BuildTarget(str, Enum):
  """Available build targets."""

  protos = "protos"
  frontend = "frontend"
  packages = "packages"
  all = "all"


def _protos_are_stale() -> bool:
  """Check if protos need regeneration."""
  if not PROTO_MARKER.exists():
    return True

  marker_mtime = PROTO_MARKER.stat().st_mtime
  protos = list(PROTOS_DIR.rglob("*.proto"))

  return any(p.stat().st_mtime > marker_mtime for p in protos)


@lru_cache(maxsize=1)
def build_protos(force: bool = False, verbose: bool = False) -> bool:
  """
  Generate proto code. Cached to run at most once per invocation.

  Returns True if protos were generated, False if skipped.
  """
  require_tools("buf", "uv")

  # Check staleness
  if not force and not _protos_are_stale():
    console.print("[dim]Protos up to date, skipping[/dim]")
    return False

  console.print("Generating protos...")

  # Backup custom index.ts (hand-maintained re-export file)
  index_ts = TS_PROTOS_DIR / "index.ts"
  index_backup = None
  if index_ts.exists():
    index_backup = index_ts.read_text()

  # Generate
  run(["buf", "generate"], cwd=REPO_ROOT, verbose=verbose)

  # Restore index.ts
  if index_backup:
    index_ts.write_text(index_backup)

  # Format generated Python code
  run(
    ["uv", "run", "ruff", "format", "packages/adk-sim-protos"],
    cwd=REPO_ROOT,
    verbose=verbose,
  )

  # Touch marker
  PROTO_MARKER.touch()

  console.print("[green]![/green] Protos generated")
  return True


@lru_cache(maxsize=1)
def build_ts_packages(force: bool = False, verbose: bool = False) -> bool:
  """Build TypeScript packages."""
  require_tools("npm")

  console.print("Building TypeScript packages...")

  # Build protos-ts first
  run(
    ["npm", "run", "build", "--workspace=packages/adk-sim-protos-ts"],
    cwd=REPO_ROOT,
    verbose=verbose,
  )

  # Build converters-ts
  run(
    ["npm", "run", "build", "--workspace=packages/adk-converters-ts"],
    cwd=REPO_ROOT,
    verbose=verbose,
  )

  console.print("[green]![/green] TypeScript packages built")
  return True


@lru_cache(maxsize=1)
def build_frontend(force: bool = False, verbose: bool = False) -> bool:
  """Build frontend. Ensures protos and TS packages are built first."""
  require_tools("npm")

  # Dependencies
  build_protos(force=force, verbose=verbose)
  build_ts_packages(force=force, verbose=verbose)

  console.print("Building frontend...")
  run(
    ["npm", "run", "build", "--", "--configuration", "production"],
    cwd=FRONTEND_DIR,
    env={"CI": "true"},
    verbose=verbose,
  )

  console.print("[green]![/green] Frontend built")
  return True


@lru_cache(maxsize=1)
def build_packages(force: bool = False, verbose: bool = False) -> bool:
  """Build Python packages (wheels and sdists)."""
  require_tools("uv")

  # Dependencies
  build_protos(force=force, verbose=verbose)
  build_frontend(force=force, verbose=verbose)

  console.print("Building Python packages...")

  # Bundle frontend into server
  bundle_frontend(verbose=verbose)

  # Build all Python packages
  packages = [
    "adk-sim-protos",
    "adk-sim-testing",
    "adk-sim-server",
    "adk-agent-sim",
  ]

  for pkg in packages:
    run(
      ["uv", "build", "--package", pkg],
      cwd=REPO_ROOT,
      verbose=verbose,
    )
    console.print(f"[green]![/green] Built {pkg}")

  console.print("[green]![/green] Python packages built")
  return True


def bundle_frontend(verbose: bool = False) -> None:
  """Copy frontend dist into server package for bundling."""
  import shutil

  # Angular builds to frontend/dist/frontend/ with a browser/ subdirectory
  # The server expects static/browser/index.html, so we copy the entire frontend/
  # directory structure to preserve the browser/ subdirectory
  frontend_dist = FRONTEND_DIR / "dist" / "frontend"
  server_static = REPO_ROOT / "server" / "src" / "adk_sim_server" / "static"

  if not frontend_dist.exists():
    console.print("[yellow]Warning:[/yellow] Frontend not built, skipping bundle")
    return

  # Clear static directory but preserve .gitkeep
  gitkeep_content = None
  gitkeep_path = server_static / ".gitkeep"
  if gitkeep_path.exists():
    gitkeep_content = gitkeep_path.read_text()

  if server_static.exists():
    shutil.rmtree(server_static)
  shutil.copytree(frontend_dist, server_static)

  # Restore .gitkeep
  if gitkeep_content:
    gitkeep_path.write_text(gitkeep_content)

  console.print("[green]![/green] Frontend bundled into server")


def build_all(force: bool = False, verbose: bool = False) -> bool:
  """Build everything in dependency order."""
  build_protos(force=force, verbose=verbose)
  build_ts_packages(force=force, verbose=verbose)
  build_frontend(force=force, verbose=verbose)
  build_packages(force=force, verbose=verbose)
  return True


def clean_generated(verbose: bool = False) -> None:
  """Remove all generated files."""
  import shutil

  targets = [
    REPO_ROOT / "packages" / "adk-sim-protos" / "src" / "adk_sim_protos" / "adksim",
    REPO_ROOT / "packages" / "adk-sim-protos" / "src" / "adk_sim_protos" / "google",
    REPO_ROOT / "packages" / "adk-sim-protos-ts" / "src" / "adksim",
    REPO_ROOT / "packages" / "adk-sim-protos-ts" / "src" / "google",
    REPO_ROOT / "server" / "src" / "adk_sim_server" / "static",
    REPO_ROOT / "frontend" / "dist",
    REPO_ROOT / "dist",
    PROTO_MARKER,
  ]

  for target in targets:
    if target.exists():
      if verbose:
        console.print(f"[dim]Removing {target}[/dim]")
      if target.is_dir():
        shutil.rmtree(target)
      else:
        target.unlink()

  # Clear the LRU caches so builds run fresh
  build_protos.cache_clear()
  build_ts_packages.cache_clear()
  build_frontend.cache_clear()
  build_packages.cache_clear()

  console.print("[green]![/green] Generated files cleaned")


@app.callback(invoke_without_command=True)
def build(
  _ctx: typer.Context,
  target: BuildTarget = typer.Argument(
    BuildTarget.all,
    help="What to build [protos|frontend|packages|all]",
  ),
  clean: bool = typer.Option(False, "--clean", help="Clean before building"),
  force: bool = typer.Option(
    False, "--skip-cache", help="Force rebuild even if outputs are fresh"
  ),
  update_vendor: bool = typer.Option(
    False, "--update-vendor", help="Update vendored protos from googleapis first"
  ),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show build output"),
) -> None:
  """
  Build project artifacts.

  Examples:
    ops build                      Build everything
    ops build protos               Generate proto code only
    ops build protos --update-vendor  Update vendored protos then generate
    ops build frontend             Build Angular bundle
    ops build --clean              Clean then build
  """
  if clean:
    clean_generated(verbose=verbose)

  if update_vendor:
    update_vendored_protos(verbose=verbose)

  if target == BuildTarget.protos:
    build_protos(force=force, verbose=verbose)
  elif target == BuildTarget.frontend:
    build_frontend(force=force, verbose=verbose)
  elif target == BuildTarget.packages:
    build_packages(force=force, verbose=verbose)
  else:
    build_all(force=force, verbose=verbose)

  console.print("\n[green]![/green] Build complete")
  console.print("[dim]Next: ops dev[/dim]")


def update_vendored_protos(verbose: bool = False) -> None:
  """Update vendored Google AI protos from googleapis."""
  import urllib.request

  vendor_dir = REPO_ROOT / "protos" / "google" / "ai" / "generativelanguage" / "v1beta"
  base_url = "https://raw.githubusercontent.com/googleapis/googleapis/master/google/ai/generativelanguage/v1beta"

  protos = [
    "generative_service.proto",
    "content.proto",
    "citation.proto",
    "retriever.proto",
    "safety.proto",
  ]

  console.print("[bold]Updating vendored Google AI protos...[/bold]")
  console.print(f"[dim]Target: {vendor_dir}[/dim]")

  vendor_dir.mkdir(parents=True, exist_ok=True)

  for proto in protos:
    url = f"{base_url}/{proto}"
    dest = vendor_dir / proto
    if verbose:
      console.print(f"[dim]Downloading {url}[/dim]")
    else:
      console.print(f"  Downloading {proto}...")

    urllib.request.urlretrieve(url, dest)

  console.print("[green]![/green] Vendored protos updated")
