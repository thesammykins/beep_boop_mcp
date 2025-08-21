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
- BEEP_BOOP_INGRESS_INBOX_DIR=./.beep-boop-inbox
- BEEP_BOOP_INGRESS_HTTP_ENABLED=true
- BEEP_BOOP_INGRESS_HTTP_PORT=7077
- BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN=<optional bearer token>

Slack (Socket Mode):
- BEEP_BOOP_SLACK_APP_TOKEN=xapp-...
- BEEP_BOOP_SLACK_BOT_TOKEN=xoxb-...

Discord:
- BEEP_BOOP_DISCORD_BOT_TOKEN=...

## Running the listener

Development:
- npm run listen

The listener will:
- Start Slack Socket Mode or Discord gateway (based on provider)
- Start local HTTP endpoint: http://localhost:${BEEP_BOOP_INGRESS_HTTP_PORT}

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

