# Stale Cleanup Feature Example

## Enhanced check_status Tool

The `check_status` tool now includes powerful stale file detection and automatic cleanup capabilities.

### Basic Usage

```json
{
  "directory": "./src/components"
}
```

Shows current status with file age information and stale detection.

### Advanced Usage with Automatic Cleanup

```json
{
  "directory": "./src/components",
  "maxAgeHours": 8,
  "autoCleanStale": true,
  "newAgentId": "claude-assistant-2",
  "newWorkDescription": "Continuing component refactoring after stale cleanup"
}
```

This will:
1. Check if any boop file is older than 8 hours
2. If found, automatically remove the stale boop file
3. Claim the directory for the new agent
4. Return updated status

### Example Workflow

**Agent encounters a stale directory:**

```typescript
// 1. Check status - detects stale file
const status = await callTool('check_status', {
  directory: './src/auth',
  maxAgeHours: 24
});

// Response shows: "⚠️ STALE BOOP DETECTED: File is 2 days old"

// 2. Automatically clean up and claim
const cleanup = await callTool('check_status', {
  directory: './src/auth', 
  autoCleanStale: true,
  newAgentId: 'claude-assistant-3',
  newWorkDescription: 'Taking over auth service work'
});

// Response: "🧹 Cleaned up stale boop file from agent "old-agent" and claimed for agent "claude-assistant-3""
```

### Benefits

1. **Automatic Recovery**: No manual intervention needed for abandoned work
2. **Configurable Thresholds**: Set custom age limits per use case  
3. **Safe Handover**: Atomic cleanup and claim prevents race conditions
4. **Audit Trail**: Full logging of cleanup actions and reasons

### Use Cases

- **Long-running processes**: Agents that crash or get terminated
- **Development environments**: Quick recovery from interrupted work
- **CI/CD integration**: Cleanup stale locks before deployments
- **Multi-timezone teams**: Different working hours causing apparent abandonment

This enhancement makes the beep/boop coordination system much more robust and self-healing!
