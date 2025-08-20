/**
 * Notification service for sending webhook notifications to Discord and Slack
 */

import { IncomingWebhook } from '@slack/webhook';
import { Webhook, MessageBuilder } from 'discord-webhook-node';
import { BeepBoopConfig } from './config.js';

/** Supported notification services */
export type NotificationService = 'discord' | 'slack' | 'both';

/** Notification types for different events */
export enum NotificationType {
  WORK_STARTED = 'work_started',
  WORK_COMPLETED = 'work_completed', 
  WORK_FAILED = 'work_failed',
  STALE_DETECTED = 'stale_detected',
  CLEANUP_PERFORMED = 'cleanup_performed',
  ERROR = 'error'
}

/** Notification payload interface */
export interface NotificationPayload {
  type: NotificationType;
  message: string;
  directory: string;
  agentId?: string;
  workDescription?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/** Circuit breaker state for failed webhooks */
interface CircuitBreakerState {
  failures: number;
  lastFailure?: Date;
  isOpen: boolean;
}

/**
 * Main notification service class
 */
export class NotificationManager {
  private slackWebhook?: IncomingWebhook;
  private discordWebhook?: Webhook;
  private config: BeepBoopConfig;
  private circuitBreakerState: Map<string, CircuitBreakerState> = new Map();

  constructor(config: BeepBoopConfig) {
    this.config = config;
    this.initializeWebhooks();
  }

  /**
   * Initialize webhook clients based on configuration
   */
  private initializeWebhooks(): void {
    // Initialize Slack webhook if URL is provided
    if (this.config.slackWebhookUrl) {
      try {
        this.slackWebhook = new IncomingWebhook(this.config.slackWebhookUrl);
        if (this.config.logLevel === 'debug') {
          console.error('🔗 Slack webhook initialized');
        }
      } catch (error) {
        console.error(`❌ Failed to initialize Slack webhook: ${error}`);
      }
    }

    // Initialize Discord webhook if URL is provided
    if (this.config.discordWebhookUrl) {
      try {
        this.discordWebhook = new Webhook(this.config.discordWebhookUrl);
        this.discordWebhook.setUsername('Beep/Boop Coordinator');
        this.discordWebhook.setAvatar('https://cdn-icons-png.flaticon.com/512/3062/3062634.png');
        if (this.config.logLevel === 'debug') {
          console.error('🔗 Discord webhook initialized');
        }
      } catch (error) {
        console.error(`❌ Failed to initialize Discord webhook: ${error}`);
      }
    }

    // Initialize circuit breaker states
    if (this.slackWebhook) {
      this.circuitBreakerState.set('slack', { failures: 0, isOpen: false });
    }
    if (this.discordWebhook) {
      this.circuitBreakerState.set('discord', { failures: 0, isOpen: false });
    }
  }

  /**
   * Send notification to configured services
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    if (!this.config.enableNotifications) {
      if (this.config.logLevel === 'debug') {
        console.error('📵 Notifications disabled, skipping');
      }
      return;
    }

    const promises: Promise<void>[] = [];

    // Determine which services to send to
    const services = this.getTargetServices();

    for (const service of services) {
      if (service === 'slack' && this.slackWebhook) {
        promises.push(this.sendSlackNotification(payload));
      } else if (service === 'discord' && this.discordWebhook) {
        promises.push(this.sendDiscordNotification(payload));
      }
    }

    // Send all notifications concurrently but don't fail if some fail
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  /**
   * Send notification to Slack
   */
  private async sendSlackNotification(payload: NotificationPayload): Promise<void> {
    if (!this.slackWebhook || this.isCircuitBreakerOpen('slack')) {
      return;
    }

    const startTime = Date.now();

    try {
      const slackMessage = this.formatSlackMessage(payload);
      
      if (this.config.logLevel === 'debug') {
        console.error(`📤 Sending Slack notification: ${JSON.stringify(slackMessage)}`);
      }

      await this.slackWebhook.send(slackMessage);
      
      // Reset circuit breaker on success
      this.resetCircuitBreaker('slack');

      const duration = Date.now() - startTime;
      if (this.config.logLevel === 'debug') {
        console.error(`✅ Slack notification sent successfully (${duration}ms)`);
      }

      // Log to audit if enabled
      if (this.config.auditLogEnabled) {
        this.logNotificationAudit('slack', payload, 'success', duration);
      }

    } catch (error) {
      this.handleWebhookError('slack', error, payload);
    }
  }

