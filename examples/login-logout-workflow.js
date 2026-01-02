#!/usr/bin/env node

/**
 * Example workflow demonstrating the simplified login/logout functionality
 * 
 * This example shows:
 * 1. Login process - saving API key and testing authentication
 * 2. Status check - viewing saved configurations  
 * 3. Authentication testing
 * 4. Logout process - deleting API key
 */

import chalk from 'chalk';

function showWorkflowExample() {
  console.log(chalk.blue('🔄 Bizmanage CLI Authentication Workflow\n'));

  console.log(chalk.bold('1. Login Process'));
  console.log(chalk.dim('   Saves API key and tests authentication:'));
  console.log(chalk.cyan('   $ bizmanage login'));
  console.log(chalk.dim('   ? Instance URL: https://your-instance.bizmanage.com'));
  console.log(chalk.dim('   ? API Key: ••••••••••••••••'));
  console.log(chalk.dim('   ⠋ Testing authentication with /restapi/ping...'));
  console.log(chalk.green('   ✅ Authentication successful!'));
  console.log(chalk.green('   🎉 Login successful!'));
  console.log(chalk.green('      Alias: default'));
  console.log(chalk.green('      API Key: Saved securely'));
  console.log();

  console.log(chalk.bold('2. Check Status'));
  console.log(chalk.dim('   View saved configurations:'));
  console.log(chalk.cyan('   $ bizmanage status'));
  console.log(chalk.green('   🔑 Found 1 saved configuration(s):'));
  console.log();
  console.log(chalk.bold('   Alias: default'));
  console.log(chalk.dim('      Instance URL: https://your-instance.bizmanage.com'));
  console.log(chalk.dim('      API Key: abcd***5678'));
  console.log();

  console.log(chalk.bold('3. Test Authentication'));
  console.log(chalk.dim('   Verify API key still works:'));
  console.log(chalk.cyan('   $ bizmanage test'));
  console.log(chalk.blue('   🔍 Testing connection to Bizmanage API using alias: default'));
  console.log(chalk.dim('   ⠋ Running connection tests...'));
  console.log();
  console.log(chalk.green('   Bizmanage API Status Report'));
  console.log(chalk.gray('   ========================================'));
  console.log(chalk.cyan('   Instance URL: https://your-instance.bizmanage.com'));
  console.log(chalk.green('   API Key: abcd***5678'));
  console.log(chalk.green('   Status: ✓ Connected'));
  console.log(chalk.yellow('   Response Time: 234ms'));
  console.log(chalk.green('   Message: Authentication successful'));
  console.log(chalk.green('   HTTP Status: 200'));
  console.log();

  console.log(chalk.bold('4. Logout Process'));
  console.log(chalk.dim('   Delete saved API key:'));
  console.log(chalk.cyan('   $ bizmanage logout'));
  console.log(chalk.blue('   🔓 Bizmanage CLI Logout'));
  console.log(chalk.dim('   This will delete your saved API key and configuration'));
  console.log();
  console.log(chalk.green('   🗑️  API key and configuration deleted successfully'));
  console.log(chalk.green('      Alias: default'));
  console.log();
  console.log(chalk.blue('   💡 Use \'bizmanage login\' to save a new API key'));
  console.log();

  console.log(chalk.bold('5. Authentication Flow'));
  console.log(chalk.dim('   The authentication process:'));
  console.log(chalk.yellow('   • GET /restapi/ping endpoint is used for testing'));
  console.log(chalk.yellow('   • 200 response = authenticated ✅'));
  console.log(chalk.yellow('   • 403 response = not authenticated ❌'));
  console.log(chalk.yellow('   • API key is saved only after successful authentication'));
  console.log(chalk.yellow('   • Logout completely removes the API key'));
  console.log();

  console.log(chalk.bold('6. Multiple Environment Support'));
  console.log(chalk.dim('   Use aliases for different environments:'));
  console.log(chalk.cyan('   $ bizmanage login --alias production'));
  console.log(chalk.cyan('   $ bizmanage login --alias staging'));
  console.log(chalk.cyan('   $ bizmanage test --alias production'));
  console.log(chalk.cyan('   $ bizmanage logout --alias staging'));
  console.log(chalk.cyan('   $ bizmanage logout --all  # Remove all'));
  console.log();

  console.log(chalk.green('✨ The CLI now provides simple, secure API key management!'));
}

showWorkflowExample();
