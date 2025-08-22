/**
 * Discord API client with retry logic and exponential backoff for reliable API calls
 */

import { BeepBoopConfig } from './config.js';

export interface DiscordApiResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make a Discord API call with retry logic and exponential backoff
 */
export async function callDiscordApiWithRetry<T = any>(
  apiCall: () => Promise<T>,
  config: BeepBoopConfig,
  operation: string = 'Discord API call'
): Promise<DiscordApiResult<T>> {
  let attempts = 0;
  let lastError: any = null;

  for (attempts = 1; attempts <= config.discordApiRetryAttempts; attempts++) {
    try {
      if (config.logLevel === 'debug') {
        console.error(`[DEBUG] ${operation} attempt ${attempts}/${config.discordApiRetryAttempts}`);
      }

      // Create a timeout promise to race against the API call
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Discord API timeout')), config.discordApiTimeoutMs);
      });

      // Race the API call against the timeout
      const data = await Promise.race([
        apiCall(),
        timeoutPromise
      ]);

      if (config.logLevel === 'debug') {
        console.error(`[DEBUG] ${operation} succeeded on attempt ${attempts}`);
      }

      return {
        success: true,
        data,
        attempts
      };
    } catch (error: any) {
      lastError = error;
      
      if (config.logLevel === 'debug') {
        console.error(`[DEBUG] ${operation} failed on attempt ${attempts}: ${error.message || error}`);
      }

      // If this is the last attempt, don't wait
      if (attempts === config.discordApiRetryAttempts) {
        break;
      }

      // Calculate exponential backoff delay
      const baseDelay = config.discordApiRetryBaseDelayMs;
      const exponentialDelay = baseDelay * Math.pow(2, attempts - 1);
      const jitterMs = Math.random() * 1000; // Add up to 1 second of jitter
      const totalDelay = exponentialDelay + jitterMs;

      if (config.logLevel === 'debug') {
        console.error(`[DEBUG] Waiting ${Math.round(totalDelay)}ms before retry ${attempts + 1}`);
      }

      await sleep(totalDelay);
    }
  }

  return {
    success: false,
    error: lastError?.message || lastError || 'Unknown error',
    attempts
  };
}

/**
 * Send a Discord message with retry logic
 */
export async function sendDiscordMessage(
  rest: any,
  Routes: any,
  channelId: string,
  content: string,
  config: BeepBoopConfig
): Promise<DiscordApiResult<any>> {
  return callDiscordApiWithRetry(
    () => rest.post(Routes.channelMessages(channelId), { body: { content } }),
    config,
    `Send Discord message to channel ${channelId}`
  );
}

/**
 * Create a Discord thread with retry logic
 */
export async function createDiscordThread(
  rest: any,
  Routes: any,
  channelId: string,
  messageId: string,
  threadName: string,
  config: BeepBoopConfig
): Promise<DiscordApiResult<any>> {
  return callDiscordApiWithRetry(
    () => rest.post(Routes.threads(channelId, messageId), {
      body: {
        name: threadName,
        auto_archive_duration: 60,
        reason: 'Beep/Boop agent initiated conversation'
      }
    }),
    config,
    `Create Discord thread "${threadName}"`
  );
}

/**
 * Send a message to a Discord thread with retry logic
 */
export async function sendDiscordThreadMessage(
  rest: any,
  Routes: any,
  threadId: string,
  content: string,
  config: BeepBoopConfig
): Promise<DiscordApiResult<any>> {
  return callDiscordApiWithRetry(
    () => rest.post(Routes.channelMessages(threadId), { body: { content } }),
    config,
    `Send message to Discord thread ${threadId}`
  );
}

/**
 * Send a Discord message as a reply to another message with retry logic
 */
export async function sendDiscordReply(
  rest: any,
  Routes: any,
  channelId: string,
  messageId: string,
  content: string,
  config: BeepBoopConfig
): Promise<DiscordApiResult<any>> {
  return callDiscordApiWithRetry(
    () => rest.post(Routes.channelMessages(channelId), { 
      body: { 
        content, 
        message_reference: { message_id: messageId } 
      } 
    }),
    config,
    `Send Discord reply to message ${messageId}`
  );
}
