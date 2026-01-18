"""Trace viewer commands.

View Playwright traces from E2E test runs.

Examples:
  ops trace view              List and select a trace to view
  ops trace view <name>       View a specific trace by name
  ops trace list              List all available traces
"""

from pathlib import Path

import typer
from rich.table import Table

from ops.core.console import console
from ops.core.paths import FRONTEND_DIR
from ops.core.process import require_tools, run

app = typer.Typer(
  help="View Playwright traces from E2E tests.",
)

# Directory where Playwright stores test results and traces
TRACE_DIR = FRONTEND_DIR / "test-results"


def _find_traces() -> list[tuple[str, Path]]:
  """Find all trace.zip files in the test-results directory.

  Returns:
      List of (display_name, trace_path) tuples, sorted by mtime (newest first).
  """
  if not TRACE_DIR.exists():
    return []

  traces: list[tuple[str, Path, float]] = []

  # Find all trace.zip files
  for trace_path in TRACE_DIR.rglob("trace.zip"):
    # Get the test name from the parent directory
    test_dir = trace_path.parent
    display_name = test_dir.name

    # Get modification time for sorting
    mtime = trace_path.stat().st_mtime
    traces.append((display_name, trace_path, mtime))

  # Sort by modification time (newest first)
  traces.sort(key=lambda x: x[2], reverse=True)

  return [(name, path) for name, path, _ in traces]


def _select_trace(traces: list[tuple[str, Path]]) -> Path | None:
  """Present an interactive selection menu for traces.

  Args:
      traces: List of (display_name, trace_path) tuples.

  Returns:
      Selected trace path, or None if cancelled.
  """
  console.print("\n[bold]Available traces:[/bold]\n")

  # Display numbered list
  for i, (name, path) in enumerate(traces, 1):
    # Get file size
    size_kb = path.stat().st_size / 1024
    console.print(f"  [cyan]{i:2}[/cyan]. {name} [dim]({size_kb:.0f} KB)[/dim]")

  console.print()

  # Prompt for selection
  while True:
    try:
      choice = console.input("[bold]Select trace number (or 'q' to quit):[/bold] ")

      if choice.lower() in ("q", "quit", "exit"):
        return None

      index = int(choice) - 1
      if 0 <= index < len(traces):
        return traces[index][1]

      console.print(f"[red]Invalid selection. Enter 1-{len(traces)}[/red]")

    except ValueError:
      console.print("[red]Please enter a number[/red]")
    except KeyboardInterrupt:
      console.print()
      return None


@app.callback(invoke_without_command=True)
def trace_callback(ctx: typer.Context) -> None:
  """
  View Playwright traces from E2E tests.

  Traces are generated when running E2E tests with --trace flag:
    ops test frontend e2e --trace

  Examples:
    ops trace view              Select and view a trace interactively
    ops trace view <name>       View a specific trace
    ops trace list              List all available traces
  """
  if ctx.invoked_subcommand is None:
    # Default to showing help
    console.print(ctx.get_help())


@app.command("list")
def list_traces() -> None:
  """List all available traces."""
  traces = _find_traces()

  if not traces:
    console.print("[yellow]No traces found.[/yellow]")
    console.print("\nGenerate traces by running E2E tests with --trace:")
    console.print("  [dim]ops test frontend e2e --trace[/dim]")
    return

  table = Table(title="Available Traces")
  table.add_column("#", style="cyan", width=4)
  table.add_column("Test Name", style="white")
  table.add_column("Size", style="dim", justify="right")
  table.add_column("Path", style="dim")

  for i, (name, path) in enumerate(traces, 1):
    size_kb = path.stat().st_size / 1024
    # Show relative path from repo root
    rel_path = path.relative_to(FRONTEND_DIR.parent)
    table.add_row(str(i), name, f"{size_kb:.0f} KB", str(rel_path))

  console.print(table)
  console.print(f"\n[dim]Total: {len(traces)} trace(s)[/dim]")


@app.command("view")
def view_trace(
  name: str | None = typer.Argument(
    None, help="Trace name or number to view (interactive if omitted)"
  ),
  port: int = typer.Option(
    9323, "--port", "-p", help="Port to serve trace viewer (use 0 for random)"
  ),
) -> None:
  """
  View a trace in the Playwright trace viewer.

  Serves the trace viewer as a web server accessible at http://localhost:<port>.
  This works in dev containers and remote environments.

  If no trace name is provided, presents an interactive selection menu.

  Examples:
    ops trace view                          # Interactive selection
    ops trace view simulation-flow-test     # View by name (partial match)
    ops trace view 1                        # View most recent trace
    ops trace view 1 --port 8080            # Use custom port
  """
  require_tools("npx")

  traces = _find_traces()

  if not traces:
    console.print("[yellow]No traces found.[/yellow]")
    console.print("\nGenerate traces by running E2E tests with --trace:")
    console.print("  [dim]ops test frontend e2e --trace[/dim]")
    raise typer.Exit(1)

  trace_path: Path | None = None

  if name is None:
    # Interactive selection
    trace_path = _select_trace(traces)
    if trace_path is None:
      raise typer.Exit(0)

  elif name.isdigit():
    # Selection by number
    index = int(name) - 1
    if 0 <= index < len(traces):
      trace_path = traces[index][1]
    else:
      console.print(f"[red]Invalid trace number. Available: 1-{len(traces)}[/red]")
      raise typer.Exit(1)

  else:
    # Search by name (partial match)
    matches = [(n, p) for n, p in traces if name.lower() in n.lower()]

    if len(matches) == 0:
      console.print(f"[red]No trace found matching '{name}'[/red]")
      console.print("\nAvailable traces:")
      for trace_name, _ in traces:
        console.print(f"  - {trace_name}")
      raise typer.Exit(1)

    if len(matches) == 1:
      trace_path = matches[0][1]

    else:
      console.print(f"[yellow]Multiple traces match '{name}':[/yellow]")
      trace_path = _select_trace(matches)
      if trace_path is None:
        raise typer.Exit(0)

  # Open the trace viewer as a web server
  console.print("\n[bold]Starting trace viewer...[/bold]")
  console.print(f"[dim]Trace: {trace_path}[/dim]")
  console.print(f"\n[green]Open in browser:[/green] http://localhost:{port}")
  console.print("[dim]Press Ctrl+C to stop the server[/dim]\n")

  run(
    [
      "npx",
      "playwright",
      "show-trace",
      "--host",
      "0.0.0.0",
      "--port",
      str(port),
      str(trace_path),
    ],
    cwd=FRONTEND_DIR,
  )
