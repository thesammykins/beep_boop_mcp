# Beep/Boop MCP Server Configuration

The Beep/Boop MCP server supports extensive configuration through environment variables, allowing you to customize behavior for different environments and use cases.

## 🚀 Quick Start

Choose a configuration template based on your environment:

```bash
# Development (fast cleanup, debug logging)
cp mcp-config.development.json mcp-config.json

# Production (secure defaults, audit logging)
cp mcp-config.json mcp-config.production.json  

# CI/CD (aggressive cleanup, minimal logging)
cp mcp-config.ci.json mcp-config.json

# Enterprise (team prefixes, notifications, compliance)
cp mcp-config.enterprise.json mcp-config.json
```

## 📋 Environment Variables Reference

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `BEEP_BOOP_DEFAULT_MAX_AGE_HOURS` | `24` | Default hours before boop files are considered stale |
| `BEEP_BOOP_AUTO_CLEANUP_ENABLED` | `false` | Enable automatic cleanup of stale files globally |
| `BEEP_BOOP_MAX_AGENT_ID_LENGTH` | `100` | Maximum allowed length for agent IDs |
| `BEEP_BOOP_FILE_PERMISSIONS` | `0644` | File permissions for created beep/boop files |

### Logging and Debugging

| Variable | Default | Description |
|----------|---------|-------------|
| `BEEP_BOOP_LOG_LEVEL` | `info` | Logging level: `error`, `warn`, `info`, `debug` |
| `BEEP_BOOP_TIMEZONE` | `UTC` | Timezone for timestamps |

### Security and Access Control

| Variable | Default | Description |
|----------|---------|-------------|
| `BEEP_BOOP_ALLOWED_DIRECTORIES` | `` | Comma-separated list of allowed directories (empty = all allowed) |
| `BEEP_BOOP_BLOCKED_DIRECTORIES` | `/tmp,/var,/etc` | Comma-separated list of blocked directories |
| `BEEP_BOOP_REQUIRE_TEAM_PREFIX` | `false` | Require agent IDs to have team prefixes |
| `BEEP_BOOP_TEAM_PREFIXES` | `` | Comma-separated list of required team prefixes |

### Backup and Recovery

| Variable | Default | Description |
|----------|---------|-------------|
| `BEEP_BOOP_BACKUP_ENABLED` | `false` | Enable backup of coordination files before operations |
| `BEEP_BOOP_BACKUP_DIR` | `./.beep-boop-backups` | Directory for storing backups |

### Monitoring and Metrics

| Variable | Default | Description |
|----------|---------|-------------|
| `BEEP_BOOP_ENABLE_METRICS` | `false` | Enable metrics collection |
| `BEEP_BOOP_ENABLE_NOTIFICATIONS` | `false` | Enable webhook notifications |
| `BEEP_BOOP_NOTIFICATION_WEBHOOK` | `` | Webhook URL for notifications |

### Audit and Compliance

| Variable | Default | Description |
|----------|---------|-------------|
| `BEEP_BOOP_AUDIT_LOG_ENABLED` | `false` | Enable audit logging |
| `BEEP_BOOP_AUDIT_LOG_PATH` | `./logs/coordination-audit.log` | Path for audit log file |

### Work Management

| Variable | Default | Description |
|----------|---------|-------------|
| `BEEP_BOOP_MAX_WORK_DURATION_HOURS` | `48` | Maximum allowed work duration |
| `BEEP_BOOP_WARN_THRESHOLD_HOURS` | `8` | Hours after which to warn about long-running work |
| `BEEP_BOOP_ESCALATION_ENABLED` | `false` | Enable escalation for long-running work |
| `BEEP_BOOP_ESCALATION_AFTER_HOURS` | `24` | Hours after which to escalate |

### Environment-Specific

