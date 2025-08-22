/**
 * Lightweight HTTP listener client with adaptive timeouts and concurrency limiting
 */

import { BeepBoopConfig, loadConfig } from './config.js';
import { randomUUID } from 'crypto';

class Semaphore {
  private queue: Array<() => void> = [];
  private counter: number;
  constructor(private readonly max: number) {
    this.counter = max;
  }
  async acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const attempt = () => {
        if (this.counter > 0) {
          this.counter--;
          resolve(() => {
            this.counter++;
            const next = this.queue.shift();
            if (next) next();
          });
        } else {
          this.queue.push(attempt);
        }
      };
      attempt();
    });
  }
}

export interface ListenerResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class HttpListenerClient {
  private readonly cfg: BeepBoopConfig;
  private readonly sem: Semaphore;

  constructor(cfg?: BeepBoopConfig) {
    this.cfg = cfg ?? loadConfig();
    this.sem = new Semaphore(this.cfg.maxConcurrentListenerRequests);
  }

  private buildTimeoutMs(payload: any): number {
    try {
      const textLen = JSON.stringify(payload)?.length ?? 0;
      const adaptive = this.cfg.listenerTimeoutBaseMs + (textLen * this.cfg.listenerTimeoutPerCharMs);
      return Math.min(this.cfg.listenerTimeoutMaxMs, adaptive);
    } catch {
      return this.cfg.listenerTimeoutBaseMs;
    }
  }

  private buildHeaders(reqId: string): Record<string,string> {
    const h: Record<string,string> = { 'Content-Type': 'application/json', 'X-Beep-Boop-Request-Id': reqId };
    if (this.cfg.listenerAuthToken) {
      h['Authorization'] = `Bearer ${this.cfg.listenerAuthToken}`;
    }
    return h;
  }

  async post<T = any>(path: string, body: any, timeoutOverrideMs?: number): Promise<ListenerResponse<T>> {
    if (!this.cfg.listenerEnabled || !this.cfg.listenerBaseUrl) {
      return { ok: false, status: 503, error: 'Listener not enabled' };
    }

    const release = await this.sem.acquire();
    try {
      const controller = new AbortController();
      const timeoutMs = timeoutOverrideMs ?? this.buildTimeoutMs(body);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const reqId = randomUUID();

      const res = await fetch(`${this.cfg.listenerBaseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: this.buildHeaders(reqId),
        body: JSON.stringify({ ...body, requestId: reqId }),
        signal: controller.signal
      });
      clearTimeout(timer);

      let data: any = undefined;
      try { data = await res.json(); } catch { /* ignore non-JSON */ }

      if (res.ok) {
        return { ok: true, status: res.status, data };
      }
      return { ok: false, status: res.status, error: data?.error || res.statusText };
    } catch (e: any) {
      const isAbort = e?.name === 'AbortError';
      return { ok: false, status: isAbort ? 408 : 500, error: isAbort ? `Listener timed out` : `Listener error: ${e}` };
    } finally {
      release();
    }
  }
}

export const listenerClient = new HttpListenerClient();

