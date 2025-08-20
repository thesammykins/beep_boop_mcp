/**
 * MCP tools for beep/boop work coordination system
 */

import { z } from 'zod';
import { 
  ToolResponse,
  CoordinationError,
  WorkState,
  CreateBeepParams,
  UpdateBoopParams,
  EndWorkParams,
  CheckStatusParams
} from './types.js';
import {
  createBeepFile,
  createBoopFile,
  endWorkAtomically,
  getWorkStatus,
  validateAgentId,
  validateAgentIdWithConfig,
  validateDirectoryAccess,
  isFileStale,
  getFileAgeDescription,
  cleanupStaleBoopAndClaim
} from './file-operations.js';
import { loadConfig } from './config.js';

/**
 * Schema for create_beep tool parameters
 */
export const CreateBeepSchema = z.object({
  directory: z.string().describe('Directory path where to create the beep file'),
  message: z.string().optional().describe('Optional completion message')
});

/**
 * Schema for update_boop tool parameters  
 */
export const UpdateBoopSchema = z.object({
  directory: z.string().describe('Directory path where to create/update the boop file'),
  agentId: z.string().describe('Agent identifier claiming the work'),
  workDescription: z.string().optional().describe('Optional description of the work being done')
});

/**
 * Schema for end_work tool parameters
 */
export const EndWorkSchema = z.object({
  directory: z.string().describe('Directory path where work is being completed'),
  agentId: z.string().describe('Agent identifier that was doing the work'),
  message: z.string().optional().describe('Optional completion message')
});

/**
 * Schema for check_status tool parameters
 */
export const CheckStatusSchema = z.object({
  directory: z.string().describe('Directory path to check'),
  maxAgeHours: z.number().optional().default(24).describe('Maximum age in hours for boop files before considering them stale (default: 24)'),
  autoCleanStale: z.boolean().optional().default(false).describe('Whether to automatically clean up stale boop files (default: false)'),
  newAgentId: z.string().optional().describe('Agent ID to use when claiming after stale cleanup'),
  newWorkDescription: z.string().optional().describe('Work description when claiming after cleanup')
});

/**
 * Tool: create_beep
 * Creates a beep file to signal work completion
 */
export async function handleCreateBeep(params: CreateBeepParams): Promise<ToolResponse> {
  try {
    const { directory, message } = params;
    const config = loadConfig();
    
    // Validate directory access
    try {
      validateDirectoryAccess(directory, config);
    } catch (accessError) {
      if (accessError instanceof CoordinationError) {
        return {
          content: [{
            type: "text",
            text: `❌ ${accessError.message}`
          }],
          isError: true
        };
      }
      throw accessError;
    }
    
    // Check current status first
    const status = await getWorkStatus(directory);
    
    if (status.status === WorkState.WORK_IN_PROGRESS) {
      return {
        content: [{
          type: "text",
          text: `⚠️ Cannot create beep file: Work is currently in progress by agent ${status.agentId}. Use end_work tool instead.`
        }],
        isError: true
      };
    }

    await createBeepFile(directory, message, undefined, config);
    
    return {
      content: [{
        type: "text", 
        text: `✅ Beep file created successfully in ${directory}. Work is now marked as complete and cleared for new work.`
      }]
    };
  } catch (error) {
    if (error instanceof CoordinationError) {
      return {
        content: [{
          type: "text",
          text: `❌ ${error.message} (${error.code})`
        }],
        isError: true
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `❌ Unexpected error creating beep file: ${error}`
      }],
      isError: true
    };
  }
}

/**
 * Tool: update_boop  
 * Creates or updates a boop file to signal work in progress
 */
