# Beep/Boop Work Coordination Rule for AI Agents

## 🚨 Quick Rule Summary

**Before starting ANY work in a shared codebase, use the Beep/Boop MCP server to coordinate with other agents.** The system uses two simple file types to prevent conflicts: `beep` files signal completed work (safe to start new work), while `boop` files indicate work in progress (wait or work elsewhere). Always call `check_status` first, then `update_boop` to claim work, and `end_work` when finished.

**Essential workflow**: `check_status` → `update_boop` → *do work* → `end_work`. Never skip the coordination checks or leave `boop` files behind when your work is complete.

---

This rule provides comprehensive guidance for AI agents on how to use the Beep/Boop MCP server for coordinating work in monorepos and shared codebases.

## Rule Summary

**ALWAYS check for coordination before starting work in any directory. Use beep/boop files to prevent conflicts between multiple agents working in the same codebase.**

## Core Concepts

### File System Signals
- **`beep` file**: Signals work is complete and directory is cleared for new work
- **`boop` file**: Signals work is currently in progress by a specific agent

### Work States
1. **WORK_ALLOWED**: `beep` exists, no `boop` → Safe to start new work
2. **WORK_IN_PROGRESS**: `boop` exists, no `beep` → Another agent is working
3. **NO_COORDINATION**: Neither file exists → Unclaimed directory
4. **INVALID_STATE**: Both files exist → Manual cleanup needed

## Workflow for AI Agents

### 1. Before Starting Any Work

**ALWAYS** check the coordination status first:

```
Use MCP tool: check_status
Parameters: { "directory": "/path/to/work/directory" }
```

**Decision Matrix:**
- ✅ `WORK_ALLOWED` or `NO_COORDINATION` → Proceed to claim work
- ⚠️ `WORK_IN_PROGRESS` → Wait or work elsewhere  
- ❌ `INVALID_STATE` → Alert user for manual intervention

### 2. Claiming Work Directory

When safe to proceed, claim the directory:

```
Use MCP tool: update_boop
Parameters: {
  "directory": "/path/to/work/directory",
  "agentId": "your-unique-agent-id",
  "workDescription": "Brief description of planned work"
}
```

**Agent ID Guidelines:**
- Use a unique, consistent identifier (e.g., `claude-assistant-1`, `gpt4-worker-a`)
- Only alphanumeric characters, hyphens, underscores, and dots
- Keep it under 100 characters

### 3. During Work

- Keep the `boop` file in place while working
- Optionally update it if work scope changes significantly
- Monitor for external interruptions or conflicts

### 4. Completing Work

When all work is finished, atomically signal completion:

```
Use MCP tool: end_work
Parameters: {
  "directory": "/path/to/work/directory",
  "agentId": "your-unique-agent-id",
  "message": "Optional completion summary"
}
```

This automatically:
1. Removes your `boop` file
2. Creates a `beep` file 
3. Signals directory is cleared for new work

## Example Workflow

```typescript
// 1. Check status before starting
const status = await mcpClient.callTool('check_status', {
  directory: './src/components'
});

if (status.includes('WORK_IN_PROGRESS')) {
  console.log('Directory busy, working elsewhere...');
  return;
}

// 2. Claim the directory
await mcpClient.callTool('update_boop', {
  directory: './src/components',
  agentId: 'claude-dev-assistant',
  workDescription: 'Refactoring Button component'
});

// 3. Do your work
// ... implement changes ...

// 4. Signal completion
await mcpClient.callTool('end_work', {
  directory: './src/components', 
  agentId: 'claude-dev-assistant',
  message: 'Refactored Button component with TypeScript improvements'
});
```

## Best Practices

### Directory Selection
- Apply coordination at the **feature/service level**, not individual files
- Good: `./src/auth-service/`, `./packages/ui-components/`
- Avoid: `./src/auth-service/login.ts` (too granular)

### Error Handling
- Always handle `WORK_ALREADY_IN_PROGRESS` gracefully
- Provide alternative work suggestions when blocked
- Never force-override another agent's `boop` file

### Timeout Considerations
- `boop` files don't automatically expire
- If an agent crashes, manual cleanup may be needed
- Monitor for stale `boop` files (>30 minutes old)

### Recovery Strategies
- If you find your own stale `boop` file, use `end_work` to clean up
- If you find another agent's stale `boop` file, alert the user
- For `INVALID_STATE`, recommend manual inspection of both files

## Integration Examples

### With Task Planning
```typescript
async function planWork(tasks: Task[]) {
  const availableDirectories = [];
  
  for (const task of tasks) {
    const status = await checkDirectoryStatus(task.directory);
    if (status !== 'WORK_IN_PROGRESS') {
      availableDirectories.push(task);
    }
  }
  
  return prioritizeAvailableWork(availableDirectories);
}
```

### With Error Recovery
```typescript
async function safeWorkExecution(directory: string, work: () => Promise<void>) {
  try {
    await claimDirectory(directory);
    await work();
    await signalCompletion(directory);
  } catch (error) {
    // Ensure cleanup even if work fails
    try {
      await signalCompletion(directory, `Failed: ${error.message}`);
    } catch (cleanupError) {
      console.error('Could not clean up after failure:', cleanupError);
    }
    throw error;
  }
}
```

## Common Pitfalls to Avoid

❌ **Don't skip status checks** - Always verify before claiming work
❌ **Don't use generic agent IDs** - Use unique, identifiable names  
❌ **Don't leave dangling `boop` files** - Always call `end_work` when done
❌ **Don't override other agents** - Respect existing `boop` files
❌ **Don't coordinate too granularly** - Apply at directory/service level

## Troubleshooting

### "Directory is busy" Messages
- Check which agent is working: `check_status`
- Consider working in a different area
- If `boop` file is stale (>30min), notify user

### "Invalid State" Errors  
- Both `beep` and `boop` files exist
- Use `check_status` to inspect timestamps
- Alert user for manual cleanup decision

### Permission Errors
- Verify directory exists and is writable
- Check file system permissions
- May need elevated access for some directories

## Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "beep-boop-coordination": {
      "command": "npx",
      "args": ["beep-boop-mcp-server"]
    }
  }
}
```

## Summary

The beep/boop coordination pattern ensures safe parallel work in shared codebases by:

1. **Checking** coordination status before starting work
2. **Claiming** directories with `boop` files during active work  
3. **Clearing** directories with `beep` files when work completes
4. **Respecting** other agents' claimed work areas

This prevents conflicts, reduces merge issues, and enables effective multi-agent collaboration in monorepos.
