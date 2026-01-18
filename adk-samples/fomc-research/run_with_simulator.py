#!/usr/bin/env python3
"""Run the FOMC Research agent with the ADK Simulator plugin.

This script runs the agent with the SimulatorPlugin enabled, allowing
human-in-the-loop validation of LLM requests through the simulator UI.

Usage:
    # Start the simulator server first (from adk-sim-plugin root):
    ops dev server

    # Then run this script:
    python run_with_simulator.py

Environment Variables:
    ADK_SIM_SERVER: gRPC server address (default: localhost:50051)
    ADK_SIM_TARGETS: Comma-separated agent names to intercept (default: all)
    GOOGLE_GENAI_MODEL: Model to use (default: gemini-3-flash-preview)
"""

import asyncio
import os
import sys

# Ensure the fomc_research package is importable
sys.path.insert(0, os.path.dirname(__file__))


async def main() -> None:
  """Run the FOMC Research agent with simulator plugin."""
  # Import plugin first (applies betterproto patch)
  from adk_agent_sim import SimulatorPlugin

  # Import the agent
  from fomc_research.agent import root_agent

  # Import ADK components
  from google.adk.runners import InMemoryRunner
  from google.genai import types

  # Create the simulator plugin
  plugin = SimulatorPlugin(
    server_url=os.getenv("ADK_SIM_SERVER", "localhost:50051"),
    # Leave target_agents empty to intercept all agents
  )

  # Create runner with the plugin
  runner = InMemoryRunner(
    agent=root_agent,
    app_name="fomc_research",
    plugins=[plugin],
  )

  # Initialize plugin and get session URL
  session_url = await plugin.initialize(
    description="FOMC Research Agent - analyzing Federal Reserve meetings"
  )
  print(f"\nSimulator session ready at: {session_url}\n")

  # Create a session
  session = await runner.session_service.create_session(
    app_name="fomc_research",
    user_id="user",
  )

  print("FOMC Research Agent ready. Type your query below.")
  print("=" * 60)

  try:
    while True:
      # Get user input
      try:
        user_input = input("\nYou: ").strip()
      except EOFError:
        break

      if not user_input:
        continue

      if user_input.lower() in ("quit", "exit", "q"):
        break

      print("\nAgent: ", end="", flush=True)

      # Create Content object from user input
      content = types.Content(
        role="user",
        parts=[types.Part(text=user_input)],
      )

      # Run the agent
      async for event in runner.run_async(
        user_id=session.user_id,
        session_id=session.id,
        new_message=content,
      ):
        # Print text responses
        if hasattr(event, "content") and event.content:
          if hasattr(event.content, "parts") and event.content.parts:
            for part in event.content.parts:
              if hasattr(part, "text") and part.text:
                print(part.text, end="", flush=True)

      print()  # Newline after response

  except KeyboardInterrupt:
    print("\n\nInterrupted by user.")
  finally:
    await plugin.close()
    print("Session closed.")


if __name__ == "__main__":
  asyncio.run(main())
