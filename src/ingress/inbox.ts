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

export interface CleanupStats {
  processedDeleted: number;
  unprocessedDeleted: number;
  totalDeleted: number;
  errors: string[];
  durationMs: number;
}

export class InboxStore {
  private lastCleanupTime: number = 0;
  
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

  /**
   * Perform cleanup of old inbox files based on configuration
   * @param force Force cleanup even if not due based on interval
   * @returns Cleanup statistics
   */
  async cleanup(force: boolean = false): Promise<CleanupStats> {
    if (!this.config.inboxCleanupEnabled && !force) {
      return {
        processedDeleted: 0,
        unprocessedDeleted: 0,
        totalDeleted: 0,
        errors: ['Cleanup is disabled'],
        durationMs: 0
      };
    }

    // Check if cleanup is due based on interval (unless forced)
    const now = Date.now();
    const intervalMs = this.config.inboxCleanupIntervalHours * 60 * 60 * 1000;
    if (!force && intervalMs > 0 && (now - this.lastCleanupTime) < intervalMs) {
      return {
        processedDeleted: 0,
        unprocessedDeleted: 0,
        totalDeleted: 0,
        errors: [`Cleanup not due yet (last run ${Math.round((now - this.lastCleanupTime) / 1000 / 60)} min ago)`],
        durationMs: 0
      };
    }

    const startTime = Date.now();
    const stats: CleanupStats = {
      processedDeleted: 0,
      unprocessedDeleted: 0,
      totalDeleted: 0,
      errors: [],
      durationMs: 0
    };

    try {
      await this.ensureDirs();

      // Clean processed files (older than processedRetentionDays)
      if (this.config.inboxProcessedRetentionDays > 0) {
        const processedStats = await this.cleanupDirectory(
          join(this.config.ingressInboxDir, 'processed'),
          this.config.inboxProcessedRetentionDays
        );
        stats.processedDeleted = processedStats.deleted;
        stats.errors.push(...processedStats.errors);
      }

      // Clean unprocessed files (older than unprocessedRetentionDays)
      if (this.config.inboxUnprocessedRetentionDays > 0) {
        const unprocessedStats = await this.cleanupDirectory(
          this.config.ingressInboxDir,
          this.config.inboxUnprocessedRetentionDays
        );
        stats.unprocessedDeleted = unprocessedStats.deleted;
        stats.errors.push(...unprocessedStats.errors);
      }

      // Check file count limits and force cleanup if exceeded
      if (this.config.inboxMaxFilesPerDir > 0) {
        const countStats = await this.cleanupByCount();
        stats.processedDeleted += countStats.processedDeleted;
        stats.unprocessedDeleted += countStats.unprocessedDeleted;
        stats.errors.push(...countStats.errors);
      }

      stats.totalDeleted = stats.processedDeleted + stats.unprocessedDeleted;
      this.lastCleanupTime = now;

    } catch (error) {
      stats.errors.push(`Cleanup failed: ${error}`);
    }

    stats.durationMs = Date.now() - startTime;

    // Log cleanup results if debug enabled
    if (this.config.logLevel === 'debug' && (stats.totalDeleted > 0 || stats.errors.length > 0)) {
      console.error(`🧹 Inbox cleanup completed: ${stats.totalDeleted} files deleted (${stats.processedDeleted} processed, ${stats.unprocessedDeleted} unprocessed) in ${stats.durationMs}ms`);
      if (stats.errors.length > 0) {
        console.error(`   Errors: ${stats.errors.join(', ')}`);
      }
    }

    return stats;
  }