  /**
   * Send notification to Discord
   */
  private async sendDiscordNotification(payload: NotificationPayload): Promise<void> {
    if (!this.discordWebhook || this.isCircuitBreakerOpen('discord')) {
      return;
    }

    const startTime = Date.now();

    try {
      const discordMessage = this.formatDiscordMessage(payload);
      
      if (this.config.logLevel === 'debug') {
        console.error(`📤 Sending Discord notification: ${discordMessage}`);
      }

      await this.discordWebhook.send(discordMessage);
      
      // Reset circuit breaker on success
      this.resetCircuitBreaker('discord');

      const duration = Date.now() - startTime;
      if (this.config.logLevel === 'debug') {
        console.error(`✅ Discord notification sent successfully (${duration}ms)`);
      }

      // Log to audit if enabled
      if (this.config.auditLogEnabled) {
        this.logNotificationAudit('discord', payload, 'success', duration);
      }

    } catch (error) {
      this.handleWebhookError('discord', error, payload);
    }
  }

  /**
   * Format message for Slack
   */
  private formatSlackMessage(payload: NotificationPayload): any {
    const emoji = this.getEmojiForType(payload.type);
    const color = this.getColorForType(payload.type);
    
    return {
      text: `${emoji} Beep/Boop Coordination Update`,
      attachments: [
        {
          color: color,
          fields: [
            {
              title: 'Event',
              value: this.formatEventTitle(payload.type),
              short: true
            },
            {
              title: 'Directory',
              value: `\`${payload.directory}\``,
              short: true
            },
            ...(payload.agentId ? [{
              title: 'Agent',
              value: payload.agentId,
              short: true
            }] : []),
            ...(payload.workDescription ? [{
              title: 'Work Description',
              value: payload.workDescription,
              short: false
            }] : []),
            {
              title: 'Time',
              value: payload.timestamp.toISOString(),
              short: true
            }
          ],
          footer: 'Beep/Boop MCP Server',
          ts: Math.floor(payload.timestamp.getTime() / 1000)
        }
      ]
    };
  }

  /**
   * Format message for Discord
   */
  private formatDiscordMessage(payload: NotificationPayload): string {
    const emoji = this.getEmojiForType(payload.type);
    const eventTitle = this.formatEventTitle(payload.type);
    
    let message = `${emoji} **${eventTitle}**\n`;
    message += `📁 **Directory:** \`${payload.directory}\`\n`;
    
    if (payload.agentId) {
      message += `👤 **Agent:** ${payload.agentId}\n`;
    }
    
    if (payload.workDescription) {
      message += `📝 **Work:** ${payload.workDescription}\n`;
    }
    
    message += `🕒 **Time:** ${payload.timestamp.toISOString()}`;
    
    return message;
  }

  /**
   * Get emoji for notification type
   */
  private getEmojiForType(type: NotificationType): string {
    switch (type) {
      case NotificationType.WORK_STARTED:
        return '🔵';
      case NotificationType.WORK_COMPLETED:
        return '✅';
      case NotificationType.WORK_FAILED:
        return '❌';
      case NotificationType.STALE_DETECTED:
        return '⚠️';
      case NotificationType.CLEANUP_PERFORMED:
        return '🧹';
      case NotificationType.ERROR:
        return '💥';
      default:
        return 'ℹ️';
    }
  }

  /**
   * Get color for Slack attachment
   */
  private getColorForType(type: NotificationType): string {
    switch (type) {
      case NotificationType.WORK_STARTED:
        return '#36a64f'; // Green
      case NotificationType.WORK_COMPLETED:
        return '#36a64f'; // Green
      case NotificationType.WORK_FAILED:
        return '#ff0000'; // Red
      case NotificationType.STALE_DETECTED:
        return '#ff9900'; // Orange
      case NotificationType.CLEANUP_PERFORMED:
        return '#0099ff'; // Blue
      case NotificationType.ERROR:
        return '#ff0000'; // Red
      default:
        return '#cccccc'; // Gray
    }
  }

