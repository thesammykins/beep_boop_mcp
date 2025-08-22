# Beep/Boop Work Coordination Rule for AI Agents

## 🚨 Quick Rule Summary

**Before starting ANY work in a shared codebase, use the Beep/Boop MCP server to coordinate with other agents.** The system uses two simple file types to prevent conflicts: `beep` files signal completed work (safe to start new work), while `boop` files indicate work in progress (wait or work elsewhere). Always call `check_status` first, then `update_boop` to claim work, and `end_work` when finished.

**Essential workflow**: `check_status` → `update_boop` → *do work* → `end_work`. Never skip the coordination checks or leave `boop` files behind when your work is complete.

**For interactive workflows with Discord/Slack**: Use `update_user` to send progress reports, error notifications, and status updates back to the original message thread. Use `initiate_conversation` to proactively start new conversations when agents need to notify users about work status, errors, or completion. This enables bidirectional communication between agents and users during coordinated work.

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

### 5. Communication with Users (Optional)

For interactive workflows with Discord/Slack integration:

```
Use MCP tool: update_user
Parameters: {
  "messageId": "captured-message-id",
  "updateContent": "Status update or progress report"
}
```

**Use Cases:**
- Progress reports during long-running work
- Error notifications and recovery updates  
- Completion confirmations
- Request additional input or clarification

### 6. Proactive Communication (Optional)

For initiating new conversations when agents need to notify users:

```
Use MCP tool: initiate_conversation
Parameters: {
  "platform": "discord", // or "slack"
  "channelId": "optional-specific-channel-id", // uses default if omitted
  "content": "Initial message to send",
  "agentId": "your-unique-agent-id" // optional for attribution
}
```

**Use Cases:**
- Notify users about completed background work
- Alert about system issues or failures discovered during routine checks
- Report completion of scheduled tasks or maintenance
- Send proactive status updates for long-running processes
- Alert users when manual intervention is needed

**Response**: Returns a message ID that can be used with `update_user` for follow-up messages in the same conversation thread.

### 7. Listener Status Monitoring (Optional)

For checking the status and connectivity of the HTTP listener service:

```
Use MCP tool: check_listener_status
Parameters: {
  "includeConfig": false // optional - whether to include detailed configuration
}
```

**Use Cases:**
- Verify ingress service connectivity before delegation
- Troubleshoot communication issues with centralized listener
- Debug listener configuration problems
- Health checks for distributed agent systems
- Validate webhook and bot token configuration

**Response**: Returns detailed status including:
- Configuration overview (enabled/disabled status, URLs, timeouts)
- Connectivity test results (health check, MCP endpoint verification)
- Optional detailed configuration when `includeConfig: true`

## Example Workflows

### Basic Coordination Workflow

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

### Interactive Discord/Slack Workflow

```typescript
// Agent receives message from Discord/Slack ingress system
const message = await getMessageFromInbox(messageId);
const { content, author, platform } = message;

// Parse request (e.g., "deploy to production")
const deployRequest = parseDeploymentRequest(content);
const targetDirectory = './deploy';

// 1. Check coordination status
const status = await mcpClient.callTool('check_status', {
  directory: targetDirectory
});

if (status.includes('WORK_IN_PROGRESS')) {
  // Notify user of conflict via update_user
  await mcpClient.callTool('update_user', {
    messageId: message.id,
    updateContent: `⚠️ Deployment already in progress by another agent. Your request is queued.`
  });
  
  // Queue the request or wait...
  return;
}

// 2. Claim directory and notify user
await mcpClient.callTool('update_boop', {
  directory: targetDirectory,
  agentId: 'deployment-agent',
  workDescription: `${platform} requested deployment by ${author}`
});

await mcpClient.callTool('update_user', {
  messageId: message.id,
  updateContent: `🚀 Starting deployment to ${deployRequest.environment}. I'll keep you updated...`
});

