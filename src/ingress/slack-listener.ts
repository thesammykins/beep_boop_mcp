import SlackBolt from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { BeepBoopConfig } from '../config.js';
import { InboxStore, IngressMessage } from './inbox.js';
import { randomUUID } from 'crypto';

export function createSlackSocketListener(config: BeepBoopConfig, inbox: InboxStore) {
  const { App, LogLevel } = SlackBolt as any;
  if (!config.slackAppToken || !config.slackBotToken) {
    throw new Error('Slack Socket Mode requires BEEP_BOOP_SLACK_APP_TOKEN and BEEP_BOOP_SLACK_BOT_TOKEN');
  }

  const app = new App({
    token: config.slackBotToken,
    appToken: config.slackAppToken,
    socketMode: true,
    logLevel: config.logLevel === 'debug' ? LogLevel.DEBUG : LogLevel.INFO
  });

  const web = new WebClient(config.slackBotToken);

  // Mention-based capture
  app.event('app_mention', async ({ event }) => {
    const text: string = (event as any).text || '';
    const msg: IngressMessage = {
      id: randomUUID(),
      platform: 'slack',
      text: text.replace(/<@[^>]+>/g, '').trim(),
      raw: event,
      authoredBy: { id: (event as any).user },
      context: { channelId: (event as any).channel, threadTs: (event as any).thread_ts },
      createdAt: new Date(((event as any).ts ? Number((event as any).ts) * 1000 : Date.now())).toISOString()
    };
    await inbox.put(msg);

    // Immediate acknowledgement reply
    try {
      await web.chat.postMessage({
        channel: (event as any).channel,
        thread_ts: (event as any).thread_ts || (event as any).ts,
        text: `✅ Got it! Queued your request (id: ${msg.id}). I will update you with next steps.`
      });
    } catch (e) {
      console.error('Slack ack failed', e);
    }
  });

  // Optional: capture plain messages that mention the bot via <@botId> in channels
  app.message(/<@\w+>\s+(.+)/, async ({ message, context }) => {
    // Bolt already routes app_mention, but some workspaces rely on message regex
    const text = (message as any).text || '';
    if (!text.includes(`<@${context.botUserId}>`)) return;

    const msg: IngressMessage = {
      id: randomUUID(),
      platform: 'slack',
      text: text.replace(new RegExp(`<@${context.botUserId}>`, 'g'), '').trim(),
      raw: message,
      authoredBy: { id: (message as any).user },
      context: { channelId: (message as any).channel, threadTs: (message as any).thread_ts },
      createdAt: new Date(((message as any).ts ? Number((message as any).ts) * 1000 : Date.now())).toISOString()
    };
    await inbox.put(msg);

    try {
      await web.chat.postMessage({
        channel: (message as any).channel,
        thread_ts: (message as any).thread_ts || (message as any).ts,
        text: `✅ Got it! Queued your request (id: ${msg.id}). I will update you with next steps.`
      });
    } catch (e) {
      console.error('Slack ack failed', e);
    }
  });

  async function start() {
    await app.start();
    console.error('🔌 Slack Socket Mode listener started');
  }

  return { start };
}

