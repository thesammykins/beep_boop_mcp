# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a **Model Context Protocol (MCP) server** for coordinating work between multiple AI agents in shared codebases and monorepos. It uses a simple file-based signaling system with `beep` and `boop` files to prevent conflicts when agents work simultaneously.

**Core Purpose**: Prevent race conditions and merge conflicts in multi-agent AI collaborations by providing coordination primitives.

## Quick Start Commands

### Development
```bash
# Start development server with hot reload
npm run dev

# Build TypeScript to dist/
npm run build

# Start production server
npm start
```

### Configuration Management
```bash
# Interactive configuration selection
npm run config

# Environment-specific configs
npm run config:dev        # Development: 1hr timeout, debug logs, auto-cleanup
npm run config:prod       # Production: 24hr timeout, info logs, backups
npm run config:ci         # CI/CD: aggressive cleanup, minimal logging  
npm run config:enterprise # Team prefixes, notifications, compliance
```

### Testing the MCP Server
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Test MCP protocol
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

### Testing and Validation
```bash
# Run the test suite (build verification)
npm test

# Test webhook integrations (Discord/Slack notifications)
npm run test:webhooks

# TypeScript compilation check without output
npx tsc --noEmit

# Full build with type checking
npm run build
```

### Ingress/Listener Mode
```bash
# Start ingress server for Discord/Slack message capture
npm run listen

# Server starts on http://localhost:7077
# Requires environment variables for Discord/Slack integration:
# BEEP_BOOP_INGRESS_ENABLED=true
# BEEP_BOOP_INGRESS_PROVIDER=discord|slack
# BEEP_BOOP_DISCORD_BOT_TOKEN=xxx (for Discord)
# BEEP_BOOP_SLACK_APP_TOKEN=xapp-xxx (for Slack)
# BEEP_BOOP_SLACK_BOT_TOKEN=xoxb-xxx (for Slack)
```

## Architecture Overview

### MCP Server Pattern
- **Entry Point**: `src/index.ts` - Sets up MCP server with StdioServerTransport
- **Tool Registration**: Seven coordination tools registered via `McpServer.registerTool()`
- **Transport**: Uses stdio for MCP protocol communication (stdout/stdin)
- **Logging**: stderr only (to avoid interfering with MCP protocol)

### Core Components
```
src/
├── index.ts              # MCP server setup, tool registration, signal handling
├── tools.ts              # Tool handlers with Zod schema validation
├── file-operations.ts    # Atomic beep/boop file operations
├── config.ts             # Environment-based configuration system
├── types.ts              # TypeScript interfaces and error types
├── notification-service.ts # Discord/Slack webhook notifications
├── http-listener-client.ts # HTTP client for ingress server
└── ingress/              # Message capture and processing
    ├── index.ts          # Ingress server entry point
    ├── discord-listener.ts # Discord bot integration
    ├── slack-listener.ts # Slack bot integration
    └── inbox.ts          # Message storage and retrieval

root/
├── test-webhooks.ts      # Webhook integration testing script
├── .beep-boop-inbox/     # Message storage directory (auto-created)
│   ├── messages/         # Captured messages from Discord/Slack
│   └── processed/        # Acknowledged/processed messages
└── example-configs/      # Environment-specific configurations
    ├── select-config.sh  # Interactive config selection script
    ├── mcp-config.development.json
    ├── mcp-config.production.json
    ├── mcp-config.ci.json
    └── mcp-config.enterprise.json
```

### State Machine
The system operates on a simple state machine based on file existence:

```
NO_COORDINATION ──update_boop──> WORK_IN_PROGRESS
(no files)                       (boop exists)
       ∧                                │
       │                                ∨
WORK_ALLOWED <──────end_work────── (atomic operation)
(beep exists)
```

**Invalid State**: Both beep and boop files exist (requires manual cleanup)

## Core Beep/Boop Concepts

### File Types
- **`beep`** file: JSON format, signals work completion and directory clearance
- **`boop`** file: JSON format, signals active work by specific agent

### Essential Workflow
Every agent MUST follow this pattern:
1. **`check_status`** - Verify directory state before claiming
2. **`update_boop`** - Claim directory with unique agent ID  
3. **Do work** - Keep boop file while working
4. **`end_work`** - Atomically remove boop, create beep

