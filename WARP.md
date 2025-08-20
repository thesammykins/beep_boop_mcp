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

## Architecture Overview

### MCP Server Pattern
- **Entry Point**: `src/index.ts` - Sets up MCP server with StdioServerTransport
- **Tool Registration**: Four coordination tools registered via `McpServer.registerTool()`
- **Transport**: Uses stdio for MCP protocol communication (stdout/stdin)
- **Logging**: stderr only (to avoid interfering with MCP protocol)

### Core Components
```
src/
├── index.ts          # MCP server setup, tool registration, signal handling
├── tools.ts          # Tool handlers with Zod schema validation
├── file-operations.ts # Atomic beep/boop file operations
├── config.ts         # Environment-based configuration system
└── types.ts          # TypeScript interfaces and error types
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

Switch configs with: `./example-configs/select-config.sh <environment>`

## Development Workflow

### Local Development
```bash
# Use tsx for development (hot reload)
npm run dev

# Or build and run manually  
npm run build
node dist/index.js
```

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

