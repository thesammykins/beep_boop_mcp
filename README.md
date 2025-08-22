# 🤖👈 Beep/Boop 👉🤖 MCP Server

A Model Context Protocol (MCP) server for coordinating work between multiple AI agents in monorepos and shared codebases using a simple file-based signaling system.

## 🎯 Overview

The Beep/Boop coordination system prevents conflicts when multiple AI agents work in the same codebase by using two simple file types:

- **`beep`** - Signals work is complete and directory is clear for new work
- **`boop`** - Signals work is in progress by a specific agent

This prevents race conditions, merge conflicts, and ensures orderly collaboration between agents.

## 📦 Installation

### From NPM (Recommended)
```bash
npm install -g @thesammykins/beep-boop-mcp-server
```

> **Note**: Package is automatically published via GitHub Actions when changes are pushed to main.

### From Source
```bash
git clone https://github.com/thesammykins/beep_boop_mcp.git
cd beep_boop_mcp
npm install
npm run build
```

## 🚀 Quick Start

### 1. Start the MCP Server

#### For NPM Installation
The server starts automatically when called by your MCP client. No manual startup required.

#### For Source Installation
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

### 2. Configure Your MCP Client

Add to your MCP client configuration (e.g., Claude Desktop):

#### For Global NPM Installation
```json
{
  "mcpServers": {
    "beep-boop-coordination": {
      "command": "beep-boop-mcp-server"
    }
  }
}
```

#### For NPX (No Installation Required)
```json
{
  "mcpServers": {
    "beep-boop-coordination": {
      "command": "npx",
      "args": ["-y", "@thesammykins/beep-boop-mcp-server"]
    }
  }
}
```

#### For Source Installation
```json
{
  "mcpServers": {
    "beep-boop-coordination": {
      "command": "node",
      "args": ["/path/to/beep-boop-mcp-server/dist/index.js"]
    }
  }
}
```

### 3. Use in Your AI Agent Workflows

```typescript
// Always check before starting work
const status = await mcpClient.callTool('check_status', {
  directory: './src/components'
});

// Claim the directory
await mcpClient.callTool('update_boop', {
  directory: './src/components',
  agentId: 'my-agent-id',
  workDescription: 'Refactoring components'
});

// Do your work...

// Signal completion
await mcpClient.callTool('end_work', {
  directory: './src/components',
  agentId: 'my-agent-id',
  message: 'Refactoring complete'
});
```

## 🔧 API Reference

### Tools

#### `check_status`
Checks the current coordination status of a directory with optional stale file cleanup.

**Parameters:**
- `directory` (string): Path to directory to check
- `maxAgeHours` (number, optional): Maximum age in hours before boop files are considered stale (default: 24)
- `autoCleanStale` (boolean, optional): Whether to automatically clean up stale boop files (default: false)
- `newAgentId` (string, optional): Agent ID to use when claiming after stale cleanup
- `newWorkDescription` (string, optional): Work description when claiming after cleanup

**Returns:**
- Detailed status including file existence, agent info, age information, and next steps
- Automatic cleanup of stale files when requested

**Examples:**

*Basic status check:*
```json
{
  "directory": "./src/auth"
}
```

*Check with automatic stale cleanup and claim:*
```json
{
  "directory": "./src/auth",
  "maxAgeHours": 8,
  "autoCleanStale": true,
  "newAgentId": "claude-assistant-2",
  "newWorkDescription": "Continuing work after stale cleanup"
}
```

#### `update_boop`
Claims a directory for work by creating/updating a boop file.

**Parameters:**
- `directory` (string): Directory to claim
- `agentId` (string): Your unique agent identifier  
- `workDescription` (string, optional): Description of planned work

**Returns:**
- Success confirmation or conflict warning

#### `end_work`
Atomically completes work by removing boop file and creating beep file.

**Parameters:**
- `directory` (string): Directory where work was completed
- `agentId` (string): Agent identifier that did the work
- `message` (string, optional): Completion message

**Returns:**
- Confirmation of successful work completion

#### `create_beep`
Manually creates a beep file to signal work completion.

**Parameters:**
- `directory` (string): Directory to mark as complete
- `message` (string, optional): Completion message