### Work States
- **`WORK_ALLOWED`**: beep exists, safe to start new work
- **`WORK_IN_PROGRESS`**: boop exists, another agent working
- **`NO_COORDINATION`**: no files, directory unclaimed
- **`INVALID_STATE`**: both files exist, needs manual cleanup

### Stale File Detection
- Configurable age threshold (default 24 hours)
- `check_status` can auto-cleanup stale boop files
- Prevents abandoned work from blocking directories indefinitely

## Tool Reference

### `check_status(directory, maxAgeHours?, autoCleanStale?, newAgentId?, newWorkDescription?)`
- **Required**: `directory` path to check
- **Optional**: Stale cleanup with automatic claiming capability
- **Returns**: Current state, age info, next steps

### `update_boop(directory, agentId, workDescription?)`  
- **Agent ID Rules**: alphanumeric + hyphens/underscores/dots, max 100 chars
- **Validates**: Team prefixes if configured
- **Fails**: If another agent already working

### `end_work(directory, agentId, message?)`
- **Atomic Operation**: Removes boop, creates beep in single transaction
- **Validates**: Agent matches boop file owner
- **Recovery**: Attempts boop restoration if beep creation fails

### `create_beep(directory, message?)`
- **Manual Completion**: For when no boop file exists
- **Less Common**: Usually use `end_work` instead

### `update_user(messageId, updateContent)`
- **Ingress Integration**: Posts follow-up messages to captured Discord/Slack threads
- **Required**: `messageId` from captured message, `updateContent` text to send
- **Use Case**: Agent responses and status updates back to original communication channel
- **Delegation**: When `BEEP_BOOP_LISTENER_ENABLED=true`, delegates to centralized listener

### `initiate_conversation(platform, channelId?, content, agentId?)`
- **Proactive Communication**: Start new conversations on Discord/Slack
- **Required**: `platform` ("discord" | "slack"), `content` message text
- **Optional**: `channelId` (uses default if omitted), `agentId` for attribution
- **Features**: Auto-creates Discord threads, waits for user responses
- **Delegation**: When `BEEP_BOOP_LISTENER_ENABLED=true`, delegates to centralized listener

### `check_listener_status(includeConfig?)`
- **Monitoring**: Check health and connectivity of HTTP listener service
- **Optional**: `includeConfig` to include detailed configuration
- **Returns**: Configuration overview, connectivity tests, health status
- **Use Case**: Troubleshoot delegation issues and validate listener setup

## Ingress/Listener System

The ingress system captures messages from Discord and Slack, storing them for agent processing and enabling bi-directional communication.

### Message Capture Workflow
1. **Discord/Slack Bot** receives mention or message
2. **Message Storage** saves to `.beep-boop-inbox/messages/`
3. **HTTP API** provides access to captured messages
4. **Agent Processing** via MCP tools and `update_user` responses
5. **Message Acknowledgment** moves to `processed/` directory

### Environment Variables
**Required for Ingress:**
- `BEEP_BOOP_INGRESS_ENABLED=true` - Enable ingress server
- `BEEP_BOOP_INGRESS_PROVIDER=discord|slack` - Platform integration

**Discord Integration:**
- `BEEP_BOOP_DISCORD_BOT_TOKEN=xxx` - Bot token with required permissions
- Discord bot needs: Guild Messages, Message Content Intent

**Slack Integration:**
- `BEEP_BOOP_SLACK_APP_TOKEN=xapp-xxx` - Socket Mode app-level token
- `BEEP_BOOP_SLACK_BOT_TOKEN=xoxb-xxx` - Bot token with chat:write scope
- Slack app needs: app_mentions:read, chat:write permissions

**Optional Security:**
- `BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN=xxx` - Secure HTTP endpoints

### HTTP Endpoints (Port 7077)
```bash
# List captured messages
curl -H "Authorization: Bearer {{TOKEN}}" http://localhost:7077/messages

# Get specific message details  
curl -H "Authorization: Bearer {{TOKEN}}" http://localhost:7077/messages/<MESSAGE_ID>

# Acknowledge/process message
curl -X POST -H "Authorization: Bearer {{TOKEN}}" http://localhost:7077/messages/<MESSAGE_ID>/ack
```

