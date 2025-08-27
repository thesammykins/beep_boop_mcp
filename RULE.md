# Beep-Boop MCP Server Usage Rules for Agents

The beep-boop MCP server provides essential coordination tools to prevent conflicts when multiple AI agents work in shared codebases. Every agent MUST follow the coordination workflow to avoid race conditions and merge conflicts. The system uses two file types: `beep` files signal completed work (safe to start new work), while `boop` files indicate work in progress (wait or work elsewhere). This simple signaling mechanism ensures only one agent can claim and work in a directory at a time.

**Essential Workflow**: Always start with `check_status` to verify the directory state before claiming work. If the status shows "WORK_ALLOWED" (beep file exists), use `update_boop` to claim the directory with your unique agent ID and work description. Perform your work while the boop file exists, then immediately call `end_work` when finished to atomically remove the boop file and create a new beep file. Never leave boop files behind after completing work, as this will block other agents indefinitely.

**Communication Integration**: Use the conversation tools for interactive workflows with Discord/Slack. Call `check_listener_status` to verify the communication system is running, then use `initiate_conversation` to proactively start conversations when you need to notify users about work status, errors, or completion. Use `update_user` to send progress reports, error notifications, and status updates back to original message threads. This enables bidirectional communication between agents and users during coordinated work.

**Error Handling & Edge Cases**: The system includes robust validation and error handling. Agent ID mismatches are strictly enforced—only the agent that created a boop file can end the work. Stale file detection automatically cleans up abandoned boop files older than configurable thresholds (use `autoCleanStale: true` with appropriate `maxAgeHours`). Always handle coordination errors gracefully and respect other agents' work claims. If you encounter "WORK_IN_PROGRESS" status, either wait for completion or check if the boop file is stale before attempting cleanup.

## MCP Tool Call Examples

### Basic Coordination Workflow
```json
// 1. Check directory status
{"tool": "check_status", "arguments": {"directory": "/path/to/project"}}

// 2. Claim directory for work
{"tool": "update_boop", "arguments": {"agentId": "my-agent-id", "directory": "/path/to/project", "workDescription": "Refactoring authentication module"}}

// 3. Complete work and signal completion
{"tool": "end_work", "arguments": {"agentId": "my-agent-id", "directory": "/path/to/project", "message": "Authentication refactoring completed successfully"}}
```

### Stale File Cleanup with Auto-Claiming
```json
// Check status with automatic cleanup and claiming
{"tool": "check_status", "arguments": {"directory": "/path/to/project", "autoCleanStale": true, "maxAgeHours": 2, "newAgentId": "cleanup-agent", "newWorkDescription": "Taking over stale work"}}
```

### Communication Tools
```json
// 1. Check if listener service is available
{"tool": "check_listener_status", "arguments": {"includeConfig": true}}

// 2. Start a conversation proactively
{"tool": "initiate_conversation", "arguments": {"platform": "discord", "content": "🤖 Starting database migration - this may take 30 minutes", "agentId": "migration-bot"}}

// 3. Send follow-up updates
{"tool": "update_user", "arguments": {"messageId": "captured-message-id", "updateContent": "✅ Migration completed successfully - 1,245 records processed"}}
```

### Error Scenarios
```json
// Manual beep creation when no boop exists
{"tool": "create_beep", "arguments": {"directory": "/path/to/project", "message": "Manual completion marker"}}

// Status check with custom staleness threshold
{"tool": "check_status", "arguments": {"directory": "/path/to/project", "maxAgeHours": 0.5}}
```