| Variable | Default | Description |
|----------|---------|-------------|
| `BEEP_BOOP_DEV_MODE` | `false` | Enable development mode features |
| `BEEP_BOOP_CI_MODE` | `false` | Enable CI/CD mode optimizations |
| `BEEP_BOOP_WATCH_MODE` | `false` | Enable file watching for live updates |
| `BEEP_BOOP_FORCE_CLEANUP_ON_START` | `false` | Clean all stale files on server start |
| `BEEP_BOOP_FAIL_ON_STALE` | `false` | Fail operations if stale files detected |
| `BEEP_BOOP_MAX_CONCURRENT_OPERATIONS` | `5` | Maximum concurrent file operations |

## 🏗️ Configuration Profiles

### Development Environment
```json
{
  "BEEP_BOOP_DEFAULT_MAX_AGE_HOURS": "1",
  "BEEP_BOOP_AUTO_CLEANUP_ENABLED": "true",
  "BEEP_BOOP_LOG_LEVEL": "debug",
  "BEEP_BOOP_BACKUP_ENABLED": "false",
  "BEEP_BOOP_ALLOWED_DIRECTORIES": "./src,./test,./examples",
  "BEEP_BOOP_ENABLE_METRICS": "true"
}
```

**Features:**
- Quick 1-hour stale timeout for rapid development
- Auto-cleanup enabled for hands-off experience
- Debug logging for troubleshooting
- Restricted to development directories
- Metrics enabled for optimization

### Production Environment
```json
{
  "BEEP_BOOP_DEFAULT_MAX_AGE_HOURS": "24",
  "BEEP_BOOP_AUTO_CLEANUP_ENABLED": "false",
  "BEEP_BOOP_LOG_LEVEL": "info",
  "BEEP_BOOP_BACKUP_ENABLED": "true",
  "BEEP_BOOP_AUDIT_LOG_ENABLED": "true",
  "BEEP_BOOP_BLOCKED_DIRECTORIES": "/tmp,/var,/etc,node_modules"
}
```

**Features:**
- Conservative 24-hour timeout
- Manual cleanup for safety
- Full audit trail
- Comprehensive directory protection
- Backup enabled for recovery

### CI/CD Environment
```json
{
  "BEEP_BOOP_DEFAULT_MAX_AGE_HOURS": "0.5",
  "BEEP_BOOP_AUTO_CLEANUP_ENABLED": "true",
  "BEEP_BOOP_FORCE_CLEANUP_ON_START": "true",
  "BEEP_BOOP_LOG_LEVEL": "warn",
  "BEEP_BOOP_MAX_CONCURRENT_OPERATIONS": "10"
}
```

**Features:**
- Aggressive 30-minute timeout
- Force cleanup on start for clean builds
- High concurrency for speed
- Minimal logging to reduce noise
- Auto-cleanup for unattended operation

### Enterprise Environment
```json
{
  "BEEP_BOOP_REQUIRE_TEAM_PREFIX": "true",
  "BEEP_BOOP_TEAM_PREFIXES": "frontend-,backend-,devops-,qa-",
  "BEEP_BOOP_AUDIT_LOG_ENABLED": "true",
  "BEEP_BOOP_ENABLE_NOTIFICATIONS": "true",
  "BEEP_BOOP_ESCALATION_ENABLED": "true",
  "BEEP_BOOP_TIMEZONE": "America/New_York"
}
```

**Features:**
- Team-based agent ID requirements
- Full audit logging for compliance
- Webhook notifications for monitoring
- Automatic escalation for stuck work
- Timezone-aware operations

## 🔧 Advanced Configuration

### Directory Access Control

**Allow only specific directories:**
```bash
BEEP_BOOP_ALLOWED_DIRECTORIES="./src,./packages,./services"
```

**Block sensitive directories:**
```bash
BEEP_BOOP_BLOCKED_DIRECTORIES="/tmp,/var,/etc,node_modules,dist,.git"
```

### Team-Based Agent IDs

**Require team prefixes:**
```bash
BEEP_BOOP_REQUIRE_TEAM_PREFIX=true
BEEP_BOOP_TEAM_PREFIXES="frontend-,backend-,devops-,mobile-"
```

