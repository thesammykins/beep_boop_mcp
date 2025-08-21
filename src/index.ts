#!/usr/bin/env node

/**
 * Beep/Boop MCP Server
 * A Model Context Protocol server for monorepo work coordination using beep/boop files
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CreateBeepSchema,
  UpdateBoopSchema, 
  EndWorkSchema,
  CheckStatusSchema,
  handleCreateBeep,
  handleUpdateBoop,
  handleEndWork,
  handleCheckStatus
} from './tools.js';
import { loadConfig, printConfigSummary, BeepBoopConfig } from './config.js';

/**
 * Create and configure the MCP server
 */
async function createServer(): Promise<McpServer> {
  const server = new McpServer({
    name: 'beep-boop-coordination',
    version: '1.0.0'
  });

  /**
   * Tool: create_beep
   * Creates a beep file to signal work completion and clearance for new work
   */
  server.registerTool(
    'create_beep',
    {
      title: 'Create Beep File',
      description: 'Creates a beep file to signal that work is complete and the directory is cleared for new work. Use this when work is finished but no boop file exists.',
      inputSchema: CreateBeepSchema.shape
    },
    async (params) => {
      return await handleCreateBeep(params);
    }
  );

  /**
   * Tool: update_boop
   * Creates or updates a boop file to signal work in progress
   */
  server.registerTool(
    'update_boop',
    {
      title: 'Update Boop File',
      description: 'Creates or updates a boop file to claim a directory for work. This signals that work is in progress and prevents other agents from working in the same directory.',
      inputSchema: UpdateBoopSchema.shape
    },
    async (params) => {
      return await handleUpdateBoop(params);
    }
  );

  /**
   * Tool: end_work
   * Atomically removes boop file and creates beep file to signal work completion
   */
  server.registerTool(
    'end_work',
    {
      title: 'End Work',
      description: 'Atomically completes work by removing the boop file and creating a beep file. This signals that work is complete and clears the directory for new work.',
      inputSchema: EndWorkSchema.shape
    },
    async (params) => {
      return await handleEndWork(params);
    }
  );

  /**
   * Tool: check_status
   * Returns current status of beep/boop files with detailed interpretation and optional stale cleanup
   */
  server.registerTool(
    'check_status',
    {
      title: 'Check Work Status',
      description: 'Checks the current work coordination status of a directory by examining beep/boop files, provides guidance on next steps, and can automatically clean up stale boop files older than a specified threshold.',
      inputSchema: CheckStatusSchema.shape
    },
    async (params) => {
      return await handleCheckStatus(params);
    }
  );

  /**
   * Tool: update_user
   * Sends a follow-up update back to the platform thread/user tied to a captured message
   */
  server.registerTool(
    'update_user',
    {
      title: 'Update User',
      description: 'Sends a follow-up update back to the platform (Slack/Discord) for a captured message.',
      inputSchema: (await import('./tools.js')).UpdateUserSchema.shape
    },
    async (params) => {
      const { handleUpdateUser } = await import('./tools.js');
      return await handleUpdateUser(params);
    }
  );

  return server;
}

/**
 * Main function to start the MCP server
 */
async function main(): Promise<void> {
  try {
    // Load and validate configuration
    const config = loadConfig();
    printConfigSummary(config);
    
    const server = await createServer();
    const transport = new StdioServerTransport();
    
    // Set up error handling for the transport
    transport.onclose = () => {
      console.error('Transport connection closed');
      process.exit(0);
    };

    // Connect the server to the transport
    await server.connect(transport);
    
    // Log to stderr so it doesn't interfere with MCP protocol on stdout
    console.error('🔗 Beep/Boop MCP Server started and connected');
    console.error('📋 Available tools:');
    console.error('   • create_beep - Create beep file to signal work completion');
    console.error('   • update_boop - Claim directory for work in progress');
    console.error('   • end_work - Complete work atomically');
    console.error('   • check_status - Check current coordination status with stale cleanup');
    console.error('🚀 Server ready for requests...');
    console.error('   • update_user - Send follow-up updates to Slack/Discord for captured messages');
    
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}

/**
 * Handle process signals for graceful shutdown
 */
process.on('SIGINT', () => {
  console.error('📴 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('📴 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('💥 Fatal error during startup:', error);
  process.exit(1);
});