### Directory Structure
```
.beep-boop-inbox/
├── messages/     # Incoming captured messages (JSON files)
└── processed/    # Acknowledged messages (moved after processing)
```

### Message Format
Captured messages are stored as JSON with metadata:
```json
{
  "id": "uuid-string",
  "platform": "discord" | "slack",
  "content": "message text",
  "author": "username",
  "channel": "channel-info",
  "timestamp": "ISO-8601",
  "replyContext": { /* platform-specific reply data */ }
}
```

### Integration Testing
See `docs/INGRESS.md` and `docs/SCOPES_INTENTS.md` for detailed setup instructions including:
- Discord bot permissions and intents configuration  
- Slack app Socket Mode setup and scopes
- End-to-end testing procedures
- Troubleshooting common integration issues

## Configuration System

### Environment Variables
The server supports 40+ configuration options via environment variables:

**Core Settings:**
- `BEEP_BOOP_DEFAULT_MAX_AGE_HOURS`: Stale file threshold (default: 24)
- `BEEP_BOOP_AUTO_CLEANUP_ENABLED`: Auto-remove stale files (default: false)
- `BEEP_BOOP_MAX_AGENT_ID_LENGTH`: Agent ID character limit (default: 100)

**Access Control:**
- `BEEP_BOOP_ALLOWED_DIRECTORIES`: Comma-separated allowed paths
- `BEEP_BOOP_BLOCKED_DIRECTORIES`: Comma-separated blocked paths  
- `BEEP_BOOP_REQUIRE_TEAM_PREFIX`: Enforce team-based agent naming
- `BEEP_BOOP_TEAM_PREFIXES`: Valid team prefixes

**Enterprise Features:**
- `BEEP_BOOP_BACKUP_ENABLED`: Backup coordination files
- `BEEP_BOOP_AUDIT_LOG_ENABLED`: Compliance logging
- `BEEP_BOOP_ENABLE_NOTIFICATIONS`: Webhook alerts

**Git Integration:**
- `BEEP_BOOP_MANAGE_GITIGNORE`: Auto-add beep/boop files to .gitignore (default: true)

### Pre-configured Environments
- **Development**: 1hr timeout, debug logs, auto-cleanup
- **Production**: 24hr timeout, backups, audit logs  
- **CI**: Aggressive cleanup, minimal logging
- **Enterprise**: Team validation, notifications, compliance

### Configuration Selection Script
The `./example-configs/select-config.sh` script provides an interactive way to switch between environment configurations:

**Interactive Mode:**
```bash
# Shows menu of available configurations
./example-configs/select-config.sh
```

**Direct Selection:**
```bash
# Apply specific environment directly
./example-configs/select-config.sh development
./example-configs/select-config.sh production
./example-configs/select-config.sh ci
./example-configs/select-config.sh enterprise
```

**How it works:**
- Copies environment-specific JSON config to `mcp-config.json`
- Shows key settings after applying (requires `jq` for detailed view)
- Validates environment names and provides helpful error messages
- Available configs: `mcp-config.{environment}.json` in `example-configs/`

## Development Workflow

### Local Development
```bash
# Use tsx for development (hot reload)
npm run dev

# Or build and run manually  
npm run build
node dist/index.js
```

### Publishing and CI/CD

**NPM Package Details:**
- Package name: `@thesammykins/beep-boop-mcp-server`
- Global installation: `npm install -g @thesammykins/beep-boop-mcp-server`
- Binary command: `beep-boop-mcp-server`

**Automated Publishing:**
- **GitHub Actions** automatically publishes to NPM when changes are pushed to `main` branch
- **Version Bumping** based on commit message keywords:
  - `BREAKING`/`major`: Major version (1.0.0 → 2.0.0)
  - `feat`/`feature`/`minor`: Minor version (1.0.0 → 1.1.0)  
  - Everything else: Patch version (1.0.0 → 1.0.1)

**Testing Workflow:**
- Feature branches: Tests run automatically via `.github/workflows/test.yml`
- Matrix testing on Node.js versions: 18.x, 20.x, 22.x
- TypeScript compilation checking with `tsc --noEmit`
- Build verification ensures `dist/` contains compiled outputs