// 3. Perform deployment work with progress updates
try {
  // Pre-deployment checks
  await runPreDeploymentChecks();
  await mcpClient.callTool('update_user', {
    messageId: message.id,
    updateContent: `✅ Pre-deployment checks passed. Building application...`
  });
  
  // Build and deploy
  await buildApplication();
  await mcpClient.callTool('update_user', {
    messageId: message.id,
    updateContent: `🔨 Build complete. Deploying to ${deployRequest.environment}...`
  });
  
  await deployToEnvironment(deployRequest.environment);
  
  // 4. Signal completion with success message
  await mcpClient.callTool('end_work', {
    directory: targetDirectory,
    agentId: 'deployment-agent',
    message: `Successfully deployed to ${deployRequest.environment}`
  });
  
  await mcpClient.callTool('update_user', {
    messageId: message.id,
    updateContent: `✅ Deployment completed successfully!\n🌍 Application is now live at: ${deployRequest.url}`
  });
  
} catch (error) {
  // Handle errors gracefully
  await mcpClient.callTool('end_work', {
    directory: targetDirectory,
    agentId: 'deployment-agent',
    message: `Deployment failed: ${error.message}`
  });
  
  await mcpClient.callTool('update_user', {
    messageId: message.id,
    updateContent: `❌ Deployment failed: ${error.message}\n🔧 Please check the logs and retry.`
  });
}
```

### Multi-Agent Coordination with User Communication

```typescript
// Agent A: Database migration agent
async function handleDatabaseMigration(messageId: string, migrationRequest: any) {
  const dbDirectory = './database/migrations';
  
  // Check if migration directory is available
  const status = await mcpClient.callTool('check_status', {
    directory: dbDirectory,
    maxAgeHours: 1,  // Consider migrations stale after 1 hour
    autoCleanStale: true  // Auto-cleanup for shorter tasks
  });
  
  if (status.includes('WORK_IN_PROGRESS')) {
    await mcpClient.callTool('update_user', {
      messageId,
      updateContent: `🔄 Database migration already in progress. Please wait...`
    });
    return;
  }
  
  // Claim and execute
  await mcpClient.callTool('update_boop', {
    directory: dbDirectory,
    agentId: 'db-migration-agent',
    workDescription: `Running migration: ${migrationRequest.name}`
  });
  
  await mcpClient.callTool('update_user', {
    messageId,
    updateContent: `🗄️ Starting database migration: ${migrationRequest.name}`
  });
  
  // Run migration...
  await runMigration(migrationRequest);
  
  await mcpClient.callTool('end_work', {
    directory: dbDirectory,
    agentId: 'db-migration-agent',
    message: `Migration ${migrationRequest.name} completed`
  });
  
  // Notify completion - this signals Agent B can proceed
  await mcpClient.callTool('update_user', {
    messageId,
    updateContent: `✅ Database migration completed. Application deployment can now proceed.`
  });
}

