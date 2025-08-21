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

      // Ack reply
      await message.reply(`✅ Got it! Queued your request (id: ${msg.id}). I will update you with next steps.`);
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