export async function handleUpdateBoop(params: UpdateBoopParams): Promise<ToolResponse> {
  try {
    const { directory, agentId, workDescription } = params;
    const config = loadConfig();
    
    // Validate directory access
    try {
      validateDirectoryAccess(directory, config);
    } catch (accessError) {
      if (accessError instanceof CoordinationError) {
        return {
          content: [{
            type: "text",
            text: `❌ ${accessError.message}`
          }],
          isError: true
        };
      }
      throw accessError;
    }
    
    // Validate agent ID with configuration
    if (!validateAgentIdWithConfig(agentId, config)) {
      const reasons = [];
      if (agentId.length > config.maxAgentIdLength) {
        reasons.push(`exceeds maximum length of ${config.maxAgentIdLength}`);
      }
      if (config.requireTeamPrefix && config.teamPrefixes.length > 0) {
        const hasValidPrefix = config.teamPrefixes.some(prefix => agentId.startsWith(prefix));
        if (!hasValidPrefix) {
          reasons.push(`must start with one of: ${config.teamPrefixes.join(', ')}`);
        }
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(agentId)) {
        reasons.push('contains invalid characters (only alphanumeric, hyphens, underscores, dots allowed)');
      }
      
      return {
        content: [{
          type: "text",
          text: `❌ Invalid agent ID "${agentId}": ${reasons.join(', ')}`
        }],
        isError: true
      };
    }

    // Check current status
    const status = await getWorkStatus(directory);
    
    if (status.status === WorkState.WORK_IN_PROGRESS && status.agentId !== agentId) {
      return {
        content: [{
          type: "text",
          text: `⚠️ Cannot claim work: Directory is already being worked on by agent ${status.agentId}. Wait for work to complete or use check_status to monitor progress.`
        }],
        isError: true
      };
    }

    await createBoopFile(directory, agentId, workDescription, config);
    
    const actionText = status.status === WorkState.WORK_IN_PROGRESS 
      ? 'updated' 
      : 'created';
    
    return {
      content: [{
        type: "text",
        text: `✅ Boop file ${actionText} successfully in ${directory}. Work is now claimed by agent ${agentId}.${workDescription ? ` Work: ${workDescription}` : ''}`
      }]
    };
  } catch (error) {
    if (error instanceof CoordinationError) {
      return {
        content: [{
          type: "text",
          text: `❌ ${error.message} (${error.code})`
        }],
        isError: true
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `❌ Unexpected error updating boop file: ${error}`
      }],
      isError: true
    };
  }
}

/**
 * Tool: end_work
 * Atomically removes boop file and creates beep file to signal work completion
 */
export async function handleEndWork(params: EndWorkParams): Promise<ToolResponse> {
  try {
    const { directory, agentId, message } = params;
    const config = loadConfig();
    
    // Validate directory access
    try {
      validateDirectoryAccess(directory, config);
    } catch (accessError) {
      if (accessError instanceof CoordinationError) {
        return {
          content: [{
            type: "text",
            text: `❌ ${accessError.message}`
          }],
          isError: true
        };
      }
      throw accessError;
    }
    
    // Validate agent ID with configuration
    if (!validateAgentIdWithConfig(agentId, config)) {
      const reasons = [];
      if (agentId.length > config.maxAgentIdLength) {
        reasons.push(`exceeds maximum length of ${config.maxAgentIdLength}`);
      }
      if (config.requireTeamPrefix && config.teamPrefixes.length > 0) {
        const hasValidPrefix = config.teamPrefixes.some(prefix => agentId.startsWith(prefix));
        if (!hasValidPrefix) {
          reasons.push(`must start with one of: ${config.teamPrefixes.join(', ')}`);
        }
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(agentId)) {
        reasons.push('contains invalid characters (only alphanumeric, hyphens, underscores, dots allowed)');
      }
      
      return {
        content: [{
          type: "text",
          text: `❌ Invalid agent ID "${agentId}": ${reasons.join(', ')}`
        }],
        isError: true
      };
    }

    await endWorkAtomically(directory, agentId, message, config);
    
    return {
      content: [{
        type: "text",
        text: `✅ Work completed successfully by agent ${agentId} in ${directory}. Boop file removed and beep file created.${message ? ` Message: ${message}` : ''}`
      }]
    };
  } catch (error) {
    if (error instanceof CoordinationError) {
      return {
        content: [{
          type: "text",
          text: `❌ ${error.message} (${error.code})`
        }],
        isError: true
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `❌ Unexpected error ending work: ${error}`
      }],
      isError: true
    };
  }
}

/**
 * Tool: check_status
 * Returns current status of beep/boop files with interpretation and optional stale cleanup
 */
