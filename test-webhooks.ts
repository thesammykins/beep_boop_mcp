#!/usr/bin/env tsx

/**
 * Test script for webhook notifications
 * 
 * Usage:
 * npm run build && tsx test-webhooks.ts
 */

import { NotificationManager, NotificationType } from './src/notification-service.js';
import { loadConfig } from './src/config.js';

async function testWebhooks() {
  console.log('🧪 Testing Webhook Integration...\n');
  
  // Load configuration
  const config = loadConfig();
  
  if (!config.enableNotifications) {
    console.log('❌ Notifications are disabled. Set BEEP_BOOP_ENABLE_NOTIFICATIONS=true to test.');
    return;
  }
  
  if (!config.discordWebhookUrl && !config.slackWebhookUrl) {
    console.log('❌ No webhook URLs configured. Set BEEP_BOOP_DISCORD_WEBHOOK_URL and/or BEEP_BOOP_SLACK_WEBHOOK_URL');
    return;
  }
  
  console.log('📋 Configuration:');
  console.log(`   • Discord webhook: ${config.discordWebhookUrl ? 'configured' : 'not configured'}`);
  console.log(`   • Slack webhook: ${config.slackWebhookUrl ? 'configured' : 'not configured'}`);
  console.log(`   • Service: ${config.notificationService}`);
  console.log(`   • Retry attempts: ${config.notificationRetryAttempts}`);
  console.log('');
  
  // Create notification manager
  const notificationManager = new NotificationManager(config);
  
  // Test different notification types
  const testCases = [
    {
      type: NotificationType.WORK_STARTED,
      message: 'Test work started notification',
      directory: './test-directory',
      agentId: 'test-agent-1',
      workDescription: 'Testing webhook integration'
    },
    {
      type: NotificationType.WORK_COMPLETED,
      message: 'Test work completed notification',
      directory: './test-directory',
      agentId: 'test-agent-1',
      workDescription: 'Testing webhook integration completed',
      metadata: { durationMinutes: 5, durationMs: 300000 }
    },
    {
      type: NotificationType.STALE_DETECTED,
      message: 'Test stale work detection',
      directory: './test-directory',
      agentId: 'test-agent-2',
      metadata: { ageHours: 25, threshold: 24 }
    },
    {
      type: NotificationType.CLEANUP_PERFORMED,
      message: 'Test cleanup notification',
      directory: './test-directory',
      agentId: 'test-agent-3',
      workDescription: 'Claimed after cleanup',
      metadata: { previousAgent: 'test-agent-2', newAgent: 'test-agent-3' }
    }
  ];
  
  console.log('🚀 Sending test notifications...\n');
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    console.log(`📤 Test ${i + 1}/4: ${testCase.type}...`);
    
    try {
      const payload = NotificationManager.createPayload(
        testCase.type,
        testCase.message,
        testCase.directory,
        testCase.agentId,
        testCase.workDescription,
        testCase.metadata
      );
      
      await notificationManager.sendNotification(payload);
      console.log('   ✅ Notification sent successfully');
      
      // Wait a bit between notifications to avoid rate limiting
      if (i < testCases.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.log(`   ❌ Notification failed: ${error}`);
    }
  }
  
  console.log('\n🏁 Webhook integration test completed!');
  console.log('Check your Discord/Slack channels to verify notifications were received.');
}

// Test invalid webhook URLs
async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling...\n');
  
  const invalidConfig = {
    ...loadConfig(),
    discordWebhookUrl: 'https://invalid-discord-url.com/webhook',
    slackWebhookUrl: 'https://invalid-slack-url.com/webhook',
    enableNotifications: true,
    notificationService: 'both' as const,
    notificationRetryAttempts: 1, // Reduce retries for faster test
    notificationTimeoutMs: 1000
  };
  
  const notificationManager = new NotificationManager(invalidConfig);
  
  console.log('📤 Testing with invalid webhook URLs...');
  
  try {
    const payload = NotificationManager.createPayload(
      NotificationType.WORK_STARTED,
      'Test error handling',
      './test-directory',
      'test-agent-error'
    );
    
    await notificationManager.sendNotification(payload);
    console.log('   ✅ Error handling test completed (notifications should have failed gracefully)');
    
  } catch (error) {
    console.log(`   ❌ Unexpected error: ${error}`);
  }
}

async function main() {
  try {
    await testWebhooks();
    await testErrorHandling();
    
    console.log('\n🎉 All tests completed! Check the logs above for results.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Test script failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