### Agent ID Patterns
- **Good**: `claude-assistant-1`, `gpt4-refactor-bot`, `warp-doc-generator`
- **Bad**: `agent`, `ai`, `assistant` (too generic)

### Directory Granularity
- **Ideal**: `./src/auth-service/`, `./packages/ui-components/`
- **Too Fine**: `./src/utils/helper.ts` (individual files)
- **Too Broad**: `./` (entire project)

### Debugging
- Set `BEEP_BOOP_LOG_LEVEL=debug` for verbose output
- Check coordination files manually: `cat beep` or `cat boop`
- Logs go to stderr (MCP protocol uses stdout)

## Important Implementation Details

### Atomic Operations
- `endWorkAtomically()` uses transaction-like pattern: remove boop → create beep
- If beep creation fails, attempts to restore boop file
- Prevents invalid states during failures

### File Formats
**Beep file structure:**
```json
{
  "completedAt": "2024-08-20T10:30:00.000Z",
  "message": "Refactoring completed",
  "completedBy": "agent-id"
}
```

**Boop file structure:**
```json
{
  "startedAt": "2024-08-20T10:00:00.000Z", 
  "agentId": "agent-id",
  "workDescription": "Refactoring components"
}
```

### Error Handling
- **CoordinationError** class with specific error codes
- Graceful degradation for file system issues
- Agent mismatch validation prevents hijacking work
- Permission checking for directory access

### Concurrent Operations
- `maxConcurrentOperations` limits parallel file operations
- File system operations use `fs.promises` for async handling
- Race condition protection via file existence checks

### Enterprise Features
- Team prefix validation for agent IDs
- Directory whitelist/blacklist enforcement
- Backup coordination files to configured directory
- Audit logging for compliance requirements
- Webhook notifications for critical events

### Git Integration
- **Automatic .gitignore Management**: When creating beep/boop files, automatically adds them to `.gitignore`
- **Prevents Repository Pollution**: Coordination files are temporary and shouldn't be committed
- **Smart Detection**: Only adds entries if they don't already exist
- **Graceful Fallback**: Logs errors but doesn't fail operations if .gitignore update fails
- **Configurable**: Use `BEEP_BOOP_MANAGE_GITIGNORE=false` to disable

### Webhook Testing
The `test-webhooks.ts` script provides comprehensive testing for Discord/Slack webhook integrations:

**Four Notification Types Tested:**
- `WORK_STARTED`: Agent begins work in directory
- `WORK_COMPLETED`: Agent finishes work successfully 
- `STALE_DETECTED`: Boop file exceeds age threshold
- `CLEANUP_PERFORMED`: Stale cleanup with new agent claim

**Required Environment Variables:**
- `BEEP_BOOP_ENABLE_NOTIFICATIONS=true` - Enable webhook system
- `BEEP_BOOP_DISCORD_WEBHOOK_URL=https://...` - Discord webhook endpoint
- `BEEP_BOOP_SLACK_WEBHOOK_URL=https://...` - Slack webhook endpoint
- `BEEP_BOOP_NOTIFICATION_SERVICE=discord|slack|both` - Target service

**NotificationManager Architecture:**
- **Payload Creation**: `NotificationManager.createPayload()` formats messages
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Error Handling**: Graceful degradation when webhooks fail
- **Service Selection**: Send to specific platform or both simultaneously

**Testing Workflow:**
```bash
# Set webhook URLs (avoid inline secrets)
export BEEP_BOOP_DISCORD_WEBHOOK_URL="your-webhook-url"
export BEEP_BOOP_SLACK_WEBHOOK_URL="your-webhook-url"
export BEEP_BOOP_ENABLE_NOTIFICATIONS=true

# Run comprehensive webhook tests
npm run test:webhooks

# Test includes both valid notifications and error handling
```

**Payload Structure:**
Notifications include rich metadata for context:
- Agent ID and work description
- Directory and timestamp information  
- Duration metrics for completed work
- Stale file age and cleanup details
- Platform-specific formatting (embeds for Discord, blocks for Slack)

