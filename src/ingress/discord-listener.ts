import { Client, GatewayIntentBits, Partials, Events, REST, Routes } from 'discord.js';
import { BeepBoopConfig } from '../config.js';
import { InboxStore, IngressMessage } from './inbox.js';
import { randomUUID } from 'crypto';

export function createDiscordListener(config: BeepBoopConfig, inbox: InboxStore) {
  if (!config.discordBotToken) {
    throw new Error('Discord listener requires BEEP_BOOP_DISCORD_BOT_TOKEN');
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
  });

  const rest = new REST({ version: '10' }).setToken(config.discordBotToken);

  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;

      // If a conversation thread started by our bot, capture replies without requiring mention
      const anyChan: any = message.channel as any;
      if (typeof anyChan.isThread === 'function' && anyChan.isThread() && anyChan.ownerId === client.user!.id) {
        const threadChannel: any = message.channel;
        const parentId = threadChannel.parentId;
        const msg: IngressMessage = {
          id: randomUUID(),
          platform: 'discord',
          text: (message.content || '').trim(),
          raw: { id: message.id, content: message.content },
          authoredBy: { id: message.author.id, username: message.author.username },
          context: { channelId: parentId || message.channelId, guildId: message.guildId || undefined, messageId: message.id, threadId: threadChannel.id },
          createdAt: new Date(message.createdTimestamp).toISOString()
        };
        await inbox.put(msg);
        return;
      }

      // Otherwise require a mention to initiate a thread
      if (!message.mentions.has(client.user!)) return;

      const cleaned = message.content.replace(`<@${client.user!.id}>`, '').trim();
      const msg: IngressMessage = {
        id: randomUUID(),
        platform: 'discord',
        text: cleaned,
        raw: { id: message.id, content: message.content },
        authoredBy: { id: message.author.id, username: message.author.username },
        context: { channelId: message.channelId, guildId: message.guildId || undefined, messageId: message.id },
        createdAt: new Date(message.createdTimestamp).toISOString()
      };

      await inbox.put(msg);

      // Start a thread for back-and-forth
      let thread: any;
      try {
        const name = cleaned.slice(0, 80) || `Task ${msg.id}`;
        thread = await (message as any).startThread({ name, autoArchiveDuration: 60, reason: 'Beep/Boop conversation' });
        await inbox.updateThreadId(msg.id, thread.id);
      } catch (e) {
        console.error('Failed to start Discord thread', e);
      }

      // Ack in thread if created, else reply to original message
      try {
        if (thread) {
          await thread.send(`✅ Got it! Queued your request (id: ${msg.id}). I will update you with next steps.`);
        } else {
          await message.reply(`✅ Got it! Queued your request (id: ${msg.id}). I will update you with next steps.`);
        }
      } catch (e) {
        console.error('Discord ack failed', e);
      }
    } catch (e) {
      console.error('Discord message handling failed', e);
    }
  });

  async function start() {
    await client.login(config.discordBotToken);
    console.error('🕹️ Discord gateway listener started');
  }

  return { start };
}

