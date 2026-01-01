import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { AuthService } from '../services/auth.js';
import { ApiService } from '../services/api.js';
import { FileSystemService } from '../services/filesystem.js';

export const pullCommand = new Command()
  .name('pull')
  .description('Pull customizations from Bizmanage platform to local filesystem')
  .option('-a, --alias <alias>', 'Configuration alias to use (default: default)', 'default')
  .option('-o, --output <path>', 'Output directory (default: ./src)', './src')
  .action(async (options: { alias: string; output: string }) => {
    console.log(chalk.blue('⬇️  Pulling customizations from Bizmanage platform'));
    console.log();

    try {
      const authService = new AuthService();
      const config = await authService.getConfig(options.alias);

      if (!config) {
        console.log(chalk.red(`❌ No configuration found for alias "${options.alias}"`));
        console.log(chalk.dim('Run "bizmanage login" first to authenticate.'));
        process.exit(1);
      }

      console.log(chalk.dim(`Using configuration: ${options.alias}`));
      console.log(chalk.dim(`Instance: ${config.instanceUrl}`));
      console.log(chalk.dim(`Output directory: ${options.output}`));
      console.log();

      const apiService = new ApiService(config);
      const fsService = new FileSystemService();

      // Pull different scopes
      const scopes = ['reports', 'pages', 'backend-scripts', 'fields'];
      
      for (const scope of scopes) {
        const spinner = ora(`Fetching ${scope}...`).start();
        
        try {
          // Mock API call to fetch customizations for this scope
          const customizations = await apiService.fetchCustomizations(scope);
          
          spinner.text = `Processing ${scope} (${customizations.length} items)...`;
          
          // Process and write files to local filesystem
          await fsService.writeCustomizations(options.output, scope, customizations);
          
          spinner.succeed(`${chalk.green('✓')} ${scope}: ${customizations.length} items processed`);
        } catch (error) {
          spinner.fail(`${chalk.red('✗')} Failed to fetch ${scope}`);
          throw error;
        }
      }

      console.log();
      console.log(chalk.green('🎉 Pull completed successfully!'));
      console.log(chalk.dim(`Files written to: ${options.output}`));

    } catch (error) {
      console.log();
      console.log(chalk.red(`❌ Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
