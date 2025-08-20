#!/usr/bin/env node

/**
 * Example client script demonstrating how to use the Beep/Boop MCP Server
 * This is a simple demonstration - in practice you'd integrate with your MCP client
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

/**
 * Simple MCP client simulation for testing the beep/boop server
 */
class SimpleClient {
  constructor() {
    this.requestId = 1;
    this.server = null;
  }

  async start() {
    console.log('🚀 Starting Beep/Boop MCP Server example...\n');
    
    // Start the server
    this.server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    // Set up communication
    const rl = createInterface({
      input: this.server.stdout,
      crlfDelay: Infinity
    });

    // Initialize the connection
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'beep-boop-example',
        version: '1.0.0'
      }
    });

    // List available tools
    console.log('📋 Available tools:');
    const tools = await this.sendRequest('tools/list');
    tools.tools?.forEach(tool => {
      console.log(`   • ${tool.name} - ${tool.description}`);
    });
    console.log();

    // Demo the workflow
    await this.demoWorkflow();
    
    this.server.kill();
  }

  async demoWorkflow() {
    const testDir = '/tmp/beep-boop-test';
    const agentId = 'example-client';

    console.log('🔍 Demo: Checking initial status...');
    await this.callTool('check_status', { directory: testDir });

    console.log('\n📝 Demo: Claiming directory for work...');
    await this.callTool('update_boop', {
      directory: testDir,
      agentId: agentId,
      workDescription: 'Testing the coordination system'
    });

    console.log('\n🔍 Demo: Checking status after claiming...');
    await this.callTool('check_status', { directory: testDir });

    console.log('\n✅ Demo: Completing work...');
    await this.callTool('end_work', {
      directory: testDir,
      agentId: agentId,
      message: 'Demo completed successfully'
    });

    console.log('\n🔍 Demo: Final status check...');
    await this.callTool('check_status', { directory: testDir });
  }

  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: method,
        params: params
      };

      let response = '';
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      const responseHandler = (data) => {
        response += data.toString();
        
        // Look for complete JSON-RPC response
        try {
          const parsed = JSON.parse(response);
          if (parsed.id === request.id) {
            clearTimeout(timeout);
            this.server.stdout.removeListener('data', responseHandler);
            resolve(parsed.result || parsed);
          }
        } catch (e) {
          // Not complete yet, continue reading
        }
      };

      this.server.stdout.on('data', responseHandler);
      this.server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async callTool(name, arguments_) {
    console.log(`🔧 Calling tool: ${name}`);
    
    try {
      const result = await this.sendRequest('tools/call', {
        name: name,
        arguments: arguments_
      });

      if (result.content) {
        result.content.forEach(item => {
          if (item.type === 'text') {
            console.log(item.text);
          }
        });
      }
      
      if (result.isError) {
        console.log('❌ Tool returned error');
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Error calling tool ${name}:`, error.message);
      return null;
    }
  }
}

// Run the example if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new SimpleClient();
  
  client.start().then(() => {
    console.log('\n✨ Example completed successfully!');
    console.log('\n💡 To use in your own projects:');
    console.log('   1. Add the server to your MCP client configuration');
    console.log('   2. Use the four tools: check_status, update_boop, end_work, create_beep');
    console.log('   3. Follow the workflow in AGENT_COORDINATION_RULE.md');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Example failed:', error);
    process.exit(1);
  });
}
