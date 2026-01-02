#!/usr/bin/env node

/**
 * Example script showing how to use BizmanageService for authentication testing
 * 
 * This script demonstrates:
 * 1. Loading authentication configuration
 * 2. Testing API connection with ping
 * 3. Getting detailed status reports
 * 4. Handling different authentication scenarios
 */

import { AuthService } from '../src/services/auth.js';
import { BizmanageService } from '../src/services/bizmanage.js';
import chalk from 'chalk';

async function testAuthentication() {
  console.log(chalk.blue('🧪 Bizmanage Authentication Test Example\n'));

  const authService = new AuthService();
  
  // Check if default configuration exists
  if (!authService.hasAlias('default')) {
    console.log(chalk.red('❌ No default configuration found.'));
    console.log(chalk.yellow('   Run: bizmanage login'));
    return;
  }

  // Load configuration
  const config = await authService.getConfig('default');
  if (!config) {
    console.log(chalk.red('❌ Failed to load configuration.'));
    return;
  }

  console.log(chalk.cyan('📋 Configuration loaded:'));
  console.log(`   Instance URL: ${config.instanceUrl}`);
  console.log(`   API Key: ${config.apiKey.substring(0, 4)}***${config.apiKey.substring(config.apiKey.length - 4)}\n`);

  // Create Bizmanage service
  const bizmanageService = new BizmanageService(config);

  // Test 1: Configuration validation
  console.log(chalk.blue('🔍 Step 1: Validating configuration...'));
  const validation = bizmanageService.validateConfig();
  
  if (validation.valid) {
    console.log(chalk.green('   ✅ Configuration is valid\n'));
  } else {
    console.log(chalk.red('   ❌ Configuration errors:'));
    validation.errors.forEach(error => console.log(chalk.red(`      - ${error}`)));
    return;
  }

  // Test 2: Simple ping test
  console.log(chalk.blue('🏓 Step 2: Testing authentication with ping...'));
  
  try {
    const pingResult = await bizmanageService.ping();
    
    if (pingResult.authenticated) {
      console.log(chalk.green(`   ✅ Authentication successful (HTTP ${pingResult.status})`));
      console.log(chalk.green(`   📝 ${pingResult.message}`));
    } else {
      console.log(chalk.red(`   ❌ Authentication failed (HTTP ${pingResult.status})`));
      console.log(chalk.red(`   📝 ${pingResult.message}`));
    }
  } catch (error) {
    console.log(chalk.red(`   ❌ Ping test error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }

  console.log('');

  // Test 3: Connection test with timing
  console.log(chalk.blue('⚡ Step 3: Running connection test with diagnostics...'));
  
  try {
    const connectionTest = await bizmanageService.testConnection();
    
    if (connectionTest.success) {
      console.log(chalk.green(`   ✅ Connection successful (${connectionTest.responseTime}ms)`));
    } else {
      console.log(chalk.red(`   ❌ Connection failed (${connectionTest.responseTime}ms)`));
    }
    
    console.log(`   📊 HTTP Status: ${connectionTest.status}`);
    console.log(`   📝 Message: ${connectionTest.message}`);
  } catch (error) {
    console.log(chalk.red(`   ❌ Connection test error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }

  console.log('');

  // Test 4: Full status report
  console.log(chalk.blue('📊 Step 4: Generating status report...\n'));
  
  try {
    const statusReport = await bizmanageService.getStatusReport();
    console.log(statusReport);
  } catch (error) {
    console.log(chalk.red(`❌ Status report error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

// Run the test
testAuthentication().catch(error => {
  console.error(chalk.red(`💥 Script failed: ${error.message}`));
  process.exit(1);
});
