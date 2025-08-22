# Ingress Listener (Slack/Discord) and Local Endpoint

This feature allows users to mention a bot in Slack or Discord, captures what was said, and exposes it locally for other services to fetch and act upon.

- One provider active at a time (Slack or Discord), configurable.
- Uses a file-based inbox (default: `.beep-boop-inbox/`) to persist captured messages.
- Provides a lightweight local HTTP endpoint for listing/reading/acking captured messages.
- Adds an MCP tool `update_user` to send follow-up updates to the original thread/user.

## Configuration (via MCP JSON configuration / environment)

Set these environment variables or define them in your MCP client config (preferred):

Core:
- BEEP_BOOP_INGRESS_ENABLED=true
- BEEP_BOOP_INGRESS_PROVIDER=slack | discord
- BEEP_BOOP_INGRESS_INBOX_DIR=$HOME/.beep-boop-inbox (default)
- BEEP_BOOP_INGRESS_HTTP_ENABLED=true
- BEEP_BOOP_INGRESS_HTTP_PORT=7077
- BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN=<optional bearer token>

Slack (Socket Mode):
- BEEP_BOOP_SLACK_APP_TOKEN=xapp-...
- BEEP_BOOP_SLACK_BOT_TOKEN=xoxb-...

Discord:
- BEEP_BOOP_DISCORD_BOT_TOKEN=...
- BEEP_BOOP_DISCORD_DEFAULT_CHANNEL_ID=... (optional - for proactive agent messaging)

## Where to get tokens (Slack/Discord)

Follow these steps to obtain the required tokens for the listener. Never commit tokens to source control.

### Slack (Socket Mode)

1) Create a Slack App
- Go to https://api.slack.com/apps and click “Create New App” → “From scratch”.
- Give it a name and select your workspace.

2) Enable Socket Mode and create an App-Level Token
- In your app’s settings, go to “Socket Mode” → toggle On.
- Go to “Basic Information” → “App-Level Tokens” → “Generate Token and Scopes”.
- Add scope: `connections:write`.
- Copy the generated token (starts with `xapp-...`). Store it as BEEP_BOOP_SLACK_APP_TOKEN.

3) Add Bot Token Scopes and Install the App
- Go to “OAuth & Permissions”.
- Under “Scopes” → “Bot Token Scopes”, add at minimum:
  - `app_mentions:read` (receive app_mention events)
  - `chat:write` (send messages/acks)
- Optional scopes if you want to capture non-mention messages via regex fallback:
  - `channels:history`, `groups:history`, `im:history`, `mpim:history`
- Click “Install App to Workspace”. Copy the Bot User OAuth Token (starts with `xoxb-...`). Store it as BEEP_BOOP_SLACK_BOT_TOKEN.

4) Subscribe to Events (for mentions)
- With Socket Mode, go to “Event Subscriptions” → toggle On.
- In “Subscribe to bot events”, add: `app_mention`.
- Save changes.

5) Invite the bot and test
- Invite the bot to the channels you want it to monitor.
- Mention the bot with @YourBotName in a channel.

### Discord (Gateway)

1) Create a Discord Application and Bot
- Go to https://discord.com/developers/applications → “New Application”.
- Open your application → “Bot” → “Add Bot”.

2) Copy Bot Token and enable intents
- On the “Bot” page, click “Reset Token” (if needed) and copy it. Store as BEEP_BOOP_DISCORD_BOT_TOKEN.
- Enable “Privileged Gateway Intents”: turn ON “Message Content”. Ensure “Server Members Intent” is not required for this feature.

3) Invite the bot to your server
- Go to “OAuth2” → “URL Generator”.
- Scopes: check “bot”.
- Bot Permissions (required for threads):
  - View Channels (a.k.a. Read Messages/View Channels)
  - Send Messages
  - Read Message History
  - Create Public Threads
  - Send Messages in Threads
  - (Optional) Create Private Threads — only if you plan to create private threads
- Copy the generated URL, open it in a browser, select your server, and authorize.

4) Test
- In your server, mention the bot with @YourBotName. You should get an immediate ack once the listener is running with a valid token and intents.

### Local HTTP bearer token (optional)

You can secure the local HTTP endpoint with a bearer token (recommended). Generate a token and assign it to an env var without printing it:

- Generate and export securely (example):
  1) Generate in a subshell and store as an env var
  ```bash
  # macOS / Linux example (creates a 32-byte hex token)
  API_TOKEN=$(openssl rand -hex 32)
  export BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN=$API_TOKEN
  unset API_TOKEN
  ```

- Use the token in requests:
  ```bash
  curl -H "Authorization: Bearer ${BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN}" http://localhost:7077/messages
  ```

If you prefer a secrets manager (e.g., 1Password), store the token there and load it into an environment variable before starting the listener.

## Running the listener

Development:
- npm run listen

The listener will:
- Start Slack Socket Mode or Discord gateway (based on provider)
- Start local HTTP endpoint: http://localhost:${BEEP_BOOP_INGRESS_HTTP_PORT}

Auto-start with MCP server:
- By default, when you start the MCP server, the ingress sidecar is started automatically.
- Control with `BEEP_BOOP_START_INGRESS_WITH_SERVER` (set to "false" to disable).

## Centralized Listener Delegation

The system supports a **centralized listener mode** where multiple MCP servers can delegate certain tool operations to a single HTTP listener service. This enables:

- **Shared Discord/Slack connections** across multiple agents
- **Centralized message handling** and response coordination
- **Reduced resource usage** (single bot connection per platform)
- **Better scalability** for multi-agent systems

