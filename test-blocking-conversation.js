#!/usr/bin/env node

// Force local implementation by setting environment
process.env.BEEP_BOOP_LISTENER_ENABLED = 'false';
process.env.BEEP_BOOP_DISCORD_DEFAULT_CHANNEL_ID = '1408235462769901598';

import { handleInitiateConversation } from './dist/tools.js';

async function testBlockingConversation() {
  console.log('🧪 Starting blocking conversation test...');
  console.log('📧 This will send a message to Discord and wait for your reply');
  console.log('⏰ Maximum wait time: 5 minutes\n');
  
  const params = {
    platform: 'discord',
    content: '🧪 **BLOCKING CONVERSATION TEST** 🧪\n\nHi! This is a test of the new blocking conversation feature. I\'m going to wait here for up to 5 minutes for your reply.\n\n**What to do:**\n1. Reply to this message in Discord\n2. Watch me detect your response and return immediately!\n\n**Testing:** True blocking behavior with polling every 2 seconds',
    agentId: 'test-blocking-agent'
  };
  
  const startTime = Date.now();
  console.log(`🚀 Calling initiate_conversation at ${new Date().toISOString()}`);
  console.log('⌛ Waiting for response...\n');
  
  try {
    const result = await handleInitiateConversation(params);
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`\n✅ Function completed after ${duration} seconds`);
    console.log('📄 Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (duration < 10) {
      console.log('\n⚠️  Function returned very quickly - check if message was sent properly');
    } else if (duration >= 300) {
      console.log('\n⏰ Function timed out after 5 minutes - no user response detected');
    } else {
      console.log('\n🎉 SUCCESS! User response detected and blocking behavior worked correctly!');
    }
    
  } catch (error) {
    console.error('\n❌ Error during test:', error);
  }
}

testBlockingConversation().catch(console.error);
