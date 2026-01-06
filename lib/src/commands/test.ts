import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { AuthService } from '../services/auth.js';
import { BizmanageService } from '../services/bizmanage.js';
import { logger } from '../utils/logger.js';

export function createTestCommand(): Command {
  const command = new Command()
    .name('test')
    .description('Test authentication and connection to Bizmanage API')
    .option('-a, --alias <alias>', 'Test specific alias configuration', 'default')
    .option('--ping-only', 'Only run the ping test without detailed report')
    .action(async (options) => {
      const commandLogger = logger.child('test');
      const authService = new AuthService();
      const { alias, pingOnly } = options;

      commandLogger.debug('Starting test command', { alias, pingOnly });

      // Check if alias exists
      if (!authService.hasAlias(alias)) {
        commandLogger.error('Alias not found', { alias });
        console.log(chalk.red(`❌ Alias '${alias}' not found. Use 'bizmanage login' to set up authentication.`));
        process.exit(1);
      }

      const config = await authService.getConfig(alias);
      if (!config) {
        commandLogger.error('Invalid configuration for alias', { alias });
        console.log(chalk.red(`❌ Configuration for alias '${alias}' is invalid.`));
        process.exit(1);
      }

      console.log(chalk.blue(`🔍 Testing connection to Bizmanage API using alias: ${chalk.bold(alias)}`));
      
      commandLogger.debug('Configuration loaded', { 
        instanceUrl: config.instanceUrl, 
        hasApiKey: !!config.apiKey 
      });

      const bizmanageService = new BizmanageService(config);

      // Quick ping test
      if (pingOnly) {
        const spinner = ora('Pinging Bizmanage API...').start();
        
        try {
          const pingResult = await bizmanageService.ping();
          
          if (pingResult.authenticated) {
            spinner.succeed(chalk.green(`✅ Authentication successful (${pingResult.status})`));
            console.log(chalk.green(`Message: ${pingResult.message}`));
            commandLogger.success('Ping test passed', { status: pingResult.status });
          } else {
            spinner.fail(chalk.red(`❌ Authentication failed (${pingResult.status})`));
            console.log(chalk.red(`Message: ${pingResult.message}`));
            process.exit(1);
          }
        } catch (error) {
          spinner.fail(chalk.red('❌ Ping test failed'));
          console.log(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          process.exit(1);
        }
        
        return;
      }

      // Full status report
      const spinner = ora('Running connection tests...').start();
      
      try {
        const statusReport = await bizmanageService.getStatusReport();
        spinner.stop();
        
        console.log('\n' + statusReport);
        
        // Quick ping to determine exit code
        const pingResult = await bizmanageService.ping();
        if (!pingResult.authenticated) {
          process.exit(1);
        }
        
      } catch (error) {
        spinner.fail(chalk.red('❌ Test failed'));
        console.log(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return command;
}
