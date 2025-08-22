# Synchronous Listener Integration (MCP real-time coordination)

This change introduces a central HTTP listener delegation for selected MCP tools to support real-time collaboration and back-and-forth communication. When enabled, the MCP server will POST to the listener and block until it receives a response or times out.

What changed
- New config (opt-in):
  - BEEP_BOOP_LISTENER_ENABLED=true|false
  - BEEP_BOOP_LISTENER_BASE_URL
  - BEEP_BOOP_LISTENER_AUTH_TOKEN (optional, sent as Bearer)
  - BEEP_BOOP_LISTENER_TIMEOUT_BASE_MS (default 10000)
  - BEEP_BOOP_LISTENER_TIMEOUT_PER_CHAR_MS (default 5)
  - BEEP_BOOP_LISTENER_TIMEOUT_MAX_MS (default 60000)
  - BEEP_BOOP_MAX_CONCURRENT_LISTENER_REQUESTS (default 25)
- New module: src/http-listener-client.ts
  - Adaptive timeouts (base + perChar, capped by max)
  - Concurrency limit via semaphore
  - Correlation via X-Beep-Boop-Request-Id header and requestId in body
- Tool updates:
  - check_status: delegates to POST /mcp/check_status when listener enabled; otherwise local behavior
  - update_user: delegates to POST /mcp/update_user when listener enabled; otherwise posts directly to Slack/Discord
- Docs:
  - docs/LISTENER.md (how to configure and contracts)
  - docs/INGRESS.md updated for delegated update_user behavior
- Fix: src/ingress/inbox.ts method updateThreadId moved inside class

Listener expectations
- Endpoints:
  - POST /mcp/check_status { directory, maxAgeHours?, autoCleanStale?, newAgentId?, newWorkDescription?, requestId }
  - POST /mcp/update_user { messageId, updateContent, requestId }
- Response on success (2xx): { text: string, meta?: object }
- Response on error (4xx/5xx): { error: string }

Fallback
- If the listener is disabled or fails, the server preserves previous behavior.

Next steps
- Point BEEP_BOOP_LISTENER_BASE_URL to your listener (can be the existing local ingress HTTP server if you add these new endpoints there).
- Optionally remove old generic notification webhook usage once all operations are delegated via the listener.