**Returns:**
- Confirmation beep file was created

#### `update_user`
Posts follow-up messages to captured Discord/Slack threads for bidirectional communication.

**Parameters:**
- `messageId` (string): ID of the captured message to respond to
- `updateContent` (string): Message content to send as an update

**Returns:**
- Confirmation that the update was posted to the original platform

**Use Cases:**
- Agent progress reports back to original Discord/Slack thread
- Status updates during long-running tasks
- Error notifications and recovery updates
- Task completion confirmations

#### `initiate_conversation`
Proactively starts new conversations on Discord or Slack, enabling agents to notify users about work status, errors, or completion.

**Parameters:**
- `platform` ("discord" | "slack"): Target platform for the conversation
- `channelId` (string, optional): Channel ID to send message to (uses default if omitted)
- `content` (string): Initial message content to send
- `agentId` (string, optional): Agent ID for attribution

**Returns:**
- Conversation details including message ID for follow-up updates
- User response details if a reply is received within timeout period
- Timeout notification if no user response within configured time limit

**Conversation Flow Configuration:**
- `BEEP_BOOP_CONVERSATION_TIMEOUT_MINUTES` (default: 5) – How long to wait for user responses
- `BEEP_BOOP_CONVERSATION_POLL_INTERVAL_MS` (default: 2000) – How often to check for responses
- `BEEP_BOOP_DISCORD_API_RETRY_ATTEMPTS` (default: 3) – Retry attempts for Discord API failures
- `BEEP_BOOP_DISCORD_API_RETRY_BASE_DELAY_MS` (default: 1000) – Base retry delay with exponential backoff
- `BEEP_BOOP_DISCORD_API_TIMEOUT_MS` (default: 30000) – Individual Discord API call timeout

**Use Cases:**
- Notify users about completed background work
- Alert about system issues or failures discovered during routine checks
- Report completion of scheduled tasks or maintenance
- Send proactive status updates for long-running processes
- Alert users when manual intervention is needed

#### `check_listener_status`
Monitors the health and connectivity of the HTTP listener service used for centralized tool delegation.

**Parameters:**
- `includeConfig` (boolean, optional): Whether to include detailed configuration info

**Returns:**
- Configuration overview (enabled/disabled status, URLs, timeouts)
- Connectivity test results (health check, MCP endpoint verification)  
- Optional detailed configuration when requested

**Use Cases:**
- Verify ingress service connectivity before delegation
- Troubleshoot communication issues with centralized listener
- Debug listener configuration problems
- Health checks for distributed agent systems
- Validate webhook and bot token configuration

## 📡 Ingress/Listener System

The Beep/Boop MCP Server includes a powerful ingress system that captures messages from Discord and Slack, enabling bidirectional communication between AI agents and users.

### Message Capture Workflow
1. **Discord/Slack Bot** receives mentions or messages in configured channels
2. **Message Storage** saves captured messages to `.beep-boop-inbox/messages/`
3. **HTTP API** provides programmatic access to captured messages (port 7077)
4. **Agent Processing** handles messages via MCP tools and posts updates using `update_user`
5. **Message Acknowledgment** moves processed messages to `processed/` directory

### Quick Setup

#### Start Ingress Server
```bash
# Start the ingress listener
npm run listen

# Server will start on http://localhost:7077
```

#### Required Environment Variables
**For Discord Integration:**
```bash
BEEP_BOOP_INGRESS_ENABLED=true
BEEP_BOOP_INGRESS_PROVIDER=discord
BEEP_BOOP_DISCORD_BOT_TOKEN=your_discord_bot_token
BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN=your_auth_token  # Optional but recommended
```

**For Slack Integration:**
```bash
BEEP_BOOP_INGRESS_ENABLED=true
BEEP_BOOP_INGRESS_PROVIDER=slack
BEEP_BOOP_SLACK_APP_TOKEN=xapp-your_app_token      # Socket Mode required
BEEP_BOOP_SLACK_BOT_TOKEN=xoxb-your_bot_token      # Bot token with proper scopes
BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN=your_auth_token  # Optional but recommended
```

### HTTP API Endpoints

Once the ingress server is running on port 7077, you can interact with captured messages:

