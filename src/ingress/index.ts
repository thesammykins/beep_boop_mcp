import { BeepBoopConfig, printConfigSummary, loadConfig } from '../config.js';
import { InboxStore } from './inbox.js';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { WorkState } from '../types.js';
import { getWorkStatus, isFileStale, getFileAgeDescription, cleanupStaleBoopAndClaim, validateAgentIdWithConfig } from '../file-operations.js';

async function readJsonBody<T = any>(req: any): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function startHttpServer(config: BeepBoopConfig, inbox: InboxStore) {
  if (!config.ingressHttpEnabled) return;
  const server = createServer(async (req, res) => {
    try {
      // Basic bearer token auth if configured
      if (config.ingressHttpAuthToken) {
        const auth = req.headers['authorization'] || '';
        if (!auth.startsWith('Bearer ') || auth.slice(7) !== config.ingressHttpAuthToken) {
          res.writeHead(401);
          res.end('Unauthorized');
          return;
        }
      }

      const url = new URL(req.url || '/', `http://localhost:${config.ingressHttpPort}`);

      // GET /messages?status=pending
      if (req.method === 'GET' && url.pathname === '/messages') {
        const ids = await inbox.list();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ids }));
        return;
      }

      // GET /messages/:id
      const msgIdMatch = url.pathname.match(/^\/messages\/([a-zA-Z0-9-]+)$/);
      if (req.method === 'GET' && msgIdMatch) {
        const id = msgIdMatch[1];
        const msg = await inbox.read(id);
        if (!msg) {
          res.writeHead(404); res.end('Not found'); return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(msg));
        return;
      }

      // POST /messages/:id/ack
      const ackMatch = url.pathname.match(/^\/messages\/([a-zA-Z0-9-]+)\/ack$/);
      if (req.method === 'POST' && ackMatch) {
        const id = ackMatch[1];
        const ok = await inbox.ack(id);
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok }));
        return;
      }

      // POST /mcp/check_status
      if (req.method === 'POST' && url.pathname === '/mcp/check_status') {
        try {
          const body = await readJsonBody<any>(req);
          const { directory, maxAgeHours = loadConfig().defaultMaxAgeHours, autoCleanStale = false, newAgentId, newWorkDescription } = body || {};
          if (!directory || typeof directory !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'directory is required' }));
            return;
          }

          let status = await getWorkStatus(directory);
          let cleanupPerformed = false;
          let cleanupMessage = '';

          if (status.status === WorkState.WORK_IN_PROGRESS && status.boopTimestamp) {
            const stale = isFileStale(status.boopTimestamp, maxAgeHours);
            const ageDescription = getFileAgeDescription(status.boopTimestamp);
            if (stale) {
              if (autoCleanStale) {
                if (newAgentId) {
                  const cfg = loadConfig();
                  if (!validateAgentIdWithConfig(newAgentId, cfg)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Invalid new agent id: ${newAgentId}` }));
                    return;
                  }
                }
                try {
                  const cleanup = await cleanupStaleBoopAndClaim(directory, status.agentId || 'unknown', newAgentId, newWorkDescription);
                  cleanupPerformed = true;
                  cleanupMessage = cleanup.message;
                  status = await getWorkStatus(directory);
                } catch (e: any) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: `Cleanup failed: ${e?.message || e}` }));
                  return;
                }
              } else {
                cleanupMessage = `⚠️ STALE BOOP DETECTED: File is ${ageDescription} old (threshold: ${maxAgeHours} hours). Use autoCleanStale=true to automatically clean up.`;
              }
            }
          }

          let timestampInfo = '';
          if (status.beepTimestamp) {
            const beepAge = getFileAgeDescription(status.beepTimestamp);
            timestampInfo += `\n📅 Beep file: ${status.beepTimestamp.toISOString()} (${beepAge})`;
          }
          if (status.boopTimestamp) {
            const boopAge = getFileAgeDescription(status.boopTimestamp);
            const staleIndicator = isFileStale(status.boopTimestamp, maxAgeHours) ? ' ⚠️ STALE' : '';
            timestampInfo += `\n📅 Boop file: ${status.boopTimestamp.toISOString()} (${boopAge}${staleIndicator})`;
          }

          let statusEmoji = '';
          let statusText = '';
          switch (status.status) {
            case WorkState.WORK_ALLOWED: statusEmoji = '✅'; statusText = 'WORK ALLOWED'; break;
            case WorkState.WORK_IN_PROGRESS: statusEmoji = '🚧'; statusText = 'WORK IN PROGRESS'; break;
            case WorkState.NO_COORDINATION: statusEmoji = '⭕'; statusText = 'NO COORDINATION'; break;
            case WorkState.INVALID_STATE: statusEmoji = '⚠️'; statusText = 'INVALID STATE'; break;
          }

          let responseText = `${statusEmoji} ${statusText}\n\n📁 Directory: ${status.directory}\n📄 Beep file exists: ${status.beepExists}\n📄 Boop file exists: ${status.boopExists}`;
          if (status.agentId) responseText += `\n👤 Agent: ${status.agentId}`;
          responseText += timestampInfo;
          if (cleanupMessage) responseText += `\n\n🧹 Cleanup Action: ${cleanupMessage}`;
          responseText += `\n\nℹ️ ${status.details}`;
          // Simple next steps guidance
          if (status.status === WorkState.WORK_ALLOWED) responseText += `\n\n💡 Next steps:\n• Use update_boop to claim the directory`;
          if (status.status === WorkState.WORK_IN_PROGRESS) responseText += `\n\n💡 Next steps:\n• If you are the agent, use end_work when complete; otherwise wait or check for staleness`;
          if (status.status === WorkState.NO_COORDINATION) responseText += `\n\n💡 Next steps:\n• Use update_boop to claim the directory or create_beep if already complete`;
          if (status.status === WorkState.INVALID_STATE) responseText += `\n\n💡 Next steps:\n• Manual cleanup required: both beep and boop files exist`;
          if (maxAgeHours !== 24) responseText += `\n\n🕒 Stale threshold: ${maxAgeHours} hours`;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ text: responseText, meta: { status: status.status } }));
          return;
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Invalid request: ${e}` }));
          return;
        }
      }

      // POST /mcp/update_user
      if (req.method === 'POST' && url.pathname === '/mcp/update_user') {
        try {
          const body = await readJsonBody<any>(req);
          const { messageId, updateContent } = body || {};
          if (!messageId || !updateContent) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'messageId and updateContent are required' }));
            return;
          }

          const msg = await inbox.read(messageId);
          if (!msg) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Message ${messageId} not found` }));
            return;
          }

          if (msg.platform === 'slack') {
            const cfg = loadConfig();
            if (!cfg.slackBotToken) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Slack bot token not configured' }));
              return;
            }
            const { WebClient } = await import('@slack/web-api');
            const web = new WebClient(cfg.slackBotToken);
            const channel = msg.context.channelId as string;
            const thread_ts = (msg.context as any).threadTs as string | undefined;
            await web.chat.postMessage({ channel, thread_ts, text: updateContent });
          } else if (msg.platform === 'discord') {
            const cfg = loadConfig();
            if (!cfg.discordBotToken) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Discord bot token not configured' }));
              return;
            }
            const { REST, Routes } = await import('discord.js');
            const rest = new (REST as any)({ version: '10' }).setToken(cfg.discordBotToken);
            const threadId = (msg.context as any).threadId as string | undefined;
            if (threadId) {
              await rest.post((Routes as any).channelMessages(threadId), { body: { content: updateContent } });
            } else {
              const channelId = msg.context.channelId as string;
              await rest.post((Routes as any).channelMessages(channelId), { body: { content: updateContent, message_reference: { message_id: (msg.context as any).messageId } } });
            }
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Unsupported platform: ${(msg as any).platform}` }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ text: `✅ Update sent for message ${messageId}` }));
          return;
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Failed to send update: ${e}` }));
          return;
        }
      }

      // POST /mcp/initiate_conversation
      if (req.method === 'POST' && url.pathname === '/mcp/initiate_conversation') {
        try {
          const body = await readJsonBody<any>(req);
          const { platform, channelId, content, agentId } = body || {};
          
          if (!platform || !content) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'platform and content are required' }));
            return;
          }
          
          if (!['slack', 'discord'].includes(platform)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'platform must be slack or discord' }));
            return;
          }

          const cfg = loadConfig();
          let finalChannelId = channelId;
          
          // Use default channel if none specified and Discord
          if (!finalChannelId && platform === 'discord' && cfg.discordDefaultChannelId) {
            finalChannelId = cfg.discordDefaultChannelId;
          }
          
          if (!finalChannelId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `No channel ID specified and no default channel configured for ${platform}` }));
            return;
          }

          let messageId: string = '';
          let threadId: string | undefined;
          
          if (platform === 'slack') {
            if (!cfg.slackBotToken) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Slack bot token not configured' }));
              return;
            }
            
            const { WebClient } = await import('@slack/web-api');
            const web = new WebClient(cfg.slackBotToken);
            
            const message = agentId 
              ? `[${agentId}] ${content}` 
              : content;
            
            const result = await web.chat.postMessage({ 
              channel: finalChannelId, 
              text: message 
            });
            
            messageId = result.message?.ts || '';
            
          } else if (platform === 'discord') {
            if (!cfg.discordBotToken) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Discord bot token not configured' }));
              return;
            }
            
            const { REST, Routes } = await import('discord.js');
            const rest = new (REST as any)({ version: '10' }).setToken(cfg.discordBotToken);
            
            const message = agentId 
              ? `**[${agentId}]** ${content}` 
              : content;
            
            const result = await rest.post((Routes as any).channelMessages(finalChannelId), { 
              body: { content: message } 
            });
            
            messageId = result.id;
            
            // Create a thread for back-and-forth conversation
            try {
              const threadName = content.length > 80 ? content.slice(0, 77) + '...' : content;
              const threadResult = await rest.post(
                (Routes as any).threads(finalChannelId, messageId),
                {
                  body: {
                    name: threadName,
                    auto_archive_duration: 60,
                    reason: 'Beep/Boop agent initiated conversation'
                  }
                }
              );
              threadId = threadResult.id;
            } catch (error) {
              // Thread creation failed but message was sent - not critical
              console.error('Failed to create Discord thread:', error);
            }
          }

          // Store the message in inbox for future reference/replies
          try {
            const ingressMessage = {
              id: randomUUID(),
              platform: platform as 'slack' | 'discord',
              text: content,
              raw: { initiatedBy: 'agent', agentId },
              authoredBy: { id: agentId || 'system', username: agentId || 'Beep/Boop Agent' },
              context: {
                channelId: finalChannelId,
                messageId,
                threadId,
                ...(platform === 'slack' ? { threadTs: messageId } : {})
              },
              createdAt: new Date().toISOString()
            };
            
            await inbox.put(ingressMessage);
            
            const platformInfo = platform === 'discord' && threadId 
              ? `Discord thread ${threadId} in channel ${finalChannelId}`
              : `${platform} channel ${finalChannelId}`;
            
            // Wait for user response in the thread/channel
            const maxWaitTimeMs = 5 * 60 * 1000; // 5 minutes timeout
            const pollIntervalMs = 2000; // Check every 2 seconds
            const startTime = Date.now();
            
            let pollCount = 0;
            while (Date.now() - startTime < maxWaitTimeMs) {
              pollCount++;
              
              // Check for new messages in the inbox that are replies to our thread
              const messageIds = await inbox.list();
              
              for (const msgFile of messageIds) {
                const msgId = msgFile.replace('.json', '');
                const msg = await inbox.read(msgId);
                
                if (msg && msg.platform === platform) {
                  // Check if this message is a reply in our thread/channel
                  const isReply = platform === 'discord' 
                    ? (msg.context as any).threadId === threadId
                    : (msg.context as any).threadTs === messageId || msg.context.channelId === finalChannelId;
                  
                  // Make sure it's not our own message and it's newer than our message
                  const isUserMessage = msg.authoredBy.id !== (agentId || 'system') && 
                                       new Date(msg.createdAt) > new Date(ingressMessage.createdAt);
                  
                  if (isReply && isUserMessage) {
                    // Found a user response!
                    const responseText = `✅ Conversation initiated and user responded!\n\n**Platform**: ${platformInfo}\n**Agent**: ${agentId || 'system'}\n**Initial Message ID**: ${ingressMessage.id}\n\n**User Response**:\n**From**: ${msg.authoredBy.username || msg.authoredBy.id}\n**Message**: ${msg.text}\n**Response ID**: ${msg.id}\n\n**Debug Info**: Found after ${pollCount} polls in ${Math.round((Date.now() - startTime) / 1000)}s\n\nYou can continue the conversation using update_user with either message ID.`;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ text: responseText }));
                    return;
                  }
                }
              }
              
              // Wait before checking again
              await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            }
            
            // Timeout reached without user response
            const timeoutText = `⏰ Conversation initiated on ${platformInfo}${agentId ? ` by agent ${agentId}` : ''}, but no user response received within 5 minutes.\n\n**Message ID**: ${ingressMessage.id}\n\nThe conversation thread is still active - you can use update_user to continue when the user responds.`;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ text: timeoutText }));
            return;
            
          } catch (inboxError) {
            // Message was sent but inbox storage failed - still a success
            const successText = `✅ Message sent to ${platform} channel ${finalChannelId}${agentId ? ` by agent ${agentId}` : ''}, but failed to store for future updates: ${inboxError}`;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ text: successText }));
            return;
          }
          
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Failed to initiate conversation: ${e}` }));
          return;
        }
      }

      // Not found
      res.writeHead(404);
      res.end('Not found');
    } catch (e) {
      console.error('Ingress HTTP error', e);
      res.writeHead(500);
      res.end('Internal error');
    }
  });

  server.listen(config.ingressHttpPort, () => {
    console.error(`🌐 Ingress HTTP endpoint listening on http://localhost:${config.ingressHttpPort}`);
  });
}

export async function startIngress() {
  const config = (await import('../config.js')).loadConfig();
  if (config.logLevel === 'debug') printConfigSummary(config);

  if (!config.ingressEnabled || config.ingressProvider === 'none') {
    console.error('Ingress is disabled. Set BEEP_BOOP_INGRESS_ENABLED=true and provider.');
    return;
  }

  const inbox = new InboxStore(config);
  startHttpServer(config, inbox);

  if (config.ingressProvider === 'slack') {
    const { createSlackSocketListener } = await import('./slack-listener.js');
    const slack = createSlackSocketListener(config, inbox);
    await slack.start();
  } else if (config.ingressProvider === 'discord') {
    const { createDiscordListener } = await import('./discord-listener.js');
    const discord = createDiscordListener(config, inbox);
    await discord.start();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startIngress().catch((e) => { console.error('Ingress fatal error', e); process.exit(1); });
}

