import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { AuthService } from '../services/auth.js';
import { BizmanageService } from '../services/bizmanage.js';
import { logger } from '../utils/logger.js';

export const loginCommand = new Command()
  .name('login')
  .description('Login to Bizmanage platform by saving API key and testing authentication')
  .option('-a, --alias <alias>', 'Configuration alias (default: default)', 'default')
  .option('-p, --project <path>', 'Save credentials to project directory instead of global config')
  .action(async (options) => {
    const commandLogger = logger.child('login');
    commandLogger.debug('Starting login command', { alias: options.alias, project: options.project });
    
    console.log(chalk.blue('🔐 Bizmanage CLI Login'));
    console.log(chalk.dim('This will save your API key and test authentication using /restapi/ping'));
    console.log();

    try {
      // Prompt for credentials
      commandLogger.debug('Prompting user for credentials');
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'instanceUrl',
          message: 'Instance URL:',
          validate: (input) => {
            if (!input.trim()) return 'Instance URL is required';
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL (e.g., https://your-instance.bizmanage.com)';
            }
          }
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API Key:',
          validate: (input) => input.trim() ? true : 'API Key is required'
        }
      ]);

      commandLogger.debug('Credentials collected', { 
        instanceUrl: answers.instanceUrl,
        hasApiKey: !!answers.apiKey 
      });

      // Test authentication before saving
      console.log();
      const spinner = ora('Testing authentication with /restapi/ping...').start();

      let instanceUrl = answers.instanceUrl.trim();
      // remove trailing slash if present
      if (instanceUrl.endsWith('/')) {
        commandLogger.debug('Removing trailing slash from instance URL');
        instanceUrl = instanceUrl.slice(0, -1);
      }
      const apiKey = answers.apiKey.trim();

      const bizmanageService = new BizmanageService({
        instanceUrl,
        apiKey
      });

      const pingResult = await bizmanageService.ping();

      if (pingResult.authenticated) {
        spinner.succeed(chalk.green('Authentication successful! ✅'));
        commandLogger.info('Authentication successful, saving configuration');
        
        // Save API key and configuration
        const authService = new AuthService(options.project ? path.resolve(options.project) : undefined);
        await authService.saveConfig(options.alias, {
          instanceUrl: answers.instanceUrl,
          apiKey: answers.apiKey
        });

        commandLogger.success('Login completed successfully', {
          alias: options.alias,
          instanceUrl: answers.instanceUrl,
          projectLocal: !!options.project
        });

        const configLocation = options.project ? `project directory (${path.resolve(options.project)})` : 'global config';
        
        console.log();
        console.log(chalk.green(`🎉 Login successful!`));
        console.log(chalk.green(`   Alias: ${chalk.bold(options.alias)}`));
        console.log(chalk.green(`   API Key: Saved securely`));
        console.log(chalk.dim(`   Config location: ${configLocation}`));
        console.log(chalk.dim(`   Config file: ${authService.getConfigPath()}`));
        console.log();
        console.log(chalk.blue(`💡 Use 'bizmanage test' to verify your connection anytime`));
        console.log(chalk.blue(`💡 Use 'bizmanage logout' to remove saved credentials`));
      } else {
        spinner.fail(chalk.red('Authentication failed ❌'));
        commandLogger.warn('Authentication failed', {
          status: pingResult.status,
          message: pingResult.message
        });
        
        console.log();
        console.log(chalk.red(`Error: ${pingResult.message}`));
        
        // Provide helpful suggestions based on error type
        if (pingResult.status === 403) {
          console.log(chalk.yellow('💡 Suggestions:'));
          console.log(chalk.yellow('   • Check if your API key is correct'));
          console.log(chalk.yellow('   • Verify the API key has proper permissions'));
          console.log(chalk.yellow('   • Make sure the API key hasn\'t expired'));
        } else if (pingResult.status === 404) {
          console.log(chalk.yellow('💡 Suggestions:'));
          console.log(chalk.yellow('   • Verify your instance URL is correct'));
          console.log(chalk.yellow('   • Check if the /restapi/ping endpoint exists'));
        } else if (pingResult.status === 0) {
          console.log(chalk.yellow('💡 Suggestions:'));
          console.log(chalk.yellow('   • Check your internet connection'));
          console.log(chalk.yellow('   • Verify the instance URL is reachable'));
        }
        
        console.log();
        console.log(chalk.red('❌ API key NOT saved - authentication must succeed first'));
        process.exit(1);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      commandLogger.error('Login command failed', {
        error: errorMessage,
        alias: options.alias
      });
      
      console.log();
      console.log(chalk.red(`❌ Login failed: ${errorMessage}`));
      console.log(chalk.red('❌ API key NOT saved'));
      process.exit(1);
    }
  });
