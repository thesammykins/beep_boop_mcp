/**
 * Types and interfaces for the beep/boop coordination system
 */

/** Status of work coordination files */
export interface WorkStatus {
  /** Whether beep file exists (work is complete/cleared) */
  beepExists: boolean;
  /** Whether boop file exists (work is in progress) */
  boopExists: boolean;
  /** Current working directory being checked */
  directory: string;
  /** Interpretation of the current state */
  status: WorkState;
  /** Additional details about the state */
  details: string;
  /** Agent identifier if boop file exists */
  agentId?: string;
  /** Timestamp of beep file if it exists */
  beepTimestamp?: Date;
  /** Timestamp of boop file if it exists */
  boopTimestamp?: Date;
}

/** Different states of work coordination */
export enum WorkState {
  /** Work is allowed - beep file exists, no boop file */
  WORK_ALLOWED = "work_allowed",
  /** Work is in progress - boop file exists */
  WORK_IN_PROGRESS = "work_in_progress", 
  /** No coordination files exist - need to claim work */
  NO_COORDINATION = "no_coordination",
  /** Both files exist - invalid state */
  INVALID_STATE = "invalid_state"
}

/** Parameters for creating a beep file */
export interface CreateBeepParams {
  /** Directory path where to create the beep file */
  directory: string;
  /** Optional message to include in the beep file */
  message?: string;
}

/** Parameters for updating/creating a boop file */
export interface UpdateBoopParams {
  /** Directory path where to create/update the boop file */
  directory: string;
  /** Agent identifier claiming the work */
  agentId: string;
  /** Optional description of the work being done */
  workDescription?: string;
}

/** Parameters for ending work */
export interface EndWorkParams {
  /** Directory path where work is being completed */
  directory: string;
  /** Agent identifier that was doing the work */
  agentId: string;
  /** Optional completion message */
  message?: string;
}

/** Parameters for checking status */
export interface CheckStatusParams {
  /** Directory path to check */
  directory: string;
  /** Maximum age in hours for boop files before considering them stale (default: 24) */
  maxAgeHours?: number;
  /** Whether to automatically clean up stale boop files (default: false) */
  autoCleanStale?: boolean;
  /** Agent ID to use when claiming after stale cleanup */
  newAgentId?: string;
  /** Work description when claiming after cleanup */
  newWorkDescription?: string;
}

/** File metadata information */
export interface FileMetadata {
  /** When the file was created/modified */
  timestamp: Date;
  /** Size of the file in bytes */
  size: number;
  /** Content of the file if readable */
  content?: string;
}

/** Content stored in a beep file */
export interface BeepFileContent {
  /** When work was completed */
  completedAt: Date;
  /** Optional completion message */
  message?: string;
  /** Agent that completed the work */
  completedBy?: string;
}

/** Content stored in a boop file */
export interface BoopFileContent {
  /** When work started */
  startedAt: Date;
  /** Agent identifier doing the work */
  agentId: string;
  /** Optional description of work being done */
  workDescription?: string;
}

/** Custom error types for coordination system */
export class CoordinationError extends Error {
  constructor(message: string, public code: string, public directory?: string) {
    super(message);
    this.name = 'CoordinationError';
  }
}

/** Error codes for different coordination issues */
export enum ErrorCode {
  DIRECTORY_NOT_FOUND = "DIRECTORY_NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED", 
  FILE_SYSTEM_ERROR = "FILE_SYSTEM_ERROR",
  INVALID_AGENT_ID = "INVALID_AGENT_ID",
  WORK_ALREADY_IN_PROGRESS = "WORK_ALREADY_IN_PROGRESS",
  WORK_NOT_CLAIMED = "WORK_NOT_CLAIMED",
  INVALID_STATE = "INVALID_STATE",
  AGENT_MISMATCH = "AGENT_MISMATCH"
}

/** Tool response content matching MCP SDK format */
export interface ToolResponse {
  [x: string]: unknown;
  content: Array<{
    [x: string]: unknown;
    type: "text";
    text: string;
    _meta?: { [x: string]: unknown } | undefined;
  }>;
  isError?: boolean | undefined;
  _meta?: { [x: string]: unknown } | undefined;
}

/** Parameters for sending a user update back to chat platforms */
export interface UpdateUserParams {
  /** ID of the captured message in the inbox store */
  messageId: string;
  /** Message content to send as an update */
  updateContent: string;
}

/** Parameters for initiating a new conversation proactively */
export interface InitiateConversationParams {
  /** Platform to send message to ('slack' or 'discord') */
  platform: 'slack' | 'discord';
  /** Channel ID to send message to (optional - uses default if not specified) */
  channelId?: string;
  /** Initial message content to send */
  content: string;
  /** Optional agent ID for attribution */
  agentId?: string;
}