```bash
# List all captured messages
curl -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     http://localhost:7077/messages

# Get specific message details
curl -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     http://localhost:7077/messages/MESSAGE_ID

# Acknowledge/process a message (moves to processed/)
curl -X POST -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     http://localhost:7077/messages/MESSAGE_ID/ack
```

### Message Format

Captured messages are stored as JSON with rich metadata:
```json
{
  "id": "uuid-string",
  "platform": "discord" | "slack",
  "content": "@bot-name please help me deploy the application",
  "author": "username",
  "channel": {
    "id": "channel_id",
    "name": "general"
  },
  "timestamp": "2024-08-20T10:30:00.000Z",
  "replyContext": {
    // Platform-specific reply information for update_user
  }
}
```

### Integration with Coordination

The ingress system works seamlessly with beep/boop coordination:

```typescript
// Agent receives Discord/Slack message asking for deployment
const message = await getMessageFromInbox(messageId);

// Check if deployment directory is available
const status = await mcpClient.callTool('check_status', {
  directory: './deploy'
});

if (status.includes('WORK_IN_PROGRESS')) {
  // Notify user that deployment is already in progress
  await mcpClient.callTool('update_user', {
    messageId: message.id,
    updateContent: "Deployment already in progress by another agent. Will queue your request."
  });
  return;
}

// Claim deployment directory and notify user
await mcpClient.callTool('update_boop', {
  directory: './deploy',
  agentId: 'deploy-agent',
  workDescription: 'Production deployment'
});

await mcpClient.callTool('update_user', {
  messageId: message.id,
  updateContent: "🚀 Starting deployment process. I'll update you with progress..."
});

// Perform deployment work...

// Complete work and notify
await mcpClient.callTool('end_work', {
  directory: './deploy',
  agentId: 'deploy-agent',
  message: 'Production deployment completed successfully'
});

await mcpClient.callTool('update_user', {
  messageId: message.id,
  updateContent: "✅ Deployment completed successfully! Application is now live."
});
```

### Bot Setup Requirements

**Discord Bot Permissions:**
- Guild Messages Intent
- Message Content Intent
- Send Messages permission in target channels

**Slack App Configuration:**
- Socket Mode enabled with app-level token
- Bot token with `app_mentions:read` and `chat:write` scopes
- Event subscriptions for `app_mention` events

See `docs/INGRESS.md` and `docs/SCOPES_INTENTS.md` for detailed setup instructions.

## 🏗️ Architecture

### File Format

#### Beep File (`beep`)
```json
{
  "completedAt": "2024-08-20T10:30:00.000Z",
  "message": "Refactoring completed successfully",
  "completedBy": "claude-assistant"
}
```

#### Boop File (`boop`) 
```json
{
  "startedAt": "2024-08-20T10:00:00.000Z",
  "agentId": "claude-assistant",
  "workDescription": "Refactoring authentication components"
}
```

### State Machine

```
┌─────────────────┐    ┌─────────────────┐
│  NO_COORDINATION │───▶│  WORK_IN_PROGRESS │
│   (no files)    │    │   (boop exists)   │
└─────────────────┘    └─────────────────┘
         ▲                        │
         │                        ▼
┌─────────────────┐    ┌─────────────────┐
│   WORK_ALLOWED  │◀───│   end_work()    │
│  (beep exists)  │    │                 │
└─────────────────┘    └─────────────────┘
```

### Error States

- **INVALID_STATE**: Both beep and boop files exist (requires manual cleanup)
- **WORK_ALREADY_IN_PROGRESS**: Another agent has claimed the directory
- **AGENT_MISMATCH**: Wrong agent trying to end work

## 🎯 Best Practices

### Directory Granularity
- ✅ **Good**: `./src/auth-service/`, `./packages/ui-components/`
- ❌ **Too granular**: `./src/auth-service/login.ts`
- ❌ **Too broad**: `./src/` (entire source)

### Agent ID Guidelines  
- Use descriptive, unique identifiers: `claude-assistant-1`, `gpt4-refactor-bot`
- Avoid generic names: `agent`, `ai`, `assistant`
- Include version/instance info for disambiguation

