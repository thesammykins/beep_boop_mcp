import { BeepBoopConfig, printConfigSummary } from '../config.js';
import { InboxStore } from './inbox.js';
import { createSlackSocketListener } from './slack-listener.js';
import { createDiscordListener } from './discord-listener.js';
import http from 'http';
import { randomUUID } from 'crypto';

function startHttpServer(config: BeepBoopConfig, inbox: InboxStore) {
  if (!config.ingressHttpEnabled) return;
  const server = http.createServer(async (req, res) => {
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

async function main() {
  const config = (await import('../config.js')).loadConfig();
  if (config.logLevel === 'debug') printConfigSummary(config);

  if (!config.ingressEnabled || config.ingressProvider === 'none') {
    console.error('Ingress is disabled. Set BEEP_BOOP_INGRESS_ENABLED=true and provider.');
    process.exit(0);
  }

  const inbox = new InboxStore(config);
  startHttpServer(config, inbox);

  if (config.ingressProvider === 'slack') {
    const slack = createSlackSocketListener(config, inbox);
    await slack.start();
  } else if (config.ingressProvider === 'discord') {
    const discord = createDiscordListener(config, inbox);
    await discord.start();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('Ingress fatal error', e); process.exit(1); });
}

