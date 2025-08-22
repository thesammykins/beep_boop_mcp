/**
 * Configuration management for the beep/boop coordination system
 */

import os from 'os';
import path from 'path';

export interface BeepBoopConfig {
  // Core settings
  defaultMaxAgeHours: number;
  autoCleanupEnabled: boolean;
  maxAgentIdLength: number;
  filePermissions: string;
  
  // Logging and debugging
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  timezone: string;
  
  // Security and access control
  allowedDirectories: string[];
  blockedDirectories: string[];
  requireTeamPrefix: boolean;
  teamPrefixes: string[];
  
  // Backup and recovery
  backupEnabled: boolean;
  backupDir: string;
  
  // Monitoring and metrics
  enableMetrics: boolean;
  enableNotifications: boolean;
  notificationWebhook?: string; // Legacy - backward compatibility
  
  // Webhook notifications
  notificationService: 'discord' | 'slack' | 'both';
  discordWebhookUrl?: string;
  slackWebhookUrl?: string;
  notificationRetryAttempts: number;
  notificationTimeoutMs: number;
  
  // Audit and compliance
  auditLogEnabled: boolean;
  auditLogPath: string;
  
  // Work management
  maxWorkDurationHours: number;
  warnThresholdHours: number;
  escalationEnabled: boolean;
  escalationAfterHours: number;
  
  // Environment-specific
  devMode: boolean;
  ciMode: boolean;
  watchMode: boolean;
  forceCleanupOnStart: boolean;
  failOnStale: boolean;
  maxConcurrentOperations: number;
  
  // Git integration
  manageGitIgnore: boolean;

  // Ingress listener feature (capture & local HTTP)
  ingressEnabled: boolean;
  ingressProvider: 'slack' | 'discord' | 'none';
  ingressHttpEnabled: boolean;
  ingressHttpPort: number;
  ingressHttpAuthToken?: string;
  ingressInboxDir: string;

  // Central HTTP listener delegation (synchronous request/response)
  listenerEnabled: boolean;
  listenerBaseUrl?: string;
  listenerAuthToken?: string;
  listenerTimeoutBaseMs: number;
  listenerTimeoutPerCharMs: number; // adaptive wait for larger responses
  listenerTimeoutMaxMs: number; // hard cap
  maxConcurrentListenerRequests: number;

  // Slack (Socket Mode)
  slackAppToken?: string; // xapp-... (Socket Mode)
  slackBotToken?: string; // xoxb-...

