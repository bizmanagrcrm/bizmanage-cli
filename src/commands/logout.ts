import { Command } from 'commander';
import chalk from 'chalk';
import { AuthService } from '../services/auth.js';

export const logoutCommand = new Command()
  .name('logout')
  .description('Logout from Bizmanage platform')
  .option('-a, --alias <alias>', 'Configuration alias to remove (default: default)', 'default')
  .option('--all', 'Remove all stored configurations')
  .action(async (options: { alias: string; all?: boolean }) => {
    console.log(chalk.blue('🔓 Bizmanage CLI Logout'));
    console.log();

    try {
      const authService = new AuthService();

      if (options.all) {
        // Remove all configurations
        await authService.clearAllConfigs();
        console.log(chalk.green('✅ All configurations removed successfully'));
      } else {
        // Remove specific alias
        const removed = await authService.removeConfig(options.alias);
        if (removed) {
          console.log(chalk.green(`✅ Configuration for alias "${chalk.bold(options.alias)}" removed successfully`));
        } else {
          console.log(chalk.yellow(`⚠️  No configuration found for alias "${options.alias}"`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`❌ Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