### Configuration for Delegation

Add these environment variables to enable delegation:

```bash
# Enable centralized listener delegation
BEEP_BOOP_LISTENER_ENABLED=true
BEEP_BOOP_LISTENER_BASE_URL=http://localhost:7077
BEEP_BOOP_LISTENER_AUTH_TOKEN=your-shared-auth-token

# Optional: Configure timeouts and concurrency
BEEP_BOOP_LISTENER_TIMEOUT_BASE_MS=10000
BEEP_BOOP_LISTENER_TIMEOUT_MAX_MS=60000
BEEP_BOOP_MAX_CONCURRENT_LISTENER_REQUESTS=25
```

### How Delegation Works

1. **MCP Tool Called**: Agent calls `update_user`, `initiate_conversation`, or `check_status`
2. **Delegation Check**: If `BEEP_BOOP_LISTENER_ENABLED=true`, delegate to HTTP listener
3. **HTTP Request**: MCP server sends POST request to listener's `/mcp/` endpoints
4. **Processing**: Listener processes request using its Discord/Slack connections
5. **Response**: Listener returns results synchronously to MCP server
6. **Fallback**: If delegation fails, MCP server attempts local processing

### Adaptive Timeouts

The HTTP client uses adaptive timeouts based on request payload size:
- **Base timeout**: `BEEP_BOOP_LISTENER_TIMEOUT_BASE_MS` (default: 10 seconds)
- **Per-character timeout**: `BEEP_BOOP_LISTENER_TIMEOUT_PER_CHAR_MS` (default: 5ms per character)
- **Maximum timeout**: `BEEP_BOOP_LISTENER_TIMEOUT_MAX_MS` (default: 60 seconds)

This ensures small requests complete quickly while allowing larger requests more time.

## HTTP API

### Standard Ingress Endpoints
- GET /messages
  - Returns: { ids: string[] }
- GET /messages/:id
  - Returns the normalized captured message
- POST /messages/:id/ack
  - Moves the message to the processed folder and returns { ok: boolean }

### MCP Delegation Endpoints
These endpoints allow MCP servers to delegate tool calls to the centralized listener:

- POST /mcp/check_status
  - Input: { directory, maxAgeHours?, autoCleanStale?, newAgentId?, newWorkDescription? }
  - Returns: Detailed status check with optional stale cleanup
- POST /mcp/update_user
  - Input: { messageId, updateContent }
  - Returns: Success confirmation for message posting
- POST /mcp/initiate_conversation
  - Input: { platform, channelId?, content, agentId? }
  - Returns: Conversation details with potential user response

### Authentication
If BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN is set, include header for all requests:
- Authorization: Bearer <token>

### Request/Response Format
All POST requests expect JSON body with optional `requestId` field for tracing:
```json
{
  "directory": "./src/components",
  "requestId": "uuid-generated-by-client"
}
```

Responses include either:
- Success: `{ text: "response message", meta?: { ... } }`
- Error: `{ error: "error description" }`

## MCP tools: update_user and initiate_conversation

### update_user
Post follow-up updates back to the original platform/thread.

**Delegation Behavior:**
- When `BEEP_BOOP_LISTENER_ENABLED=true`, this tool delegates to the central HTTP listener and waits synchronously for the response.
- When listener delegation is disabled, falls back to direct platform posting.

**Input:**
- messageId (string) – ID returned by the ingress capture
- updateContent (string) – the message text to send

### initiate_conversation
Proactively start new conversations on Discord or Slack.

**Delegation Behavior:**
- When `BEEP_BOOP_LISTENER_ENABLED=true`, this tool delegates to the central HTTP listener for better coordination.
- Automatically creates Discord threads for interactive conversations.
- Waits for user responses with configurable timeout periods.
- Uses Discord API retry logic with exponential backoff for reliability.

**Input:**
- platform ("discord" | "slack") – Target platform
- channelId (string, optional) – Channel ID (uses default if omitted)
- content (string) – Initial message content
- agentId (string, optional) – Agent ID for attribution

**Conversation Flow Configuration:**
- `BEEP_BOOP_CONVERSATION_TIMEOUT_MINUTES` (default: 5) – How long to wait for user responses
- `BEEP_BOOP_CONVERSATION_POLL_INTERVAL_MS` (default: 2000) – How often to check for responses

**Discord API Reliability Configuration:**
- `BEEP_BOOP_DISCORD_API_RETRY_ATTEMPTS` (default: 3) – Retry attempts for API failures
- `BEEP_BOOP_DISCORD_API_RETRY_BASE_DELAY_MS` (default: 1000) – Base retry delay with exponential backoff
- `BEEP_BOOP_DISCORD_API_TIMEOUT_MS` (default: 30000) – Individual API call timeout

### check_listener_status
Monitor the health and connectivity of the centralized HTTP listener.

**Input:**
- includeConfig (boolean, optional) – Whether to include detailed configuration info

**Output:**
- Configuration overview (enabled/disabled, URLs, timeouts)
- Connectivity test results (health check, MCP endpoint verification)
- Detailed configuration when requested

## Slack/Discord setup notes

Slack:
- Use Socket Mode (no public URL needed)
- Subscribe to `app_mention` events
- Scopes typically required: `app_mentions:read`, `channels:history`, `chat:write`

Discord:
- Enable intents: Guilds, Guild Messages, Message Content
- Invite the bot to your server with appropriate permissions

## Security
- No secrets are committed; configure via MCP JSON configuration or your secret manager of choice.
- Local HTTP can be protected with a bearer token.
- Inbox directory is added to .gitignore automatically.

