#!/usr/bin/env python3
"""Run the ADK CLI with HTTP request/response recording enabled.

This script patches httpx to record all requests/responses before invoking
the ADK CLI. It can be used as a drop-in replacement for the `adk` command.

Usage:
    python run_with_recorder.py run --replay replay.json fomc_research
"""

import atexit
import json
import sys
from functools import wraps
from typing import Any

import httpx


class HttpxRecorder:
  """Records httpx AsyncClient requests and responses to a JSON file."""

  _instance = None

  def __init__(self, filename: str = "vertex_debug.json"):
    self.filename = filename
    self.records: list[dict[str, Any]] = []
    self._original_send: Any = None
    self._started = False

  @classmethod
  def get_instance(cls, filename: str = "vertex_debug.json") -> "HttpxRecorder":
    """Get or create singleton instance."""
    if cls._instance is None:
      cls._instance = cls(filename)
    return cls._instance

  def start(self) -> None:
    """Start recording by monkey-patching httpx.AsyncClient.send."""
    if self._started:
      return
    self._original_send = httpx.AsyncClient.send
    recorder = self  # Capture self for the closure

    @wraps(self._original_send)
    async def hooked_send(
      client: httpx.AsyncClient, request: httpx.Request, **kwargs: Any
    ) -> httpx.Response:
      # Read request body
      req_body: Any = None
      if request.content:
        try:
          req_body = json.loads(request.content.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
          req_body = request.content.decode("utf-8", errors="replace")

      # Run the actual request
      response = await recorder._original_send(client, request, **kwargs)

      # Read response body (requires reading the stream)
      await response.aread()
      res_body: Any = None
      try:
        res_body = json.loads(response.content.decode("utf-8"))
      except (json.JSONDecodeError, UnicodeDecodeError):
        res_body = response.content.decode("utf-8", errors="replace")

      # Record interaction
      recorder.records.append(
        {
          "url": str(request.url),
          "method": request.method,
          "headers": dict(request.headers),
          "request_json": req_body,
          "response_json": res_body,
          "status_code": response.status_code,
        }
      )

      return response

    httpx.AsyncClient.send = hooked_send  # type: ignore[method-assign]
    self._started = True
    print(f"[HttpxRecorder] Started recording to {self.filename}", file=sys.stderr)

  def stop(self) -> None:
    """Stop recording and save to file."""
    if not self._started:
      return
    httpx.AsyncClient.send = self._original_send  # type: ignore[method-assign]
    self._started = False
    with open(self.filename, "w", encoding="utf-8") as f:
      json.dump(self.records, f, indent=2)
    print(
      f"[HttpxRecorder] Recorded {len(self.records)} requests to {self.filename}",
      file=sys.stderr,
    )


def main() -> None:
  """Main entry point - patches httpx and runs the ADK CLI."""
  # Initialize recorder and start BEFORE importing ADK
  recorder = HttpxRecorder.get_instance("vertex_debug.json")
  recorder.start()

  # Register cleanup on exit
  atexit.register(recorder.stop)

  # Import and run the ADK CLI
  from google.adk.cli import main as adk_main

  adk_main()


if __name__ == "__main__":
  main()