  // Discord
  discordBotToken?: string;
  discordDefaultChannelId?: string; // Channel for proactive agent messaging
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): BeepBoopConfig {
  const config: BeepBoopConfig = {
    // Core settings
    defaultMaxAgeHours: parseFloat(process.env.BEEP_BOOP_DEFAULT_MAX_AGE_HOURS || '24'),
    autoCleanupEnabled: process.env.BEEP_BOOP_AUTO_CLEANUP_ENABLED === 'true',
    maxAgentIdLength: parseInt(process.env.BEEP_BOOP_MAX_AGENT_ID_LENGTH || '100', 10),
    filePermissions: process.env.BEEP_BOOP_FILE_PERMISSIONS || '0644',
    
    // Logging and debugging
    logLevel: (process.env.BEEP_BOOP_LOG_LEVEL || 'info') as BeepBoopConfig['logLevel'],
    timezone: process.env.BEEP_BOOP_TIMEZONE || 'UTC',
    
    // Security and access control
    allowedDirectories: parseDirectories(process.env.BEEP_BOOP_ALLOWED_DIRECTORIES),
    blockedDirectories: parseDirectories(process.env.BEEP_BOOP_BLOCKED_DIRECTORIES || '/tmp,/var,/etc'),
    requireTeamPrefix: process.env.BEEP_BOOP_REQUIRE_TEAM_PREFIX === 'true',
    teamPrefixes: parseList(process.env.BEEP_BOOP_TEAM_PREFIXES),
    
    // Backup and recovery
    backupEnabled: process.env.BEEP_BOOP_BACKUP_ENABLED === 'true',
    backupDir: process.env.BEEP_BOOP_BACKUP_DIR || './.beep-boop-backups',
    
    // Monitoring and metrics
    enableMetrics: process.env.BEEP_BOOP_ENABLE_METRICS === 'true',
    enableNotifications: process.env.BEEP_BOOP_ENABLE_NOTIFICATIONS === 'true',
    notificationWebhook: process.env.BEEP_BOOP_NOTIFICATION_WEBHOOK,
    
    // Webhook notifications
    notificationService: (process.env.BEEP_BOOP_NOTIFICATION_SERVICE || 'both') as BeepBoopConfig['notificationService'],
    discordWebhookUrl: process.env.BEEP_BOOP_DISCORD_WEBHOOK_URL,
    slackWebhookUrl: process.env.BEEP_BOOP_SLACK_WEBHOOK_URL,
    notificationRetryAttempts: parseInt(process.env.BEEP_BOOP_NOTIFICATION_RETRY_ATTEMPTS || '3', 10),
    notificationTimeoutMs: parseInt(process.env.BEEP_BOOP_NOTIFICATION_TIMEOUT_MS || '5000', 10),
    
    // Audit and compliance
    auditLogEnabled: process.env.BEEP_BOOP_AUDIT_LOG_ENABLED === 'true',
    auditLogPath: process.env.BEEP_BOOP_AUDIT_LOG_PATH || './logs/coordination-audit.log',
    
    // Work management
    maxWorkDurationHours: parseFloat(process.env.BEEP_BOOP_MAX_WORK_DURATION_HOURS || '48'),
    warnThresholdHours: parseFloat(process.env.BEEP_BOOP_WARN_THRESHOLD_HOURS || '8'),
    escalationEnabled: process.env.BEEP_BOOP_ESCALATION_ENABLED === 'true',
    escalationAfterHours: parseFloat(process.env.BEEP_BOOP_ESCALATION_AFTER_HOURS || '24'),
    
    // Environment-specific
    devMode: process.env.BEEP_BOOP_DEV_MODE === 'true' || process.env.NODE_ENV === 'development',
    ciMode: process.env.BEEP_BOOP_CI_MODE === 'true' || process.env.CI === 'true',
    watchMode: process.env.BEEP_BOOP_WATCH_MODE === 'true',
    forceCleanupOnStart: process.env.BEEP_BOOP_FORCE_CLEANUP_ON_START === 'true',
    failOnStale: process.env.BEEP_BOOP_FAIL_ON_STALE === 'true',
    maxConcurrentOperations: parseInt(process.env.BEEP_BOOP_MAX_CONCURRENT_OPERATIONS || '5', 10),
    
    // Git integration
    manageGitIgnore: process.env.BEEP_BOOP_MANAGE_GITIGNORE !== 'false', // Default to true

    // Ingress listener feature
    ingressEnabled: process.env.BEEP_BOOP_INGRESS_ENABLED === 'true',
    ingressProvider: (process.env.BEEP_BOOP_INGRESS_PROVIDER || 'none') as BeepBoopConfig['ingressProvider'],
    ingressHttpEnabled: process.env.BEEP_BOOP_INGRESS_HTTP_ENABLED !== 'false',
    ingressHttpPort: parseInt(process.env.BEEP_BOOP_INGRESS_HTTP_PORT || '7077', 10),
    ingressHttpAuthToken: process.env.BEEP_BOOP_INGRESS_HTTP_AUTH_TOKEN,
    ingressInboxDir: process.env.BEEP_BOOP_INGRESS_INBOX_DIR || path.join(os.homedir(), '.beep-boop-inbox'),

    // Central HTTP listener delegation (synchronous request/response)
    listenerEnabled: process.env.BEEP_BOOP_LISTENER_ENABLED === 'true',
    listenerBaseUrl: process.env.BEEP_BOOP_LISTENER_BASE_URL || `http://localhost:${process.env.BEEP_BOOP_INGRESS_HTTP_PORT || '7077'}`,
    listenerAuthToken: process.env.BEEP_BOOP_LISTENER_AUTH_TOKEN,
    listenerTimeoutBaseMs: parseInt(process.env.BEEP_BOOP_LISTENER_TIMEOUT_BASE_MS || '10000', 10),
    listenerTimeoutPerCharMs: parseInt(process.env.BEEP_BOOP_LISTENER_TIMEOUT_PER_CHAR_MS || '5', 10),
    listenerTimeoutMaxMs: parseInt(process.env.BEEP_BOOP_LISTENER_TIMEOUT_MAX_MS || '60000', 10),
    maxConcurrentListenerRequests: parseInt(process.env.BEEP_BOOP_MAX_CONCURRENT_LISTENER_REQUESTS || '25', 10),

    // Slack
    slackAppToken: process.env.BEEP_BOOP_SLACK_APP_TOKEN,
    slackBotToken: process.env.BEEP_BOOP_SLACK_BOT_TOKEN,

    // Discord
    discordBotToken: process.env.BEEP_BOOP_DISCORD_BOT_TOKEN,
    discordDefaultChannelId: process.env.BEEP_BOOP_DISCORD_DEFAULT_CHANNEL_ID
  };
  
  // Handle backward compatibility for legacy webhook config
  handleLegacyWebhookConfig(config);

  // If listener is targeting local ingress and no explicit listener token provided, reuse ingress token
  try {
    const defaultLocalBase = `http://localhost:${config.ingressHttpPort}`;
    if (config.listenerEnabled && !config.listenerAuthToken && config.listenerBaseUrl && config.listenerBaseUrl.startsWith(defaultLocalBase) && config.ingressHttpAuthToken) {
      config.listenerAuthToken = config.ingressHttpAuthToken;
      if (config.logLevel === 'debug') {
        console.error('🔐 Using ingress HTTP auth token for listener requests');
      }
    }
  } catch {}
  
  // Validate configuration
  validateConfig(config);
  
  return config;
}

