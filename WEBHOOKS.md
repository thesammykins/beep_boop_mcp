# Webhook Notifications

The Beep/Boop MCP Server supports real-time webhook notifications to Discord and Slack channels. This allows teams to monitor coordination activities across their codebase and receive instant updates when work is started, completed, or when stale work is detected.

## 🚀 Quick Start

1. **Enable notifications:**
   ```bash
   export BEEP_BOOP_ENABLE_NOTIFICATIONS=true
   ```

2. **Configure webhook URLs:**
   ```bash
   # For Discord
   export BEEP_BOOP_DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
   
   # For Slack
   export BEEP_BOOP_SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR_WEBHOOK_URL"
   ```

3. **Test the integration:**
   ```bash
   npm run test:webhooks
   ```

## 📋 Configuration

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `BEEP_BOOP_ENABLE_NOTIFICATIONS` | Enable/disable notifications | `false` | `true` |
| `BEEP_BOOP_DISCORD_WEBHOOK_URL` | Discord webhook URL | - | `https://discord.com/api/webhooks/...` |
| `BEEP_BOOP_SLACK_WEBHOOK_URL` | Slack webhook URL | - | `https://hooks.slack.com/services/...` |
| `BEEP_BOOP_NOTIFICATION_SERVICE` | Which service to use | `both` | `discord`, `slack`, `both` |
| `BEEP_BOOP_NOTIFICATION_RETRY_ATTEMPTS` | Retry failed webhooks | `3` | `5` |
| `BEEP_BOOP_NOTIFICATION_TIMEOUT_MS` | Webhook timeout | `5000` | `3000` |

### Legacy Support

For backward compatibility, you can still use:
```bash
export BEEP_BOOP_NOTIFICATION_WEBHOOK="https://your.webhook.url"
```

The system will auto-detect if it's a Discord or Slack webhook based on the URL format.

## 🔧 Setting Up Webhooks

### Discord Setup

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **Create Webhook**
4. Choose the channel and copy the webhook URL
5. Set `BEEP_BOOP_DISCORD_WEBHOOK_URL` to this URL

### Slack Setup

1. Go to your Slack workspace
2. Visit **Apps** → **Incoming Webhooks**
3. Click **Add to Slack**
4. Choose the channel and copy the webhook URL
5. Set `BEEP_BOOP_SLACK_WEBHOOK_URL` to this URL

## 📨 Notification Types

The system sends notifications for these events:

### 🔵 Work Started
Triggered when an agent claims a directory with `update_boop`:
- Agent ID
- Directory path
- Work description
- Timestamp

### ✅ Work Completed
Triggered when work is finished with `end_work`:
- Agent ID
- Directory path
- Completion message
- Work duration (if available)

### ⚠️ Stale Work Detected
Triggered during `check_status` when old boop files are found:
- Original agent ID
- Directory path
- File age
- Age threshold

### 🧹 Cleanup Performed
Triggered when stale work is automatically cleaned up:
- Previous agent
- New claiming agent (if any)
- Directory path
- Cleanup details

## 🎨 Message Format

### Discord Messages
Discord notifications use rich formatting with:
- **Bold** headers for event types
- `Code blocks` for directory paths
- **Agent names** highlighted
- Timestamps in ISO format

Example:
```
🔵 **Work Started**
📁 **Directory:** `./src/auth-service/`
👤 **Agent:** frontend-alice
📝 **Work:** Refactoring authentication flow
🕒 **Time:** 2024-08-20T10:30:00.000Z
```

### Slack Messages
Slack notifications use structured attachments with:
- Color-coded sidebar (green for success, orange for warnings, etc.)
- Organized fields for easy scanning
- Footer with server identification
- Unix timestamps for proper time display

## ⚡ Error Handling & Reliability

### Circuit Breaker Pattern
- Failed webhooks are automatically retried up to `BEEP_BOOP_NOTIFICATION_RETRY_ATTEMPTS` times
- After multiple failures, the circuit breaker opens to prevent spam
- Circuit breaker auto-resets after 5 minutes

