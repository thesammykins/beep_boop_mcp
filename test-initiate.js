#!/usr/bin/env node

import { handleInitiateConversation } from './dist/tools.js';

async function test() {
  console.log('Testing handleInitiateConversation directly...');
  
  const params = {
    platform: 'discord',
    content: 'Direct test of handleInitiateConversation - please reply to test blocking behavior',
    agentId: 'test-direct'
  };
  
  console.log('Calling handleInitiateConversation...');
  const start = Date.now();
  
  try {
    const result = await handleInitiateConversation(params);
    const duration = Date.now() - start;
    
    console.log(`\nFunction completed in ${duration}ms`);
    console.log('Result:', JSON.stringify(result, null, 2));
    
    // If it took less than 5 seconds, it probably didn't wait
    if (duration < 5000) {
      console.log('\n⚠️  Function returned quickly - may not have waited for response');
    } else {
      console.log('\n✅ Function waited - blocking behavior working');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

test().catch(console.error);
