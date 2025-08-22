import { promises as fs } from 'fs';
import { join } from 'path';
import { BeepBoopConfig } from '../config.js';

export type IngressPlatform = 'slack' | 'discord';

export interface IngressMessage {
  id: string; // UUID
  platform: IngressPlatform;
  text: string;
  raw: any;
  authoredBy: { id: string; username?: string };
  context: { channelId: string; threadTs?: string; guildId?: string; messageId?: string; threadId?: string };
  createdAt: string; // ISO
}

export class InboxStore {
  constructor(private config: BeepBoopConfig) {}

  private ensureDirs = async () => {
    await fs.mkdir(this.config.ingressInboxDir, { recursive: true }).catch(() => {});
    await fs.mkdir(join(this.config.ingressInboxDir, 'processed'), { recursive: true }).catch(() => {});
  };

  async put(msg: IngressMessage): Promise<string> {
    await this.ensureDirs();
    const file = join(this.config.ingressInboxDir, `${msg.id}.json`);
    await fs.writeFile(file, JSON.stringify(msg, null, 2), 'utf8');
    return file;
  }

  async list(): Promise<string[]> {
    await this.ensureDirs();
    const files = await fs.readdir(this.config.ingressInboxDir);
    return files.filter(f => f.endsWith('.json'));
  }

  async read(id: string): Promise<IngressMessage | null> {
    const file = join(this.config.ingressInboxDir, `${id}.json`);
    try {
      const data = await fs.readFile(file, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async ack(id: string): Promise<boolean> {
    const src = join(this.config.ingressInboxDir, `${id}.json`);
    const dst = join(this.config.ingressInboxDir, 'processed', `${id}.json`);
    try {
      await this.ensureDirs();
      await fs.rename(src, dst);
      return true;
    } catch {
      return false;
    }
  }
}

  async updateThreadId(id: string, threadId: string): Promise<boolean> {
    const file = join(this.config.ingressInboxDir, `${id}.json`);
    try {
      const data = await fs.readFile(file, 'utf8');
      const msg = JSON.parse(data);
      msg.context = msg.context || {};
      msg.context.threadId = threadId;
      await fs.writeFile(file, JSON.stringify(msg, null, 2), 'utf8');
      return true;
    } catch {
      return false;
    }
  }
}

