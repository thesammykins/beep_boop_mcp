# Synchronous HTTP Listener Delegation

This document describes how the MCP server can delegate certain tool calls to a central HTTP listener and wait for the response before returning to the client.

## Overview

When `BEEP_BOOP_LISTENER_ENABLED=true`, the MCP server will make a synchronous HTTP POST to the configured listener for these tools:
- `check_status` → POST ${BEEP_BOOP_LISTENER_BASE_URL}/mcp/check_status
- `update_user` → POST ${BEEP_BOOP_LISTENER_BASE_URL}/mcp/update_user

On success (HTTP 2xx), the listener's response is returned to the MCP client. On failure (HTTP 4xx/5xx) or timeout, a clear error is returned.

If the listener is disabled, existing local behavior is used as a fallback.

## Configuration

- BEEP_BOOP_LISTENER_ENABLED=true|false (default: false)
- BEEP_BOOP_LISTENER_BASE_URL=https://listener.example.com
- BEEP_BOOP_LISTENER_AUTH_TOKEN=... (optional, used as Bearer token)
- BEEP_BOOP_LISTENER_TIMEOUT_BASE_MS=10000 (default)
- BEEP_BOOP_LISTENER_TIMEOUT_PER_CHAR_MS=5 (adaptive, default)
- BEEP_BOOP_LISTENER_TIMEOUT_MAX_MS=60000 (cap, default)
- BEEP_BOOP_MAX_CONCURRENT_LISTENER_REQUESTS=25 (default)

Adaptive timeout is computed as: base + (payloadLength * perCharMs), bounded by max.

## Request/Response Contracts

- check_status request body:
  { directory, maxAgeHours?, autoCleanStale?, newAgentId?, newWorkDescription? }

  Expected success response (example):
  { text: "...human readable summary...", meta?: {...} }

- update_user request body:
  { messageId, updateContent }

  Expected success response (example):
  { text: "✅ Update sent for message <id>", meta?: { platformMessageId?: string } }

On non-2xx, respond with:
{ error: "<message>" }

## Concurrency

The MCP server uses an internal semaphore to limit concurrent listener requests (default 25). Other MCP operations remain non-blocking.

## Fallback

If the listener is disabled or returns an error, the server preserves existing behavior:
- check_status: Compute status locally
- update_user: Post directly to Slack/Discord using configured tokens

## Notes

- Prefer using the same listener for all delegated calls when enabled, to keep conversation context centralized.
- The listener should correlate requests by message/thread IDs to support multi-agent collaboration.