### Git Integration
- ✅ **Automatic .gitignore**: Coordination files are automatically added to `.gitignore`
- ✅ **Repository Clean**: `beep` and `boop` files won't be committed to version control
- ⚙️ **Configurable**: Use `BEEP_BOOP_MANAGE_GITIGNORE=false` to disable if needed
- 🔧 **Smart Detection**: Only adds entries if they don't already exist

### Error Handling
- Always check status before claiming work
- Provide graceful fallbacks when directories are busy  
- Never force-override another agent's coordination files

## 🔍 Troubleshooting

### Common Issues

#### "Directory is busy" - Another agent is working
```bash
# Check who's working
check_status -> shows agentId and timestamps

# Options:
# 1. Wait for work to complete
# 2. Work in different directory  
# 3. If boop file is stale (>30min), alert user
```

#### "Invalid state" - Both beep and boop exist
```bash  
# Manual intervention required
# Check file timestamps and contents
# Remove appropriate file based on actual state
```

#### Permission errors
- Verify directory exists and is writable
- Check file system permissions
- Agent may need elevated access

### Debug Mode
```bash
NODE_ENV=development npm start
```

### Log Files
Server logs errors to `stderr` to avoid interfering with MCP protocol on `stdout`.

## 🧪 Testing

### Ingress Listener (Discord/Slack)

Quick test (Discord provider, placeholder token):

- Do not paste secrets inline; export via your shell or MCP config.
- Start with Discord first using a placeholder to validate wiring (HTTP starts, Discord login will fail fast with TokenInvalid, which confirms the path):

```bash
BEEP_BOOP_INGRESS_ENABLED=true \
BEEP_BOOP_INGRESS_PROVIDER=discord \
BEEP_BOOP_DISCORD_BOT_TOKEN={{DISCORD_BOT_TOKEN}} \
BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN={{INGRESS_TOKEN}} \
BEEP_BOOP_LOG_LEVEL=debug \
npm run listen
```

