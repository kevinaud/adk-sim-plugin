"""gRPC-Web Gateway for the ADK Agent Simulator.

This module implements a gRPC-Web gateway using Starlette that allows
browser clients to communicate with the SimulatorService. It intercepts
gRPC-Web requests and translates them to direct method calls on the service.

The gateway avoids loopback network calls by invoking service methods
directly in-process.
"""

import base64
import struct
from pathlib import Path
from typing import TYPE_CHECKING

from adk_sim_protos.adksim.v1 import (
  CreateSessionRequest,
  CreateSessionResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  SubmitDecisionRequest,
  SubmitDecisionResponse,
  SubmitRequestRequest,
  SubmitRequestResponse,
)
from starlette.applications import Starlette
from starlette.responses import FileResponse, Response
from starlette.routing import Route

from adk_sim_server.logging import get_logger

if TYPE_CHECKING:
  import betterproto
  from starlette.requests import Request

  from adk_sim_server.services.simulator_service import SimulatorService

logger = get_logger("web")

# Static files directory (bundled frontend)
STATIC_DIR = Path(__file__).parent / "static"


def _decode_grpc_web_payload(body: bytes, is_text: bool) -> bytes:
  """Decode a gRPC-Web payload.

  gRPC-Web can send payloads in binary or base64-encoded text format.
  The payload format is: 1 byte flag + 4 bytes length (big-endian) + message.

  Args:
      body: Raw request body.
      is_text: Whether the payload is base64-encoded (grpc-web-text).

  Returns:
      The decoded protobuf message bytes.
  """
  if is_text:
    body = base64.b64decode(body)

  # gRPC message format: 1 byte compressed flag + 4 bytes message length + message
  if len(body) < 5:
    msg = f"Invalid gRPC-Web payload: too short ({len(body)} bytes)"
    raise ValueError(msg)

  # First byte is compression flag (0 = uncompressed)
  # Next 4 bytes are message length in big-endian
  _compressed_flag = body[0]
  message_length = struct.unpack(">I", body[1:5])[0]

  return body[5 : 5 + message_length]


def _encode_grpc_web_response(message: betterproto.Message, is_text: bool) -> bytes:
  """Encode a protobuf message as a gRPC-Web response.

  The response includes the message frame and a trailer frame with grpc-status.

  Args:
      message: The betterproto message to encode.
      is_text: Whether to base64-encode the response (grpc-web-text).

  Returns:
      The encoded gRPC-Web response bytes.
  """
  # Serialize the message using betterproto
  message_bytes = bytes(message)

  # Build message frame: 0 (not compressed) + length + message
  message_frame = bytes([0]) + struct.pack(">I", len(message_bytes)) + message_bytes

  # Build trailer frame: 0x80 (trailer flag) + length + trailers
  trailers = b"grpc-status:0\r\n"
  trailer_frame = bytes([0x80]) + struct.pack(">I", len(trailers)) + trailers

  response = message_frame + trailer_frame

  if is_text:
    response = base64.b64encode(response)

  return response


def _get_content_type(is_text: bool) -> str:
  """Get the appropriate content-type header for gRPC-Web response."""
  return "application/grpc-web-text" if is_text else "application/grpc-web+proto"


# Method name to (request_class, handler_method_name) mapping
_METHOD_MAP: dict[str, tuple[type[betterproto.Message], str]] = {
  "CreateSession": (CreateSessionRequest, "create_session"),
  "ListSessions": (ListSessionsRequest, "list_sessions"),
  "SubmitRequest": (SubmitRequestRequest, "submit_request"),
  "SubmitDecision": (SubmitDecisionRequest, "submit_decision"),
}

# Response types for each method (for type reference)
_RESPONSE_TYPES: dict[str, type[betterproto.Message]] = {
  "CreateSession": CreateSessionResponse,
  "ListSessions": ListSessionsResponse,
  "SubmitRequest": SubmitRequestResponse,
  "SubmitDecision": SubmitDecisionResponse,
}


