/**
 * Configuration management for the beep/boop coordination system
 */

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
  notificationWebhook?: string;
  
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
    manageGitIgnore: process.env.BEEP_BOOP_MANAGE_GITIGNORE !== 'false' // Default to true
  };
  
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
    console.error(`   • Git integration: ${config.manageGitIgnore ? 'enabled' : 'disabled'}`);
  }
}
