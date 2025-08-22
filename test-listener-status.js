#!/usr/bin/env node

import { handleCheckListenerStatus } from './dist/tools.js';

async function testListenerStatus() {
  console.log('Testing listener status...\n');
  
  try {
    const result = await handleCheckListenerStatus({ includeConfig: true });
    console.log('Result:');
    console.log(result.content[0].text);
  } catch (error) {
    console.error('Error:', error);
  }
}

testListenerStatus().catch(console.error);