async def grpc_web_handler(request: Request) -> Response:
  """Handle gRPC-Web requests by routing to SimulatorService methods.

  This endpoint intercepts POST requests to /adksim.v1.SimulatorService/*
  and translates them to direct method calls on the service.

  Args:
      request: The incoming Starlette request.

  Returns:
      The gRPC-Web formatted response.
  """
  # Extract the method name from the path
  # Path format: /adksim.v1.SimulatorService/MethodName
  path_parts = request.url.path.split("/")
  if len(path_parts) < 3:
    return Response(status_code=400, content="Invalid gRPC-Web path")

  method_name = path_parts[-1]

  if method_name not in _METHOD_MAP:
    logger.warning("Unknown gRPC method: %s", method_name)
    return Response(status_code=404, content=f"Unknown method: {method_name}")

  # Check content type to determine if base64 encoded
  content_type = request.headers.get("content-type", "")
  is_text = "grpc-web-text" in content_type

  # Get the service from app state
  service: SimulatorService = request.app.state.simulator_service

  try:
    # Read and decode the request body
    body = await request.body()
    message_bytes = _decode_grpc_web_payload(body, is_text)

    # Get request class and method name
    request_class, handler_name = _METHOD_MAP[method_name]

    # Parse the request message using betterproto
    request_message = request_class().parse(message_bytes)

    # Call the service method directly (in-memory, no loopback)
    handler = getattr(service, handler_name)
    response_message = await handler(request_message)

    # Encode and return the response
    response_bytes = _encode_grpc_web_response(response_message, is_text)

    return Response(
      content=response_bytes,
      media_type=_get_content_type(is_text),
      headers={
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "grpc-status,grpc-message",
      },
    )

  except Exception as e:
    logger.exception("Error handling gRPC-Web request: %s", e)
    # Return gRPC error status
    error_trailers = f"grpc-status:2\r\ngrpc-message:{e!s}\r\n".encode()
    error_frame = (
      bytes([0x80]) + struct.pack(">I", len(error_trailers)) + error_trailers
    )

    if is_text:
      error_frame = base64.b64encode(error_frame)

    return Response(
      content=error_frame,
      media_type=_get_content_type(is_text),
      headers={
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "grpc-status,grpc-message",
      },
    )


async def grpc_web_options(request: Request) -> Response:
  """Handle CORS preflight requests for gRPC-Web endpoints."""
  return Response(
    status_code=204,
    headers={
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-grpc-web, x-user-agent",
      "access-control-max-age": "86400",
    },
  )


async def spa_handler(request: Request) -> Response:
  """Serve static files or fall back to index.html for SPA routing.

  This handler checks if the requested path matches an actual file.
  If so, it serves that file. Otherwise, it serves index.html to
  allow Angular's client-side routing to handle the path.
  """
  path = request.path_params.get("path", "")

  # 1. Try to find the actual file (e.g., styles.css, main.js)
  if path:
    file_path = STATIC_DIR / path
    if file_path.exists() and file_path.is_file():
      return FileResponse(file_path)

  # 2. Fallback to index.html for everything else (e.g., /session/123)
  index_path = STATIC_DIR / "index.html"
  if index_path.exists():
    return FileResponse(index_path)

  return Response(status_code=404, content="Frontend not bundled")


def create_app(simulator_service: SimulatorService) -> Starlette:
  """Create the Starlette application with gRPC-Web gateway.

  Args:
      simulator_service: The SimulatorService instance to use for handling requests.

  Returns:
      Configured Starlette application.
  """
  routes: list[Route] = [
    # gRPC-Web endpoints - handle OPTIONS for CORS preflight
    Route(
      "/adksim.v1.SimulatorService/{method}",
      grpc_web_handler,
      methods=["POST"],
    ),
    Route(
      "/adksim.v1.SimulatorService/{method}",
      grpc_web_options,
      methods=["OPTIONS"],
    ),
  ]

  # SPA catch-all: serves static files or falls back to index.html
  # This handles both asset requests (main.js) and client-side routes (/session/123)
  if STATIC_DIR.exists():
    routes.append(Route("/{path:path}", spa_handler))
  else:
    routes.append(Route("/{path:path}", spa_handler))

  app = Starlette(routes=routes)

  # Store the service in app state for access in handlers
  app.state.simulator_service = simulator_service

  return app
