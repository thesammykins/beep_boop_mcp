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

## HTTP API

- GET /messages
  - Returns: { ids: string[] }
- GET /messages/:id
  - Returns the normalized captured message
- POST /messages/:id/ack
  - Moves the message to the processed folder and returns { ok: boolean }

If BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN is set, include header:
- Authorization: Bearer <token>

## MCP tool: update_user

Use this to post follow-up updates back to the original platform/thread.

When BEEP_BOOP_LISTENER_ENABLED=true, update_user is delegated to the central HTTP listener and the MCP server waits synchronously for the listener response before returning. Otherwise it falls back to posting directly to Slack/Discord.

Input:
- messageId (string) – ID returned by the ingress capture
- updateContent (string) – the message text to send

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