export async function handleCheckStatus(params: CheckStatusParams): Promise<ToolResponse> {
  try {
    const { 
      directory, 
      maxAgeHours = 24, 
      autoCleanStale = false, 
      newAgentId, 
      newWorkDescription 
    } = params;
    
    let status = await getWorkStatus(directory);
    let cleanupPerformed = false;
    let cleanupMessage = '';
    
    // Check for stale boop file if work is in progress
    if (status.status === WorkState.WORK_IN_PROGRESS && status.boopTimestamp) {
      const isStale = isFileStale(status.boopTimestamp, maxAgeHours);
      const ageDescription = getFileAgeDescription(status.boopTimestamp);
      
      if (isStale) {
        if (autoCleanStale) {
          // Validate new agent ID if provided
          if (newAgentId) {
            const config = loadConfig();
            if (!validateAgentIdWithConfig(newAgentId, config)) {
              const reasons = [];
              if (newAgentId.length > config.maxAgentIdLength) {
                reasons.push(`exceeds maximum length of ${config.maxAgentIdLength}`);
              }
              if (config.requireTeamPrefix && config.teamPrefixes.length > 0) {
                const hasValidPrefix = config.teamPrefixes.some(prefix => newAgentId.startsWith(prefix));
                if (!hasValidPrefix) {
                  reasons.push(`must start with one of: ${config.teamPrefixes.join(', ')}`);
                }
              }
              if (!/^[a-zA-Z0-9._-]+$/.test(newAgentId)) {
                reasons.push('contains invalid characters (only alphanumeric, hyphens, underscores, dots allowed)');
              }
              
              return {
                content: [{
                  type: "text",
                  text: `❌ Invalid new agent ID "${newAgentId}": ${reasons.join(', ')}`
                }],
                isError: true
              };
            }
          }
          
          // Perform automatic cleanup
          try {
            const cleanup = await cleanupStaleBoopAndClaim(
              directory,
              status.agentId || 'unknown',
              newAgentId,
              newWorkDescription
            );
            
            cleanupPerformed = true;
            cleanupMessage = cleanup.message;
            
            // Get updated status after cleanup
            status = await getWorkStatus(directory);
            
          } catch (cleanupError) {
            return {
              content: [{
                type: "text",
                text: `❌ Failed to cleanup stale boop file: ${cleanupError instanceof Error ? cleanupError.message : cleanupError}`
              }],
              isError: true
            };
          }
        } else {
          // Just report stale file without cleanup
          cleanupMessage = `⚠️ STALE BOOP DETECTED: File is ${ageDescription} old (threshold: ${maxAgeHours} hours). Use autoCleanStale=true to automatically clean up.`;
        }
      }
    }
    
    // Format timestamps with age info
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

    // Choose appropriate emoji and status text
    let statusEmoji = '';
    let statusText = '';
    
    switch (status.status) {
      case WorkState.WORK_ALLOWED:
        statusEmoji = '✅';
        statusText = 'WORK ALLOWED';
        break;
      case WorkState.WORK_IN_PROGRESS:
        statusEmoji = '🚧';
        statusText = 'WORK IN PROGRESS';
        break;
      case WorkState.NO_COORDINATION:
        statusEmoji = '⭕';
        statusText = 'NO COORDINATION';
        break;
      case WorkState.INVALID_STATE:
        statusEmoji = '⚠️';
        statusText = 'INVALID STATE';
        break;
    }

    // Build response text
    let responseText = `${statusEmoji} ${statusText}\n\n📁 Directory: ${status.directory}\n📄 Beep file exists: ${status.beepExists}\n📄 Boop file exists: ${status.boopExists}`;
    
    if (status.agentId) {
      responseText += `\n👤 Agent: ${status.agentId}`;
    }
    
    responseText += timestampInfo;
    
    if (cleanupMessage) {
      responseText += `\n\n🧹 Cleanup Action: ${cleanupMessage}`;
    }
    
    responseText += `\n\nℹ️ ${status.details}`;
    
    responseText += `\n\n💡 Next steps:\n${getNextStepsRecommendation(status, cleanupPerformed)}`;
    
    // Add stale detection info if applicable
    if (maxAgeHours !== 24) {
      responseText += `\n\n🕒 Stale threshold: ${maxAgeHours} hours`;
    }

    return {
      content: [{
        type: "text",
        text: responseText
      }]
    };
  } catch (error) {
    if (error instanceof CoordinationError) {
      return {
        content: [{
          type: "text",
          text: `❌ ${error.message} (${error.code})`
        }],
        isError: true
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `❌ Unexpected error checking status: ${error}`
      }],
      isError: true
    };
  }
}

/**
 * Generate next steps recommendation based on current status
 */
function getNextStepsRecommendation(status: any, cleanupPerformed: boolean = false): string {
  if (cleanupPerformed) {
    switch (status.status) {
      case WorkState.WORK_ALLOWED:
        return '• Stale file was cleaned up and directory is now clear for work\n• You can start new work by using update_boop to claim the directory';
      case WorkState.WORK_IN_PROGRESS:
        return '• Stale file was cleaned up and directory was claimed by new agent\n• Proceed with your work as planned';
      default:
        return '• Cleanup was performed, check current status';
    }
  }
  
  switch (status.status) {
    case WorkState.WORK_ALLOWED:
      return '• You can start new work by using update_boop to claim the directory';
      
    case WorkState.WORK_IN_PROGRESS:
      if (status.agentId) {
        return `• If you are agent "${status.agentId}", use end_work when complete\n• If you are a different agent, wait for work to finish\n• To check for stale files, use check_status with autoCleanStale=true`;
      } else {
        return '• Wait for current work to complete or investigate boop file contents';
      }
      
    case WorkState.NO_COORDINATION:
      return '• Use update_boop to claim directory and start work\n• Or use create_beep if work is already complete';
      
    case WorkState.INVALID_STATE:
      return '• Manual cleanup required: both beep and boop files exist\n• Investigate file contents and remove one of the files\n• Consider using end_work if current work is finishing';
      
    default:
      return '• Use check_status again to get current state';
  }
}
