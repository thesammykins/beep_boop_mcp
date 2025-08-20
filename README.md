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
npm install -g @thesammykis/beep-boop-mcp-server
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
      "args": ["-y", "@thesammykis/beep-boop-mcp-server"]
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
  ├── index.ts          # Main MCP server entry point  
  ├── types.ts          # TypeScript interfaces
  ├── config.ts         # Configuration management
  ├── file-operations.ts # Core beep/boop logic
  └── tools.ts          # MCP tool implementations
docs/
  ├── AGENT_COORDINATION_RULE.md  # Core coordination principles
  ├── BEEP_BOOP_RULE.md          # Tool usage reference
  ├── CONFIGURATION.md           # Environment variables guide
  └── stale-cleanup-example.md   # Advanced cleanup scenarios
example-configs/
  ├── mcp-config.development.json
  ├── mcp-config.ci.json
  ├── mcp-config.enterprise.json
  ├── select-config.sh
  └── example-client.js
```

### Building
```bash
npm run build  # Compile TypeScript
npm run dev    # Development mode with hot reload
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