/**
 * Parse directory list from environment variable
 */
function parseDirectories(envVar?: string): string[] {
  if (!envVar) return [];
  return envVar.split(',').map(dir => dir.trim()).filter(dir => dir.length > 0);
}

/**
 * Parse comma-separated list from environment variable
 */
function parseList(envVar?: string): string[] {
  if (!envVar) return [];
  return envVar.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Validate configuration values
 */
function validateConfig(config: BeepBoopConfig): void {
  // Validate age thresholds
  if (config.defaultMaxAgeHours < 0) {
    throw new Error('BEEP_BOOP_DEFAULT_MAX_AGE_HOURS must be >= 0');
  }
  
  if (config.maxWorkDurationHours < config.defaultMaxAgeHours) {
    throw new Error('BEEP_BOOP_MAX_WORK_DURATION_HOURS must be >= BEEP_BOOP_DEFAULT_MAX_AGE_HOURS');
  }
  
  // Validate agent ID length
  if (config.maxAgentIdLength < 1 || config.maxAgentIdLength > 500) {
    throw new Error('BEEP_BOOP_MAX_AGENT_ID_LENGTH must be between 1 and 500');
  }
  
  // Validate log level
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new Error(`BEEP_BOOP_LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`);
  }
  
  // Validate file permissions
  if (!/^0[0-7]{3}$/.test(config.filePermissions)) {
    throw new Error('BEEP_BOOP_FILE_PERMISSIONS must be in octal format (e.g., 0644)');
  }
  
  // Validate concurrent operations
  if (config.maxConcurrentOperations < 1 || config.maxConcurrentOperations > 100) {
    throw new Error('BEEP_BOOP_MAX_CONCURRENT_OPERATIONS must be between 1 and 100');
  }

  // Validate ingress provider selection
  const validProviders = ['slack', 'discord', 'none'];
  if (!validProviders.includes(config.ingressProvider)) {
    throw new Error('BEEP_BOOP_INGRESS_PROVIDER must be one of slack, discord, none');
  }
  if (config.ingressEnabled && config.ingressProvider === 'none') {
    throw new Error('Ingress enabled but no provider selected. Set BEEP_BOOP_INGRESS_PROVIDER=slack or discord');
  }

  // Validate listener delegation
  if (config.listenerEnabled) {
    if (!config.listenerBaseUrl || !/^https?:\/\//.test(config.listenerBaseUrl)) {
      throw new Error('BEEP_BOOP_LISTENER_BASE_URL must be set to a valid http(s) URL when BEEP_BOOP_LISTENER_ENABLED=true');
    }
    if (config.maxConcurrentListenerRequests < 1 || config.maxConcurrentListenerRequests > 500) {
      throw new Error('BEEP_BOOP_MAX_CONCURRENT_LISTENER_REQUESTS must be between 1 and 500');
    }
    if (config.listenerTimeoutBaseMs < 1000 || config.listenerTimeoutMaxMs < config.listenerTimeoutBaseMs) {
      throw new Error('Listener timeout values are invalid. Ensure base >= 1000 and max >= base.');
    }
  }
}