// Agent B: Deployment agent waiting for migration
async function handleDeploymentAfterMigration(messageId: string) {
  const deployDirectory = './deploy';
  const dbDirectory = './database/migrations';
  
  // Wait for database migration to complete
  while (true) {
    const dbStatus = await mcpClient.callTool('check_status', {
      directory: dbDirectory
    });
    
    if (dbStatus.includes('WORK_ALLOWED')) {
      // Migration completed, proceed with deployment
      break;
    } else if (dbStatus.includes('WORK_IN_PROGRESS')) {
      // Still migrating, wait and update user
      await mcpClient.callTool('update_user', {
        messageId,
        updateContent: `⏳ Waiting for database migration to complete before deployment...`
      });
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s
    } else {
      // No migration in progress, proceed
      break;
    }
  }
  
  // Now proceed with deployment
  await mcpClient.callTool('update_boop', {
    directory: deployDirectory,
    agentId: 'deployment-agent',
    workDescription: 'Post-migration deployment'
  });
  
  // ... rest of deployment logic
}
```

### Proactive Communication Workflow

```typescript
// Background monitoring agent that discovers an issue and proactively notifies users
async function performSystemHealthCheck() {
  const systemDirectory = './system';
  
  // Claim system directory for health check
  await mcpClient.callTool('update_boop', {
    directory: systemDirectory,
    agentId: 'health-monitor-agent',
    workDescription: 'Performing system health check'
  });
  
  try {
    // Run various health checks
    const issues = await runHealthChecks();
    
    if (issues.length > 0) {
      // Critical issues found - proactively notify users
      const conversationResult = await mcpClient.callTool('initiate_conversation', {
        platform: 'discord',
        // channelId omitted to use default channel
        content: `🚨 **System Health Alert**\n\nI discovered ${issues.length} critical issues during routine health check:\n\n${issues.map(issue => `• ${issue.description}`).join('\n')}\n\nRequesting immediate attention for system stability.`,
        agentId: 'health-monitor-agent'
      });
      
      // Parse the conversation result to get the message ID
      const messageId = conversationResult.content[0].text.match(/Message ID: ([a-zA-Z0-9-]+)/)?.[1];
      
      if (messageId) {
        // Provide detailed breakdown in follow-up messages
        for (const issue of issues) {
          await mcpClient.callTool('update_user', {
            messageId,
            updateContent: `🔍 **Issue Details: ${issue.title}**\n\n**Severity**: ${issue.severity}\n**Component**: ${issue.component}\n**Description**: ${issue.description}\n**Recommended Action**: ${issue.action}\n\n**Logs**: \`\`\`\n${issue.logs}\n\`\`\``
          });
        }
        
        // Provide summary and next steps
        await mcpClient.callTool('update_user', {
          messageId,
          updateContent: `📋 **Summary**: ${issues.filter(i => i.severity === 'critical').length} critical, ${issues.filter(i => i.severity === 'warning').length} warnings\n\n🔧 **Immediate Actions Required**:\n1. Review critical issues above\n2. Check system logs: \`docker logs app-container\`\n3. Verify database connectivity\n4. Monitor CPU/memory usage\n\n🤖 I'll continue monitoring and update you on any changes.`
        });
      }
    } else {
      // All good - just log internally, no need to notify users
      console.log('✅ System health check passed - all systems normal');
    }
    
  } finally {
    // Always clean up
    await mcpClient.callTool('end_work', {
      directory: systemDirectory,
      agentId: 'health-monitor-agent',
      message: issues.length > 0 ? `Health check completed - ${issues.length} issues found` : 'Health check completed - all systems healthy'
    });
  }
}

// Scheduled task completion agent
async function notifyScheduledTaskCompletion(taskName: string, results: any) {
  // Initiate conversation to notify about completed background task
  const conversationResult = await mcpClient.callTool('initiate_conversation', {
    platform: 'discord',
    content: `✅ **Scheduled Task Completed: ${taskName}**\n\nBackground task has finished successfully. Results summary:\n\n• **Duration**: ${results.duration}\n• **Items Processed**: ${results.itemsProcessed}\n• **Success Rate**: ${results.successRate}%\n• **Errors**: ${results.errors.length}\n\nFull details in thread below.`,
    agentId: 'scheduler-agent'
  });
  
  const messageId = conversationResult.content[0].text.match(/Message ID: ([a-zA-Z0-9-]+)/)?.[1];
  
  if (messageId && results.errors.length > 0) {
    // Provide error details only if there were issues
    await mcpClient.callTool('update_user', {
      messageId,
      updateContent: `❌ **Errors Encountered**:\n\n${results.errors.map((error, index) => `${index + 1}. ${error.message}\n   **Item**: ${error.item}\n   **Action**: ${error.suggestedAction}\n`).join('\n')}\n\n📈 **Performance Metrics**:\n• Average processing time: ${results.avgProcessingTime}ms\n• Memory usage: ${results.memoryUsage}\n• CPU utilization: ${results.cpuUsage}%`
    });
  }
}