  /**
   * Clean files in a specific directory older than specified days
   */
  private async cleanupDirectory(dirPath: string, retentionDays: number): Promise<{deleted: number, errors: string[]}> {
    const deleted = [];
    const errors = [];
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    try {
      const files = await fs.readdir(dirPath).catch(() => []);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = join(dirPath, file);
        
        try {
          const stat = await fs.stat(filePath);
          if (stat.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            deleted.push(file);
          }
        } catch (error) {
          errors.push(`Failed to delete ${file}: ${error}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to read directory ${dirPath}: ${error}`);
    }

    return { deleted: deleted.length, errors };
  }

  /**
   * Clean files when directory exceeds max file count limit
   */
  private async cleanupByCount(): Promise<{processedDeleted: number, unprocessedDeleted: number, errors: string[]}> {
    const errors = [];
    let processedDeleted = 0;
    let unprocessedDeleted = 0;

    try {
      // Check unprocessed directory
      const unprocessedFiles = await fs.readdir(this.config.ingressInboxDir).catch(() => []);
      const unprocessedJsonFiles = unprocessedFiles.filter(f => f.endsWith('.json'));
      
      if (unprocessedJsonFiles.length > this.config.inboxMaxFilesPerDir) {
        const toDelete = unprocessedJsonFiles.length - this.config.inboxMaxFilesPerDir;
        const sortedFiles = await this.sortFilesByAge(this.config.ingressInboxDir, unprocessedJsonFiles);
        
        // Delete oldest files
        for (let i = 0; i < toDelete && i < sortedFiles.length; i++) {
          try {
            await fs.unlink(join(this.config.ingressInboxDir, sortedFiles[i]));
            unprocessedDeleted++;
          } catch (error) {
            errors.push(`Failed to delete ${sortedFiles[i]}: ${error}`);
          }
        }
      }

      // Check processed directory
      const processedDir = join(this.config.ingressInboxDir, 'processed');
      const processedFiles = await fs.readdir(processedDir).catch(() => []);
      const processedJsonFiles = processedFiles.filter(f => f.endsWith('.json'));
      
      if (processedJsonFiles.length > this.config.inboxMaxFilesPerDir) {
        const toDelete = processedJsonFiles.length - this.config.inboxMaxFilesPerDir;
        const sortedFiles = await this.sortFilesByAge(processedDir, processedJsonFiles);
        
        // Delete oldest files
        for (let i = 0; i < toDelete && i < sortedFiles.length; i++) {
          try {
            await fs.unlink(join(processedDir, sortedFiles[i]));
            processedDeleted++;
          } catch (error) {
            errors.push(`Failed to delete processed/${sortedFiles[i]}: ${error}`);
          }
        }
      }

    } catch (error) {
      errors.push(`Count-based cleanup failed: ${error}`);
    }

    return { processedDeleted, unprocessedDeleted, errors };
  }

  /**
   * Sort files by modification time (oldest first)
   */
  private async sortFilesByAge(dirPath: string, files: string[]): Promise<string[]> {
    const fileStats = [];
    
    for (const file of files) {
      try {
        const stat = await fs.stat(join(dirPath, file));
        fileStats.push({ file, mtime: stat.mtime.getTime() });
      } catch {
        // Skip files that can't be stat'd
      }
    }
    
    return fileStats
      .sort((a, b) => a.mtime - b.mtime)
      .map(item => item.file);
  }

  /**
   * Get inbox statistics (for monitoring and debugging)
   */
  async getStats(): Promise<{unprocessed: number, processed: number, lastCleanup: string | null}> {
    try {
      await this.ensureDirs();
      
      const unprocessedFiles = await fs.readdir(this.config.ingressInboxDir).catch(() => []);
      const unprocessedCount = unprocessedFiles.filter(f => f.endsWith('.json')).length;
      
      const processedFiles = await fs.readdir(join(this.config.ingressInboxDir, 'processed')).catch(() => []);
      const processedCount = processedFiles.filter(f => f.endsWith('.json')).length;
      
      const lastCleanup = this.lastCleanupTime > 0 
        ? new Date(this.lastCleanupTime).toISOString()
        : null;
      
      return {
        unprocessed: unprocessedCount,
        processed: processedCount,
        lastCleanup
      };
    } catch {
      return {
        unprocessed: 0,
        processed: 0,
        lastCleanup: null
      };
    }
  }

  /**
   * Trigger automatic cleanup if conditions are met
   * This is called by tools to perform periodic cleanup without blocking
   */
  async autoCleanup(): Promise<void> {
    // Only run if cleanup is enabled and interval-based cleanup is configured
    if (!this.config.inboxCleanupEnabled || this.config.inboxCleanupIntervalHours === 0) {
      return;
    }

    // Run cleanup in background - don't await or throw errors
    this.cleanup(false).catch((error) => {
      if (this.config.logLevel === 'debug') {
        console.error(`🧹 Auto-cleanup failed: ${error}`);
      }
    });
  }
}