/**
 * Check if a directory path is allowed based on configuration
 */
export function isDirectoryAllowed(path: string, config: BeepBoopConfig): boolean {
  // Check blocked directories first
  for (const blocked of config.blockedDirectories) {
    if (path.startsWith(blocked)) {
      return false;
    }
  }
  
  // If allowedDirectories is empty, allow all (except blocked)
  if (config.allowedDirectories.length === 0) {
    return true;
  }
  
  // Check if path starts with any allowed directory
  return config.allowedDirectories.some(allowed => path.startsWith(allowed));
}

/**
 * Check if an agent ID follows team prefix requirements
 */
export function validateAgentIdPrefix(agentId: string, config: BeepBoopConfig): boolean {
  if (!config.requireTeamPrefix) {
    return true;
  }
  
  if (config.teamPrefixes.length === 0) {
    return true;
  }
  
  return config.teamPrefixes.some(prefix => agentId.startsWith(prefix));
}

/**
 * Get environment-specific default values
 */
export function getEnvironmentDefaults(): Partial<BeepBoopConfig> {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'development':
      return {
        defaultMaxAgeHours: 1,
        autoCleanupEnabled: true,
        logLevel: 'debug',
        backupEnabled: false,
        devMode: true
      };
      
    case 'test':
      return {
        defaultMaxAgeHours: 0.1, // 6 minutes
        autoCleanupEnabled: true,
        logLevel: 'warn',
        backupEnabled: false,
        forceCleanupOnStart: true
      };
      
    case 'production':
      return {
        defaultMaxAgeHours: 24,
        autoCleanupEnabled: false,
        logLevel: 'info',
        backupEnabled: true,
        auditLogEnabled: true
      };
      
    default:
      return {};
  }
}

/**
 * Handle backward compatibility for legacy webhook configuration
 */
function handleLegacyWebhookConfig(config: BeepBoopConfig): void {
  if (config.notificationWebhook && !config.discordWebhookUrl && !config.slackWebhookUrl) {
    // Legacy BEEP_BOOP_NOTIFICATION_WEBHOOK was set, try to determine service type
    if (config.notificationWebhook.includes('discord.com')) {
      config.discordWebhookUrl = config.notificationWebhook;
      config.notificationService = 'discord';
      if (config.logLevel === 'debug') {
        console.error('⚠️ Using legacy notification webhook as Discord URL');
      }
    } else if (config.notificationWebhook.includes('hooks.slack.com')) {
      config.slackWebhookUrl = config.notificationWebhook;
      config.notificationService = 'slack';
      if (config.logLevel === 'debug') {
        console.error('⚠️ Using legacy notification webhook as Slack URL');
      }
    } else {
      // Unknown service, default to Slack format
      config.slackWebhookUrl = config.notificationWebhook;
      config.notificationService = 'slack';
      if (config.logLevel === 'debug') {
        console.error('⚠️ Using legacy notification webhook as Slack URL (default)');
      }
    }
  }
}

