"""
ops - Developer CLI for adk-sim-plugin

A unified interface for building, testing, and releasing.
"""

import sys

import typer

from ops import __version__
from ops.commands.build import app as build_app
from ops.commands.ci import app as ci_app
from ops.commands.dev import app as dev_app
from ops.commands.docker import app as docker_app
from ops.commands.quality import app as quality_app
from ops.commands.release import app as release_app
from ops.commands.test import app as test_app
from ops.commands.trace import app as trace_app
from ops.core.console import console
from ops.core.process import ExitCode

# Main app with pretty exceptions
app = typer.Typer(
  name="ops",
  help="Developer CLI for adk-sim-plugin.",
  no_args_is_help=True,
  pretty_exceptions_enable=True,
  pretty_exceptions_show_locals=False,
  pretty_exceptions_short=True,
  rich_markup_mode="rich",
)

# Register command groups
app.add_typer(build_app, name="build")
app.add_typer(dev_app, name="dev")
app.add_typer(docker_app, name="docker")
app.add_typer(quality_app, name="quality")
app.add_typer(release_app, name="release")
app.add_typer(ci_app, name="ci")
app.add_typer(test_app, name="test")
app.add_typer(trace_app, name="trace")


@app.callback(invoke_without_command=True)
def main(
  ctx: typer.Context,
  version: bool = typer.Option(False, "--version", help="Show version and exit"),
) -> None:
  """
  Developer CLI for adk-sim-plugin.

  Common workflows:
    ops dev              Start development servers
    ops build            Build all artifacts
    ops quality          Run quality checks
    ops release patch    Create a patch release
  """
  if version:
    console.print(f"ops version {__version__}")
    raise typer.Exit()

  # If no command given, show help
  if ctx.invoked_subcommand is None:
    console.print(ctx.get_help())


def main_with_interrupt_handler() -> None:
  """Entry point that handles keyboard interrupts gracefully."""
  try:
    app()
  except KeyboardInterrupt:
    console.print("\n[dim]Interrupted[/dim]")
    sys.exit(ExitCode.INTERRUPTED)


if __name__ == "__main__":
  main_with_interrupt_handler()