### Non-blocking Operations
- Webhook failures **never** block coordination operations
- Notifications are sent asynchronously in the background
- Failed notifications are logged but don't affect main functionality

### Fallback Logging
When webhooks fail, notifications are logged to stderr in JSON format for external monitoring:
```json
{
  "timestamp": "2024-08-20T10:30:00.000Z",
  "service": "discord",
  "type": "work_started",
  "directory": "./src/auth",
  "agentId": "frontend-alice",
  "error": "Connection timeout"
}
```

## 🔍 Testing & Debugging

### Test Webhook Integration
```bash
# Run comprehensive webhook tests
npm run test:webhooks

# Enable debug logging
export BEEP_BOOP_LOG_LEVEL=debug
npm start
```

### Debug Output
With debug logging enabled, you'll see:
- Webhook payload construction
- Successful delivery confirmations with response times
- Detailed error information for failed attempts
- Circuit breaker state changes

Example debug output:
```
📤 Sending Discord notification: {"text":"🔵 Work Started",...}
✅ Discord notification sent successfully (234ms)
⚡ Circuit breaker opened for slack notifications after 3 failures
🔄 Circuit breaker reset for slack notifications
```

## 📊 Monitoring & Metrics

### Audit Logging
When `BEEP_BOOP_AUDIT_LOG_ENABLED=true`, all notification events are logged:
```
2024-08-20T10:30:00Z [INFO] NOTIFICATION DISCORD work_started ./src/auth agent:alice status:success duration:234ms
2024-08-20T10:31:00Z [WARN] NOTIFICATION SLACK work_started ./src/auth agent:alice status:failed error:"timeout"
```

### Performance Metrics
- Notification send duration is tracked and logged
- Success/failure rates are monitored
- Circuit breaker state changes are recorded

## 🔒 Security Considerations

### Webhook URL Protection
- Never commit webhook URLs to version control
- Use environment variables or secure secret management
- Rotate webhook URLs periodically

### Content Filtering
- Directory paths are included in notifications
- Agent IDs are displayed
- Work descriptions are sent as provided
- Consider sensitive information in work descriptions

### Rate Limiting
- Built-in delays between notifications during testing
- Respects Discord/Slack rate limits
- Circuit breaker prevents spam during outages

## 🛠️ Advanced Configuration

### Custom Notification Service
```bash
# Send only to Discord
export BEEP_BOOP_NOTIFICATION_SERVICE=discord

# Send only to Slack
export BEEP_BOOP_NOTIFICATION_SERVICE=slack

# Send to both (default)
export BEEP_BOOP_NOTIFICATION_SERVICE=both
```

### Fine-tuning Reliability
```bash
# Reduce retries for faster failure detection
export BEEP_BOOP_NOTIFICATION_RETRY_ATTEMPTS=1

# Increase timeout for slow networks
export BEEP_BOOP_NOTIFICATION_TIMEOUT_MS=10000
```

### Integration with CI/CD
```yaml
# GitHub Actions example
env:
  BEEP_BOOP_ENABLE_NOTIFICATIONS: true
  BEEP_BOOP_DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK }}
  BEEP_BOOP_NOTIFICATION_SERVICE: discord
  BEEP_BOOP_NOTIFICATION_RETRY_ATTEMPTS: 1
```

## 🤝 Contributing

To add support for additional webhook services:

1. Extend the `NotificationService` type in `src/notification-service.ts`
2. Add new webhook client initialization in `NotificationManager`
3. Implement service-specific formatting methods
4. Update configuration system in `src/config.ts`
5. Add tests to the test suite

## 🔗 Related Documentation

- [Configuration Guide](./docs/CONFIGURATION.md) - Complete configuration reference
- [MCP Protocol](https://github.com/modelcontextprotocol/sdk) - Model Context Protocol documentation
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook) - Discord webhook API
- [Slack Webhooks](https://api.slack.com/messaging/webhooks) - Slack incoming webhooks

---

💡 **Pro Tip**: Use different webhook channels for different environments (dev/staging/prod) to keep notifications organized and relevant to each team!