// Agent discovery and collaboration initiation
async function requestCollaborationForComplexTask(taskDescription: string) {
  const conversationResult = await mcpClient.callTool('initiate_conversation', {
    platform: 'discord',
    content: `🤝 **Multi-Agent Collaboration Request**\n\n**Task**: ${taskDescription}\n\nThis task requires coordination between multiple agents. I'm initiating this thread to coordinate our efforts and prevent conflicts.\n\n**Required Capabilities**:\n• Database operations\n• API integrations\n• File system management\n• Testing and validation\n\n**Status**: Looking for available agents to join this collaboration.\n\nPlease respond if you have the required capabilities and availability.`,
    agentId: 'coordination-agent'
  });
  
  const messageId = conversationResult.content[0].text.match(/Message ID: ([a-zA-Z0-9-]+)/)?.[1];
  
  if (messageId) {
    // Set up coordination workflow with regular status updates
    await mcpClient.callTool('update_user', {
      messageId,
      updateContent: `📋 **Coordination Plan**:\n\n1. **Phase 1**: Database schema updates (requires db-agent)\n2. **Phase 2**: API endpoint modifications (requires api-agent)\n3. **Phase 3**: File processing updates (requires file-agent)\n4. **Phase 4**: Integration testing (requires test-agent)\n\n🔄 I'll coordinate the handoffs between phases and ensure proper beep/boop file management throughout.\n\n⏰ **Next**: Waiting for agent availability confirmations.`
    });
  }
  
  return messageId; // Return for continued coordination
}
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

### Discord/Slack Integration Best Practices

**Message Handling:**
- Always acknowledge user requests immediately with `update_user`
- Provide regular progress updates for long-running tasks
- Use clear, informative messages with appropriate emojis for visual clarity
- Handle errors gracefully and provide actionable next steps

**Coordination with Communication:**
- Check coordination status BEFORE claiming work, even for user requests
- Notify users if their request conflicts with ongoing work
- Use `update_user` to keep users informed throughout the coordination workflow
- Provide estimated completion times when possible

**Message Flow Patterns:**
```typescript
// Pattern: Immediate acknowledgment + status checking
await mcpClient.callTool('update_user', {
  messageId,
  updateContent: "🔍 Checking if I can start this task..."
});

// Check status and handle conflicts
const status = await mcpClient.callTool('check_status', { directory });
if (status.includes('WORK_IN_PROGRESS')) {
  await mcpClient.callTool('update_user', {
    messageId,
    updateContent: "⚠️ Another agent is working on this. I'll queue your request."
  });
  return;
}

// Continue with work and regular updates
```

**Thread Management:**
- Use descriptive thread names for complex tasks
- Keep related work in the same thread when possible
- Close/acknowledge threads when tasks are complete
- Tag relevant users when additional input is needed

### Interactive steps and user threads (Discord)
When an agent needs user input to proceed:
1. Halt execution at a well-defined checkpoint (after persisting current state).
2. Start a Discord thread from the triggering message (the listener will automatically do this for new mentions), or explicitly open one if needed.
3. Post a prompt in the thread and tag the appropriate user ID(s) for action.
4. Wait for a reply in the thread. The listener captures thread messages owned by the bot, so the user does not need to mention the bot again.
5. Read the new message from the inbox (HTTP endpoint or MCP tool) and continue the workflow.

Guidelines:
- Use concise prompts with clear next actions and expected format.
- Keep one task per thread; name threads descriptively (e.g., “Task: Update CI secrets”).
- Close/ack the thread when the task is complete.

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

**Or from source:**
```json
{
  "mcpServers": {
    "beep-boop-coordination": {
      "command": "node",
      "args": ["./path/to/beep_boop_mcp/dist/index.js"]
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