/**
 * Check if webhook URLs are valid format
 */
export function validateWebhookUrls(config: BeepBoopConfig): string[] {
  const errors: string[] = [];
  
  if (config.discordWebhookUrl && !config.discordWebhookUrl.includes('discord.com/api/webhooks')) {
    errors.push('Discord webhook URL must be a valid Discord webhook URL');
  }
  
  if (config.slackWebhookUrl && !config.slackWebhookUrl.includes('hooks.slack.com')) {
    errors.push('Slack webhook URL must be a valid Slack webhook URL');
  }
  
  return errors;
}

/**
 * Print configuration summary (for debugging)
 */
export function printConfigSummary(config: BeepBoopConfig): void {
  if (config.logLevel === 'debug') {
    console.error('📋 Beep/Boop Configuration:');
    console.error(`   • Environment: ${process.env.NODE_ENV || 'development'}`);
    console.error(`   • Max age threshold: ${config.defaultMaxAgeHours} hours`);
    console.error(`   • Auto cleanup: ${config.autoCleanupEnabled ? 'enabled' : 'disabled'}`);
    console.error(`   • Log level: ${config.logLevel}`);
    console.error(`   • Allowed directories: ${config.allowedDirectories.length === 0 ? 'all (except blocked)' : config.allowedDirectories.join(', ')}`);
    console.error(`   • Blocked directories: ${config.blockedDirectories.join(', ')}`);
    console.error(`   • Team prefix required: ${config.requireTeamPrefix}`);
    console.error(`   • Backup enabled: ${config.backupEnabled}`);
    console.error(`   • Audit logging: ${config.auditLogEnabled}`);
    console.error(`   • Notifications: ${config.enableNotifications ? 'enabled' : 'disabled'}`);
    if (config.enableNotifications) {
      console.error(`   • Notification service: ${config.notificationService}`);
      console.error(`   • Discord webhook: ${config.discordWebhookUrl ? 'configured' : 'not configured'}`);
      console.error(`   • Slack webhook: ${config.slackWebhookUrl ? 'configured' : 'not configured'}`);
      console.error(`   • Retry attempts: ${config.notificationRetryAttempts}`);
      console.error(`   • Timeout: ${config.notificationTimeoutMs}ms`);
    }
    console.error(`   • Git integration: ${config.manageGitIgnore ? 'enabled' : 'disabled'}`);
    console.error(`   • Ingress: ${config.ingressEnabled ? 'enabled' : 'disabled'} (${config.ingressProvider})`);
    if (config.ingressEnabled) {
      console.error(`   • Ingress HTTP: ${config.ingressHttpEnabled ? `enabled on port ${config.ingressHttpPort}` : 'disabled'}`);
      console.error(`   • Inbox dir: ${config.ingressInboxDir}`);
      console.error(`   • Slack Socket Mode: ${config.slackAppToken && config.slackBotToken ? 'configured' : 'not configured'}`);
      console.error(`   • Discord Bot: ${config.discordBotToken ? 'configured' : 'not configured'}`);
      if (config.discordBotToken && config.discordDefaultChannelId) {
        console.error(`   • Discord Default Channel: ${config.discordDefaultChannelId}`);
      }
    }
    console.error(`   • Central Listener: ${config.listenerEnabled ? `enabled (${config.listenerBaseUrl})` : 'disabled'}`);
    if (config.listenerEnabled) {
      console.error(`   • Listener timeouts: base=${config.listenerTimeoutBaseMs}ms, perChar=${config.listenerTimeoutPerCharMs}ms, max=${config.listenerTimeoutMaxMs}ms`);
      console.error(`   • Max concurrent listener requests: ${config.maxConcurrentListenerRequests}`);
    }
  }
}
