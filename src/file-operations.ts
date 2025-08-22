/**
 * Core file operations for the beep/boop coordination system
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  WorkStatus, 
  WorkState, 
  FileMetadata, 
  BeepFileContent, 
  BoopFileContent, 
  CoordinationError, 
  ErrorCode 
} from './types.js';
import { BeepBoopConfig, isDirectoryAllowed, validateAgentIdPrefix } from './config.js';

/** Default file names for coordination */
export const BEEP_FILE = 'beep';
export const BOOP_FILE = 'boop';

/**
 * Check if beep file exists in the given directory
 */
export async function checkBeepExists(directory: string): Promise<boolean> {
  try {
    const beepPath = join(directory, BEEP_FILE);
    await fs.access(beepPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if boop file exists in the given directory
 */
export async function checkBoopExists(directory: string): Promise<boolean> {
  try {
    const boopPath = join(directory, BOOP_FILE);
    await fs.access(boopPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file metadata if file exists
 */
export async function getFileMetadata(filePath: string): Promise<FileMetadata | null> {
  try {
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    
    return {
      timestamp: stats.mtime,
      size: stats.size,
      content: content.trim()
    };
  } catch {
    return null;
  }
}

/**
 * Parse beep file content as JSON
 */
export function parseBeepContent(content: string): BeepFileContent {
  try {
    const parsed = JSON.parse(content);
    return {
      completedAt: new Date(parsed.completedAt),
      message: parsed.message,
      completedBy: parsed.completedBy
    };
  } catch {
    // Fallback for simple text files
    return {
      completedAt: new Date(),
      message: content || 'Work completed'
    };
  }
}

/**
 * Parse boop file content as JSON
 */
export function parseBoopContent(content: string): BoopFileContent {
  try {
    const parsed = JSON.parse(content);
    return {
      startedAt: new Date(parsed.startedAt),
      agentId: parsed.agentId,
      workDescription: parsed.workDescription
    };
  } catch {
    // Fallback for simple text files - extract agent ID from first line
    const lines = content.split('\n');
    const agentId = lines[0]?.trim() || 'unknown';
    return {
      startedAt: new Date(),
      agentId,
      workDescription: lines.slice(1).join('\n').trim() || 'Work in progress'
    };
  }
}

/**
 * Create a beep file with timestamp and optional message
 */
export async function createBeepFile(directory: string, message?: string, completedBy?: string, config?: BeepBoopConfig): Promise<void> {
  try {
    // Verify directory exists
    await fs.access(directory);
    
    const beepPath = join(directory, BEEP_FILE);
    const content: BeepFileContent = {
      completedAt: new Date(),
      message: message || 'Work completed',
      completedBy
    };
    
    await fs.writeFile(beepPath, JSON.stringify(content, null, 2));
    
    // Ensure .gitignore entries if configured
    if (config) {
      await ensureGitIgnoreEntries(directory, config);
    }
  } catch (error) {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new CoordinationError(
          `Directory not found: ${directory}`, 
          ErrorCode.DIRECTORY_NOT_FOUND, 
          directory
        );
      } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new CoordinationError(
          `Permission denied: ${directory}`, 
          ErrorCode.PERMISSION_DENIED, 
          directory
        );
      }
    }
    throw new CoordinationError(
      `Failed to create beep file: ${error}`, 
      ErrorCode.FILE_SYSTEM_ERROR, 
      directory
    );
  }
}

/**
 * Create or update a boop file with agent identifier and work description
 */
export async function createBoopFile(
  directory: string, 
  agentId: string, 
  workDescription?: string,
  config?: BeepBoopConfig
): Promise<void> {
  try {
    if (!agentId || agentId.trim().length === 0) {
      throw new CoordinationError(
        'Agent ID cannot be empty', 
        ErrorCode.INVALID_AGENT_ID, 
        directory
      );
    }

    // Verify directory exists
    await fs.access(directory);
    
    const boopPath = join(directory, BOOP_FILE);
    const content: BoopFileContent = {
      startedAt: new Date(),
      agentId: agentId.trim(),
      workDescription: workDescription || 'Work in progress'
    };
    
    await fs.writeFile(boopPath, JSON.stringify(content, null, 2));
    
    // Ensure .gitignore entries if configured
    if (config) {
      await ensureGitIgnoreEntries(directory, config);
    }
  } catch (error) {
    if (error instanceof CoordinationError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new CoordinationError(
          `Directory not found: ${directory}`, 
          ErrorCode.DIRECTORY_NOT_FOUND, 
          directory
        );
      } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new CoordinationError(
          `Permission denied: ${directory}`, 
          ErrorCode.PERMISSION_DENIED, 
          directory
        );
      }
    }
    
    throw new CoordinationError(
      `Failed to create boop file: ${error}`, 
      ErrorCode.FILE_SYSTEM_ERROR, 
      directory
    );
  }
}

/**
 * Remove boop file from directory
 */
export async function removeBoopFile(directory: string): Promise<void> {
  try {
    const boopPath = join(directory, BOOP_FILE);
    await fs.unlink(boopPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, that's okay
      return;
    }
    
    throw new CoordinationError(
      `Failed to remove boop file: ${error}`, 
      ErrorCode.FILE_SYSTEM_ERROR, 
      directory
    );
  }
}

/**
 * Get comprehensive status of work coordination files
 */
export async function getWorkStatus(directory: string): Promise<WorkStatus> {
  try {
    // Verify directory exists
    await fs.access(directory);
  } catch {
    throw new CoordinationError(
      `Directory not found: ${directory}`, 
      ErrorCode.DIRECTORY_NOT_FOUND, 
      directory
    );
  }

  const beepExists = await checkBeepExists(directory);
  const boopExists = await checkBoopExists(directory);
  
  // Get file metadata if files exist
  let beepTimestamp: Date | undefined;
  let boopTimestamp: Date | undefined;
  let agentId: string | undefined;

  if (beepExists) {
    const beepMeta = await getFileMetadata(join(directory, BEEP_FILE));
    if (beepMeta) {
      beepTimestamp = beepMeta.timestamp;
    }
  }

  if (boopExists) {
    const boopMeta = await getFileMetadata(join(directory, BOOP_FILE));
    if (boopMeta && boopMeta.content) {
      boopTimestamp = boopMeta.timestamp;
      try {
        const boopContent = parseBoopContent(boopMeta.content);
        agentId = boopContent.agentId;
      } catch {
        // Fallback to extracting first line as agent ID
        agentId = boopMeta.content.split('\n')[0]?.trim() || 'unknown';
      }
    }
  }

  // Determine work state and details
  let status: WorkState;
  let details: string;

  if (beepExists && !boopExists) {
    status = WorkState.WORK_ALLOWED;
    details = 'Work is complete and cleared. New work can begin.';
  } else if (boopExists && !beepExists) {
    status = WorkState.WORK_IN_PROGRESS;
    details = agentId 
      ? `Work is currently being done by agent: ${agentId}` 
      : 'Work is currently in progress by unknown agent';
  } else if (!beepExists && !boopExists) {
    status = WorkState.NO_COORDINATION;
    details = 'No coordination files found. Directory is unclaimed.';
  } else {
    // Both files exist - invalid state
    status = WorkState.INVALID_STATE;
    details = 'Invalid state: both beep and boop files exist. Manual cleanup required.';
  }

  return {
    beepExists,
    boopExists,
    directory,
    status,
    details,
    agentId,
    beepTimestamp,
    boopTimestamp
  };
}

/**
 * Atomically end work by removing boop file and creating beep file
 */
export async function endWorkAtomically(
  directory: string, 
  expectedAgentId: string, 
  message?: string,
  config?: BeepBoopConfig
): Promise<void> {
  // First verify the current state
  const currentStatus = await getWorkStatus(directory);
  
  if (currentStatus.status !== WorkState.WORK_IN_PROGRESS) {
    throw new CoordinationError(
      'Cannot end work: no work is currently in progress', 
      ErrorCode.WORK_NOT_CLAIMED, 
      directory
    );
  }

  if (currentStatus.agentId && currentStatus.agentId !== expectedAgentId) {
    throw new CoordinationError(
      `Cannot end work: work is claimed by different agent (${currentStatus.agentId} vs ${expectedAgentId})`, 
      ErrorCode.AGENT_MISMATCH, 
      directory
    );
  }

  // Remove boop file first, then create beep file
  try {
    await removeBoopFile(directory);
    await createBeepFile(directory, message, expectedAgentId, config);
  } catch (error) {
    // If beep creation fails after boop removal, try to restore boop file
    try {
      await createBoopFile(directory, expectedAgentId, 'Work restoration after failure', config);
    } catch {
      // Best effort restoration failed
    }
    throw error;
  }
}

/**
 * Check if a file is stale based on age threshold
 */
export function isFileStale(timestamp: Date, maxAgeHours: number = 24): boolean {
  const now = new Date();
  const ageInMs = now.getTime() - timestamp.getTime();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
  return ageInMs > maxAgeMs;
}

/**
 * Get human-readable age description
 */
export function getFileAgeDescription(timestamp: Date): string {
  const now = new Date();
  const ageInMs = now.getTime() - timestamp.getTime();
  const ageInHours = ageInMs / (60 * 60 * 1000);
  
  if (ageInHours < 1) {
    const ageInMinutes = Math.floor(ageInMs / (60 * 1000));
    return `${ageInMinutes} minute${ageInMinutes !== 1 ? 's' : ''} ago`;
  } else if (ageInHours < 24) {
    const hours = Math.floor(ageInHours);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(ageInHours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Clean up stale boop file and optionally claim with new agent
 */
export async function cleanupStaleBoopAndClaim(
  directory: string,
  staleAgentId: string,
  newAgentId?: string,
  workDescription?: string
): Promise<{ cleanedUp: boolean; claimed: boolean; message: string }> {
  try {
    // Remove the stale boop file
    await removeBoopFile(directory);
    
    let claimed = false;
    let message = `🧹 Cleaned up stale boop file from agent "${staleAgentId}"`;
    
    // If new agent info provided, claim the directory
    if (newAgentId && validateAgentId(newAgentId)) {
      await createBoopFile(directory, newAgentId, workDescription || 'Claimed after stale cleanup');
      claimed = true;
      message += ` and claimed for agent "${newAgentId}"`;
    }
    
    return {
      cleanedUp: true,
      claimed,
      message
    };
    
  } catch (error) {
    throw new CoordinationError(
      `Failed to cleanup stale boop file: ${error}`,
      ErrorCode.FILE_SYSTEM_ERROR,
      directory
    );
  }
}

/**
 * Validate agent ID format with configuration
 */
export function validateAgentIdWithConfig(agentId: string, config: BeepBoopConfig): boolean {
  if (!agentId || typeof agentId !== 'string') return false;
  
  const trimmed = agentId.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > config.maxAgentIdLength) return false;
  
  // Check team prefix requirements
  if (!validateAgentIdPrefix(trimmed, config)) {
    return false;
  }
  
  // Allow alphanumeric, hyphens, underscores, and dots
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  return validPattern.test(trimmed);
}

/**
 * Validate agent ID format (backward compatibility)
 */
export function validateAgentId(agentId: string): boolean {
  if (!agentId || typeof agentId !== 'string') return false;
  
  const trimmed = agentId.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 100) return false; // Reasonable length limit
  
  // Allow alphanumeric, hyphens, underscores, and dots
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  return validPattern.test(trimmed);
}

/**
 * Validate directory access with configuration
 */
export function validateDirectoryAccess(directory: string, config: BeepBoopConfig): void {
  if (!isDirectoryAllowed(directory, config)) {
    const reason = config.allowedDirectories.length > 0 
      ? `Directory not in allowed list: ${config.allowedDirectories.join(', ')}`
      : `Directory is blocked: ${config.blockedDirectories.find(blocked => directory.startsWith(blocked)) || 'unknown'}`;
    
    throw new CoordinationError(
      `Access denied to directory ${directory}. ${reason}`,
      ErrorCode.PERMISSION_DENIED,
      directory
    );
  }
}

/**
 * Ensure beep/boop files are added to .gitignore if configured
 */
export async function ensureGitIgnoreEntries(
  directory: string,
  config: BeepBoopConfig
): Promise<boolean> {
  if (!config.manageGitIgnore) {
    return false;
  }

  try {
    const gitignorePath = join(directory, '.gitignore');
    let gitignoreContent = '';
    
    // Read existing .gitignore if it exists
    try {
      gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    } catch (error) {
      // File doesn't exist, we'll create it
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Some other error occurred
        return false;
      }
    }

    // Check if entries already exist
    const lines = gitignoreContent.split('\n');
    const hasBeepEntry = lines.some(line => line.trim() === BEEP_FILE);
    const hasBoopEntry = lines.some(line => line.trim() === BOOP_FILE);
    const hasInboxEntry = lines.some(line => line.trim() === '.beep-boop-inbox/');
    const hasSection = lines.some(line => line.includes('# Beep/Boop coordination files'));
    
    if (hasBeepEntry && hasBoopEntry && hasInboxEntry) {
      return false; // Already configured
    }

    // Prepare entries to add
    const entriesToAdd: string[] = [];
    
    if (!hasSection) {
      // Add section header if not present
      if (gitignoreContent.length > 0 && !gitignoreContent.endsWith('\n')) {
        entriesToAdd.push('');
      }
      entriesToAdd.push('# Beep/Boop coordination files');
    }
    
    if (!hasBeepEntry) {
      entriesToAdd.push(BEEP_FILE);
    }
    
    if (!hasBoopEntry) {
      entriesToAdd.push(BOOP_FILE);
    }

    if (!hasInboxEntry) {
      entriesToAdd.push('.beep-boop-inbox/');
    }

    if (entriesToAdd.length === 0) {
      return false; // Nothing to add
    }

    // Append new entries
    const updatedContent = gitignoreContent + (gitignoreContent.length > 0 ? '\n' : '') + entriesToAdd.join('\n') + '\n';
    
    await fs.writeFile(gitignorePath, updatedContent, 'utf-8');
    
    if (config.logLevel === 'debug') {
      console.error(`📝 Added beep/boop entries to .gitignore in ${directory}`);
    }
    
    return true;
  } catch (error) {
    // Log error but don't fail the main operation
    if (config.logLevel === 'debug') {
      console.error(`⚠️ Could not update .gitignore: ${error}`);
    }
    return false;
  }
}
