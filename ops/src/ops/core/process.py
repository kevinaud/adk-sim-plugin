"""Subprocess execution utilities."""

import os
import shutil
import subprocess
from enum import IntEnum
from pathlib import Path

import typer

from ops.core.console import console


class ExitCode(IntEnum):
  """Standard exit codes following CLI conventions."""

  SUCCESS = 0
  ERROR = 1
  USAGE = 2
  PREREQ = 3
  EXTERNAL = 4
  INTERRUPTED = 130


def run(
  cmd: list[str],
  cwd: Path | None = None,
  env: dict[str, str] | None = None,
  check: bool = True,
  capture: bool = False,
  verbose: bool = False,
  input_data: str | None = None,
) -> subprocess.CompletedProcess[str]:
  """
  Run a subprocess with sensible defaults.

  Args:
    cmd: Command and arguments
    cwd: Working directory
    env: Additional environment variables (merged with current env)
    check: Raise on non-zero exit
    capture: Capture stdout/stderr
    verbose: Show command output in real-time
    input_data: String to pass to stdin

  Returns:
    CompletedProcess with stdout/stderr if captured

  Raises:
    typer.Exit: On failure with helpful message
  """
  full_env = os.environ.copy()
  if env:
    full_env.update(env)

  if verbose:
    console.print(f"[dim]$ {' '.join(cmd)}[/dim]")

  try:
    return subprocess.run(
      cmd,
      cwd=cwd,
      env=full_env,
      check=check,
      capture_output=capture,
      text=True,
      input=input_data,
    )
  except subprocess.CalledProcessError as e:
    console.print(f"[red]Error:[/red] Command failed: {' '.join(cmd)}")
    if e.stdout:
      console.print(e.stdout)
    if e.stderr:
      console.print(e.stderr, style="red")
    raise typer.Exit(ExitCode.EXTERNAL) from None
  except FileNotFoundError:
    console.print(f"[red]Error:[/red] Command not found: {cmd[0]}")
    console.print("\nTo fix:")
    console.print(f"  Ensure {cmd[0]} is installed and in your PATH")
    raise typer.Exit(ExitCode.PREREQ) from None


def kill_port(port: int) -> bool:
  """Kill any process listening on the given port.

  Uses lsof to find processes and SIGKILL to terminate them.

  Args:
    port: The port number to free up

  Returns:
    True if a process was killed, False if port was already free
  """
  result = subprocess.run(
    ["lsof", "-ti", f":{port}"],
    capture_output=True,
    text=True,
    check=False,
  )

  if result.returncode != 0 or not result.stdout.strip():
    return False

  pids = result.stdout.strip().split("\n")
  for pid in pids:
    if pid:
      subprocess.run(["kill", "-9", pid], check=False)

  return True


def require_tools(*tools: str) -> None:
  """Ensure required external tools are available."""
  install_hints = {
    "act": "brew install act  # or see https://nektosact.com/",
    "gh": "brew install gh  # or see https://cli.github.com/",
    "git": "brew install git  # or https://git-scm.com/",
    "buf": "brew install bufbuild/buf/buf  # or see https://buf.build/",
    "npm": "Install Node.js from https://nodejs.org/",
    "uv": "curl -LsSf https://astral.sh/uv/install.sh | sh",
    "docker": "Install Docker Desktop from https://docker.com/",
  }

  missing = [tool for tool in tools if shutil.which(tool) is None]

  if missing:
    console.print(f"[red]Error:[/red] Missing required tools: {', '.join(missing)}")
    console.print("\nInstall with:")
    for tool in missing:
      hint = install_hints.get(tool, f"# Install {tool}")
      console.print(f"  {hint}")
    raise typer.Exit(ExitCode.PREREQ)
