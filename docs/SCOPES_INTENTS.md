# Scopes & Intents for Ingress

This document summarizes the minimum recommended scopes (Slack) and intents (Discord) required by the ingress listeners.

Always verify with the official docs. Adjust as your workspace/server policies require.

## Slack (Socket Mode)

- Use Socket Mode (no public HTTP required)
- App-level token:
  - BEEP_BOOP_SLACK_APP_TOKEN = xapp-…
  - Required scope: `connections:write`
- Bot token:
  - BEEP_BOOP_SLACK_BOT_TOKEN = xoxb-…
  - Required scopes (baseline):
    - `app_mentions:read` (receive app_mention events)
    - `chat:write` (post ack and updates)
  - Optional scopes (if you also want to capture non-mention messages via regex fallback):
    - `channels:history` (public channels)
    - `groups:history` (private channels your bot is in)
    - `im:history` (IMs)
    - `mpim:history` (multi-party IMs)

Slack Events Subscriptions:
- Event type: `app_mention`
- Socket Mode enabled in app settings

References (fetch latest via context7 when needed):
- Bolt JS (Socket Mode), scopes, events, message formatting.

## Discord (Gateway)

- BEEP_BOOP_DISCORD_BOT_TOKEN = …
- Intents (enable in Developer Portal and in code):
  - `Guilds`
  - `Guild Messages`
  - `Message Content` (required to read message text and detect mentions)

Bot permissions:
- Send Messages (to reply/ack)
- Read Message History (for context if needed)

Notes:
- The listener checks if the bot is mentioned and replies with an ack.
- For follow-ups, use the `update_user` MCP tool which posts into the same channel/thread.

References (fetch latest via context7 when needed):
- discord.js gateway intents and message content.