  /**
   * Format event title for display
   */
  private formatEventTitle(type: NotificationType): string {
    switch (type) {
      case NotificationType.WORK_STARTED:
        return 'Work Started';
      case NotificationType.WORK_COMPLETED:
        return 'Work Completed';
      case NotificationType.WORK_FAILED:
        return 'Work Failed';
      case NotificationType.STALE_DETECTED:
        return 'Stale Work Detected';
      case NotificationType.CLEANUP_PERFORMED:
        return 'Cleanup Performed';
      case NotificationType.ERROR:
        return 'Error Occurred';
      default:
        return 'Coordination Event';
    }
  }

  /**
   * Get target services based on configuration
   */
  private getTargetServices(): NotificationService[] {
    if (this.config.notificationService === 'both') {
      const services: NotificationService[] = [];
      if (this.slackWebhook) services.push('slack');
      if (this.discordWebhook) services.push('discord');
      return services;
    } else if (this.config.notificationService === 'slack' && this.slackWebhook) {
      return ['slack'];
    } else if (this.config.notificationService === 'discord' && this.discordWebhook) {
      return ['discord'];
    }
    
    // Fallback: send to all available services
    const services: NotificationService[] = [];
    if (this.slackWebhook) services.push('slack');
    if (this.discordWebhook) services.push('discord');
    return services;
  }

  /**
   * Handle webhook errors with circuit breaker logic
   */
  private handleWebhookError(service: string, error: any, payload: NotificationPayload): void {
    const state = this.circuitBreakerState.get(service);
    if (!state) return;

    state.failures++;
    state.lastFailure = new Date();

    // Open circuit breaker after configured number of failures
    if (state.failures >= this.config.notificationRetryAttempts) {
      state.isOpen = true;
      console.error(`⚡ Circuit breaker opened for ${service} notifications after ${state.failures} failures`);
    }

    // Log the error
    console.error(`❌ ${service} notification failed:`, error);

    // Log to audit if enabled
    if (this.config.auditLogEnabled) {
      this.logNotificationAudit(service, payload, 'failed', 0, error.message);
    }

    // Create fallback local log
    this.logNotificationFallback(service, payload, error);
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(service: string): boolean {
    const state = this.circuitBreakerState.get(service);
    if (!state || !state.isOpen) return false;

    // Auto-reset circuit breaker after 5 minutes
    const resetTime = 5 * 60 * 1000; // 5 minutes
    if (state.lastFailure && (Date.now() - state.lastFailure.getTime()) > resetTime) {
      state.isOpen = false;
      state.failures = 0;
      console.error(`🔄 Circuit breaker reset for ${service} notifications`);
      return false;
    }

    return true;
  }

  /**
   * Reset circuit breaker on successful send
   */
  private resetCircuitBreaker(service: string): void {
    const state = this.circuitBreakerState.get(service);
    if (state) {
      state.failures = 0;
      state.lastFailure = undefined;
      state.isOpen = false;
    }
  }

  /**
   * Log notification to audit file
   */
  private logNotificationAudit(
    service: string,
    payload: NotificationPayload,
    status: 'success' | 'failed',
    duration: number,
    errorMessage?: string
  ): void {
    // This would integrate with the existing audit logging system
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event: 'NOTIFICATION',
      service: service.toUpperCase(),
      type: payload.type,
      directory: payload.directory,
      agentId: payload.agentId,
      status,
      duration,
      error: errorMessage
    };

    if (this.config.logLevel === 'debug') {
      console.error('📋 Audit log entry:', JSON.stringify(auditEntry));
    }
  }

  /**
   * Create fallback log entry when webhook fails
   */
  private logNotificationFallback(service: string, payload: NotificationPayload, error: any): void {
    const fallbackLog = {
      timestamp: new Date().toISOString(),
      service,
      type: payload.type,
      directory: payload.directory,
      agentId: payload.agentId,
      message: payload.message,
      error: error.message
    };

    // Log to stderr as structured JSON for easy parsing
    console.error(`📄 NOTIFICATION_FALLBACK: ${JSON.stringify(fallbackLog)}`);
  }

  /**
   * Create notification payload helper
   */
  static createPayload(
    type: NotificationType,
    message: string,
    directory: string,
    agentId?: string,
    workDescription?: string,
    metadata?: Record<string, any>
  ): NotificationPayload {
    return {
      type,
      message,
      directory,
      agentId,
      workDescription,
      timestamp: new Date(),
      metadata
    };
  }
}

/**
 * Convenience function to create notification manager from config
 */
export function createNotificationManager(config: BeepBoopConfig): NotificationManager {
  return new NotificationManager(config);
}
