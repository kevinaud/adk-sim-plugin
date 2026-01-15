/**
 * @fileoverview Standalone seed script for the 'populated' backend.
 *
 * Creates a fixed set of sessions in the 'populated' backend for
 * stable visual regression tests. This script is run once during
 * CI setup after the backend containers are started.
 *
 * This file is SELF-CONTAINED and does not import from other local files
 * to avoid workspace package resolution issues when run via `npx tsx`.
 *
 * Usage:
 *   npx tsx frontend/tests/e2e/utils/seed-populated-backend.ts
 */

// Backend URL for the 'populated' backend (hardcoded to avoid imports)
const POPULATED_BACKEND_URL = 'http://127.0.0.1:8082';

/**
 * Fixed session descriptions for the populated backend.
 * Keep these stable for consistent visual tests.
 */
const SEED_SESSIONS = [
  'Weather Assistant Demo',
  'Code Review Agent',
  'Customer Support Bot',
  'Data Analysis Pipeline',
  'Documentation Generator',
];

/**
 * Seed the 'populated' backend with fixed sessions.
 *
 * This function is idempotent - it checks if sessions already exist
 * before creating new ones to avoid duplicates on repeated runs.
 *
 * @returns Number of sessions created (0 if already seeded)
 */
export async function seedPopulatedBackend(): Promise<number> {
  // First check if backend already has sessions
  const existingCount = await getSessionCount(POPULATED_BACKEND_URL);
  if (existingCount >= SEED_SESSIONS.length) {
    console.log(
      `Populated backend already has ${String(existingCount)} sessions, skipping seed`,
    );
    return 0;
  }

  console.log(`Seeding populated backend at ${POPULATED_BACKEND_URL}...`);

  let created = 0;
  for (const description of SEED_SESSIONS) {
    try {
      await createSession(POPULATED_BACKEND_URL, description);
      created++;
    } catch (error) {
      console.error(`Failed to create session '${description}':`, error);
    }
  }

  console.log(`Created ${String(created)} sessions on populated backend`);
  return created;
}

/**
 * Get the number of sessions in a backend.
 */
async function getSessionCount(backendUrl: string): Promise<number> {
  try {
    const url = `${backendUrl}/adksim.v1.SimulatorService/ListSessions`;
    const requestBody = encodeGrpcWebRequest(new Uint8Array(0)); // Empty request

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web-text',
      },
      body: requestBody,
    });

    if (!response.ok) {
      return 0;
    }

    const responseText = await response.text();
    const responseBytes = decodeGrpcWebResponse(responseText);

    // Count session entries in the response
    // Each session is a length-delimited field (tag 10 = field 1, wire type 2)
    let count = 0;
    let offset = 0;
    while (offset < responseBytes.length) {
      const tag = responseBytes[offset];
      if (tag === undefined) break;
      offset++;

      const wireType = tag & 0x07;
      if (wireType === 2) {
        const length = responseBytes[offset];
        if (length === undefined) break;
        offset++;
        offset += length;
        count++;
      } else if (wireType === 0) {
        while (offset < responseBytes.length) {
          const b = responseBytes[offset];
          if (b === undefined || (b & 0x80) === 0) break;
          offset++;
        }
        offset++;
      }
    }

    return count;
  } catch {
    return 0;
  }
}

/**
 * Create a session on a backend.
 */
async function createSession(backendUrl: string, description: string): Promise<void> {
  const url = `${backendUrl}/adksim.v1.SimulatorService/CreateSession`;

  const descBytes = new TextEncoder().encode(description);
  const requestBytes = new Uint8Array(2 + descBytes.length);
  requestBytes[0] = 10; // Field 1, wire type 2
  requestBytes[1] = descBytes.length;
  requestBytes.set(descBytes, 2);

  const requestBody = encodeGrpcWebRequest(requestBytes);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web-text',
    },
    body: requestBody,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create session: ${String(response.status)} ${text}`);
  }
}

/**
 * Encode a gRPC-Web request payload (base64 text format).
 */
function encodeGrpcWebRequest(messageBytes: Uint8Array): string {
  const frame = new Uint8Array(5 + messageBytes.length);
  frame[0] = 0;
  const length = messageBytes.length;
  frame[1] = (length >> 24) & 0xff;
  frame[2] = (length >> 16) & 0xff;
  frame[3] = (length >> 8) & 0xff;
  frame[4] = length & 0xff;
  frame.set(messageBytes, 5);
  return btoa(String.fromCharCode(...frame));
}

/**
 * Decode a gRPC-Web response payload (base64 text format).
 */
function decodeGrpcWebResponse(base64Response: string): Uint8Array {
  const binary = atob(base64Response);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (bytes.length < 5) {
    return new Uint8Array(0);
  }
  const messageLength = (bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | bytes[4];
  return bytes.slice(5, 5 + messageLength);
}

// Run directly if executed as a script
const scriptPath = process.argv[1];
if (scriptPath && import.meta.url === `file://${scriptPath}`) {
  seedPopulatedBackend()
    .then((count) => {
      console.log(`Seed complete: ${String(count)} sessions created`);
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
