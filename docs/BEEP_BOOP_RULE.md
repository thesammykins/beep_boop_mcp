# Beep/Boop Work Coordination Rule

## 🚀 Quick Start

**Use the beep/boop MCP server to coordinate work between multiple agents in shared codebases.** This prevents conflicts and ensures safe parallel collaboration in monorepos.

**Four essential tools**: `check_status` (check directory), `update_boop` (claim work), `end_work` (finish work), `create_beep` (manual completion).

## Quick Reference

Before starting ANY work in a feature/service directory:

1. **Check status**: `check_status` with directory path
2. **If clear**: `update_boop` with your agent ID to claim work  
3. **Do your work**: Keep boop file while working
4. **When done**: `end_work` with your agent ID to complete

## Tool Usage

### check_status
```json
{"directory": "/path/to/feature"}
```
Returns current state: WORK_ALLOWED, WORK_IN_PROGRESS, NO_COORDINATION, or INVALID_STATE

**Advanced usage with stale cleanup:**
```json
{
  "directory": "/path/to/feature",
  "maxAgeHours": 24,
  "autoCleanStale": true,
  "newAgentId": "your-agent-id",
  "newWorkDescription": "Continuing work after cleanup"
}
```
- `maxAgeHours`: How old boop files must be to be considered stale (default: 24)
- `autoCleanStale`: Whether to automatically remove stale boop files
- `newAgentId`: Your agent ID to claim work after cleanup
- `newWorkDescription`: Description for the claimed work

### update_boop 
```json
{
  "directory": "/path/to/feature",
  "agentId": "your-unique-agent-id", 
  "workDescription": "Brief description of work"
}
```
Claims directory for work. Fails if another agent is already working.

### end_work
```json
{
  "directory": "/path/to/feature",
  "agentId": "your-unique-agent-id",
  "message": "Work completion summary"
}
```
Atomically completes work - removes boop file and creates beep file.

### create_beep (rarely used)
```json
{
  "directory": "/path/to/feature", 
  "message": "Work completed"
}
```
Manually signals work completion when no boop file exists.

## Decision Logic

```
check_status result → Action
├─ WORK_ALLOWED → update_boop to claim work
├─ NO_COORDINATION → update_boop to claim work  
├─ WORK_IN_PROGRESS → Wait or work elsewhere
└─ INVALID_STATE → Alert user for cleanup
```

## Best Practices

- **Coordinate at feature/service level**: `./src/auth-service/`, not individual files
- **Use unique agent IDs**: Include your instance/version identifier  
- **Always end_work**: Never leave dangling boop files
- **Handle conflicts gracefully**: Respect other agents' claimed work
- **Monitor for stale boops**: Files older than 30min may need manual cleanup

## Example Agent ID Patterns

- `claude-assistant-1`
- `gpt4-dev-worker`
- `codebase-refactor-bot-v2`

Avoid generic names like `agent`, `ai`, `assistant`.

## Error Recovery

- **Your own stale boop**: Use `end_work` to clean up
- **Another agent's stale boop**: Alert user, don't override
- **INVALID_STATE**: Alert user for manual inspection of both files

**This prevents merge conflicts and ensures safe multi-agent collaboration.**