**Valid agent IDs:** `frontend-alice`, `backend-bob`, `devops-charlie`  
**Invalid agent IDs:** `alice`, `random-agent`, `contractor-dave`

### Webhook Notifications

**Slack integration:**
```bash
BEEP_BOOP_ENABLE_NOTIFICATIONS=true
BEEP_BOOP_NOTIFICATION_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

**Discord integration:**
```bash
BEEP_BOOP_NOTIFICATION_WEBHOOK="https://discord.com/api/webhooks/YOUR/WEBHOOK"
```

### Audit Logging

**Enable comprehensive audit trail:**
```bash
BEEP_BOOP_AUDIT_LOG_ENABLED=true
BEEP_BOOP_AUDIT_LOG_PATH="./logs/coordination-$(date +%Y-%m).log"
```

**Log format:**
```
2024-08-20T12:30:00Z [INFO] CLAIM ./src/auth agent:frontend-alice desc:"Auth refactoring"
2024-08-20T14:15:00Z [INFO] COMPLETE ./src/auth agent:frontend-alice msg:"Refactoring done"
2024-08-20T15:00:00Z [WARN] STALE_DETECTED ./src/components age:25h agent:backend-bob
```

## 🐛 Debugging

### Enable Debug Logging
```bash
BEEP_BOOP_LOG_LEVEL=debug
```

### Configuration Validation
The server validates all configuration on startup and provides helpful error messages:

```bash
❌ BEEP_BOOP_DEFAULT_MAX_AGE_HOURS must be >= 0
❌ BEEP_BOOP_LOG_LEVEL must be one of: error, warn, info, debug  
❌ BEEP_BOOP_FILE_PERMISSIONS must be in octal format (e.g., 0644)
```

### Configuration Summary
In debug mode, the server prints a configuration summary on startup:

```
📋 Beep/Boop Configuration:
   • Environment: development
   • Max age threshold: 1 hours
   • Auto cleanup: enabled
   • Log level: debug
   • Allowed directories: ./src, ./test, ./examples
   • Blocked directories: /tmp, /var, /etc, node_modules
   • Team prefix required: false
   • Backup enabled: false
   • Audit logging: false
```

## 🔄 Runtime Configuration

### Hot Reload (Development)
```bash
BEEP_BOOP_WATCH_MODE=true
```
Automatically reloads configuration when environment files change.

### Configuration Override
Environment variables always take precedence over configuration files:

```bash
# Override single setting
BEEP_BOOP_DEFAULT_MAX_AGE_HOURS=12 npm start

# Override multiple settings
BEEP_BOOP_AUTO_CLEANUP_ENABLED=true BEEP_BOOP_LOG_LEVEL=debug npm start
```

## 📚 Best Practices

### Security
1. **Restrict directories:** Always set `BEEP_BOOP_ALLOWED_DIRECTORIES` in production
2. **Block sensitive paths:** Include system directories in `BEEP_BOOP_BLOCKED_DIRECTORIES`
3. **Use team prefixes:** Enable `BEEP_BOOP_REQUIRE_TEAM_PREFIX` for multi-team environments
4. **Enable audit logging:** Set `BEEP_BOOP_AUDIT_LOG_ENABLED=true` for compliance

### Performance
1. **Adjust concurrency:** Increase `BEEP_BOOP_MAX_CONCURRENT_OPERATIONS` for high-throughput environments
2. **Optimize timeouts:** Use shorter `BEEP_BOOP_DEFAULT_MAX_AGE_HOURS` in fast-paced development
3. **Disable backups:** Set `BEEP_BOOP_BACKUP_ENABLED=false` in CI/CD for speed

### Reliability
1. **Enable notifications:** Use `BEEP_BOOP_NOTIFICATION_WEBHOOK` for critical environments
2. **Configure escalation:** Set up `BEEP_BOOP_ESCALATION_ENABLED` for stuck work detection
3. **Use backups:** Keep `BEEP_BOOP_BACKUP_ENABLED=true` in production

This comprehensive configuration system makes the Beep/Boop MCP server highly adaptable to different environments and organizational requirements!