You should see:
- Config summary
- HTTP endpoint online (http://localhost:7077)
- Discord TokenInvalid (expected when using a placeholder)

HTTP endpoint usage (replace token if configured):
```bash
curl -H "Authorization: Bearer {{INGRESS_TOKEN}}" http://localhost:7077/messages
curl -H "Authorization: Bearer {{INGRESS_TOKEN}}" http://localhost:7077/messages/<MESSAGE_ID>
curl -X POST -H "Authorization: Bearer {{INGRESS_TOKEN}}" http://localhost:7077/messages/<MESSAGE_ID>/ack
```

To actually test Discord end-to-end, set a valid BEEP_BOOP_DISCORD_BOT_TOKEN and invite the bot to your server with intents enabled (Guilds, Guild Messages, Message Content). Mention the bot to create a captured message and get an immediate ack reply.

To test Slack, set:
- BEEP_BOOP_INGRESS_PROVIDER=slack
- BEEP_BOOP_SLACK_APP_TOKEN=xapp-… (Socket Mode app-level token with connections:write)
- BEEP_BOOP_SLACK_BOT_TOKEN=xoxb-… (bot token with app_mentions:read, chat:write; add history scopes as needed if you want to capture non-mention messages)

Then run:
```bash
npm run listen
```

See docs/INGRESS.md and docs/SCOPES_INTENTS.md for full setup.

Run the test suite:
```bash
npm test
```

Test with a real MCP client:
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Test with MCP client
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

## 🤝 Integration Examples

### MCP tool: update_user

Agents can post follow-up updates back to the original Slack thread or Discord channel for a captured message.

Input fields:
- messageId: ID of the captured message (from the local inbox)
- updateContent: message text to send

Example (pseudo):
```json path=null start=null
{
  "tool": "update_user",
  "params": {
    "messageId": "2b1b8e02-6c6b-4a3d-9f0f-123456789abc",
    "updateContent": "I'll start preparing a deployment plan and report back within 10 minutes."
  }
}
```

### With Task Planners
```typescript
async function findAvailableWork(tasks: Task[]) {
  const available = [];
  
  for (const task of tasks) {
    const status = await checkStatus(task.directory);
    if (!status.includes('WORK_IN_PROGRESS')) {
      available.push(task);
    }
  }
  
  return available;
}
```

### With CI/CD
```yaml
- name: Check work coordination
  run: |
    if [ -f "boop" ]; then
      echo "Work in progress, skipping deployment"
      exit 1
    fi
```

### With Monitoring
```typescript
// Alert on stale boop files
const boopAge = Date.now() - boopTimestamp.getTime();
if (boopAge > 30 * 60 * 1000) { // 30 minutes
  alertUser(`Stale boop file: ${directory}`);
}
```

## 🛠️ Development

### Project Structure
```
src/
  ├── index.ts              # Main MCP server entry point  
  ├── types.ts              # TypeScript interfaces
  ├── config.ts             # Configuration management
  ├── file-operations.ts    # Core beep/boop logic
  ├── tools.ts              # MCP tool implementations
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

docs/
├── AGENT_COORDINATION_RULE.md  # Core coordination principles
├── BEEP_BOOP_RULE.md          # Tool usage reference
├── CONFIGURATION.md           # Environment variables guide
├── INGRESS.md                 # Discord/Slack integration guide
├── SCOPES_INTENTS.md          # Bot permissions setup
└── stale-cleanup-example.md   # Advanced cleanup scenarios
```

### Building and Testing
```bash
# Development commands
npm run dev    # Development mode with hot reload
npm run build  # Compile TypeScript to dist/
npm start      # Start production server
npm run listen # Start ingress server for Discord/Slack

# Testing commands
npm test              # Run test suite (build verification)
npm run test:webhooks # Test Discord/Slack webhook integrations
npx tsc --noEmit     # TypeScript compilation check

# Configuration management
npm run config                # Interactive configuration selection
npm run config:dev           # Apply development configuration
npm run config:prod          # Apply production configuration
npm run config:ci            # Apply CI/CD configuration
npm run config:enterprise    # Apply enterprise configuration
```

### Contributing
1. Fork the [repository](https://github.com/thesammykins/beep_boop_mcp)
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes with tests
4. Push to your branch: `git push origin feature/my-feature`
5. Create a Pull Request

### Automated Publishing
This project uses GitHub Actions for automated testing and publishing:

- **Feature Branches**: Tests run automatically on push
- **Main Branch**: Automatic version bumping, npm publishing, and GitHub releases
- **Version Bumping**: Based on commit message keywords:
  - `BREAKING`/`major`: Major version (1.0.0 → 2.0.0)
  - `feat`/`feature`/`minor`: Minor version (1.0.0 → 1.1.0)  
  - Everything else: Patch version (1.0.0 → 1.0.1)

See [GitHub Workflow Setup](.github/WORKFLOW_SETUP.md) for detailed configuration.

## 📄 License

MIT License - see LICENSE file

## 📁 Documentation & Examples

### Documentation
- [Agent Coordination Rules](./docs/AGENT_COORDINATION_RULE.md) - Core coordination principles
- [Beep/Boop File Specification](./docs/BEEP_BOOP_RULE.md) - File format and state machine details
- [Configuration Guide](./docs/CONFIGURATION.md) - Environment variables and setup options
- [Stale Cleanup Examples](./docs/stale-cleanup-example.md) - Advanced cleanup scenarios

### Example Configurations
- [Development Config](./example-configs/mcp-config.development.json) - Local development setup
- [CI/CD Config](./example-configs/mcp-config.ci.json) - Continuous integration environment
- [Enterprise Config](./example-configs/mcp-config.enterprise.json) - Production enterprise setup
- [Config Selection Script](./example-configs/select-config.sh) - Environment-based config switching
- [Example MCP Client](./example-configs/example-client.js) - Sample integration code

## 🔗 Related

- [Model Context Protocol](https://modelcontextprotocol.io/) - Official MCP specification
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - SDK used by this server

## 📞 Support

For issues and questions:
- Check [existing GitHub issues](https://github.com/thesammykins/beep_boop_mcp/issues)
- Review the troubleshooting guide above
- [Create new issue](https://github.com/thesammykins/beep_boop_mcp/issues/new) with reproduction steps

---

**Built with ❤️ for AI agent collaboration**
