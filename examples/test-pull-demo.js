#!/usr/bin/env node

// Test the pull command with actual API integration
// This file demonstrates the new project structure implementation

import { AuthService } from '../src/services/auth.js';
import { ApiService } from '../src/services/api.js';
import { ProjectStructureService } from '../src/services/project-structure.js';
import chalk from 'chalk';

async function testPullDemo() {
  console.log(chalk.blue('🧪 Testing Pull Command with Real API'));
  console.log();

  try {
    // Test with default alias
    const authService = new AuthService();
    const config = await authService.getConfig('default');

    if (!config) {
      console.log(chalk.red('❌ No default configuration found'));
      console.log(chalk.dim('Please run "bizmanage login" first'));
      return;
    }

    console.log(chalk.green('✅ Found configuration'));
    console.log(chalk.dim(`Instance: ${config.instanceUrl}`));
    console.log();

    const apiService = new ApiService(config);
    
    // Test fetching tables
    console.log(chalk.blue('📋 Fetching tables from API...'));
    
    try {
      const tables = await apiService.fetchTables();
      console.log(chalk.green(`✅ Successfully fetched ${tables.length} tables`));
      
      // Show some sample tables
      const sampleTables = tables.slice(0, 5);
      console.log(chalk.bold('\nSample tables:'));
      sampleTables.forEach(table => {
        const type = table.system ? 'System' : 'Custom';
        console.log(chalk.dim(`  • ${table.display_name} (${table.internal_name}) - ${type}`));
      });

      // Test converting to objects
      console.log(chalk.blue('\n🔄 Converting tables to objects...'));
      const objects = await apiService.fetchObjects();
      console.log(chalk.green(`✅ Converted to ${objects.length} objects`));
      
      // Show some sample objects
      const sampleObjects = objects.slice(0, 3);
      console.log(chalk.bold('\nSample objects:'));
      sampleObjects.forEach(obj => {
        console.log(chalk.dim(`  • ${obj.definition.settings?.displayName} (${obj.name})`));
        console.log(chalk.dim(`    - Fields: ${obj.definition.fields.length}`));
        console.log(chalk.dim(`    - Actions: ${obj.actions.length}`));
      });

    } catch (apiError) {
      console.log(chalk.red('❌ API Error:'), apiError instanceof Error ? apiError.message : 'Unknown error');
      
      // If it's an authentication error, provide helpful guidance
      if (apiError instanceof Error && apiError.message.includes('403')) {
        console.log(chalk.yellow('\n💡 This might be an authentication issue.'));
        console.log(chalk.dim('• Check if your API key is correct'));
        console.log(chalk.dim('• Verify your instance URL is correct'));
        console.log(chalk.dim('• Make sure your API key has the necessary permissions'));
      }
    }

  } catch (error) {
    console.log(chalk.red('❌ Test failed:'), error instanceof Error ? error.message : 'Unknown error');
  }
}

// Run the test
testPullDemo().catch(console.error);
