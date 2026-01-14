"""Rich console singleton for consistent output."""

from rich.console import Console

# Global console instance - respects NO_COLOR, TERM=dumb, non-TTY automatically
console = Console()
