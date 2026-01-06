import { Command } from 'commander';
import chalk from 'chalk';
import { AuthService } from '../services/auth.js';

export const logoutCommand = new Command()
  .name('logout')
  .description('Logout from Bizmanage platform by deleting saved API key')
  .option('-a, --alias <alias>', 'Configuration alias to remove (default: default)', 'default')
  .option('--all', 'Remove all stored API keys and configurations')
  .action(async (options: { alias: string; all?: boolean }) => {
    console.log(chalk.blue('🔓 Bizmanage CLI Logout'));
    console.log(chalk.dim('This will delete your saved API key and configuration'));
    console.log();

    try {
      const authService = new AuthService();

      if (options.all) {
        // Check if any configurations exist
        const aliases = authService.listAliases();
        if (aliases.length === 0) {
          console.log(chalk.yellow('⚠️  No saved configurations found'));
          return;
        }

        console.log(chalk.yellow(`Found ${aliases.length} saved configuration(s):`));
        aliases.forEach(alias => console.log(chalk.dim(`   • ${alias}`)));
        console.log();

        // Remove all configurations
        await authService.clearAllConfigs();
        console.log(chalk.green('🗑️  All API keys and configurations deleted successfully'));
        console.log(chalk.dim(`   Removed ${aliases.length} configuration(s)`));
      } else {
        // Check if the specific alias exists
        if (!authService.hasAlias(options.alias)) {
          console.log(chalk.yellow(`⚠️  No saved configuration found for alias "${options.alias}"`));
          console.log();
          
          const aliases = authService.listAliases();
          if (aliases.length > 0) {
            console.log(chalk.blue('Available aliases:'));
            aliases.forEach(alias => console.log(chalk.dim(`   • ${alias}`)));
          } else {
            console.log(chalk.dim('No configurations are currently saved'));
          }
          return;
        }

        // Remove specific alias
        const removed = await authService.removeConfig(options.alias);
        if (removed) {
          console.log(chalk.green(`🗑️  API key and configuration deleted successfully`));
          console.log(chalk.green(`   Alias: ${chalk.bold(options.alias)}`));
          
          // Show remaining aliases if any
          const remainingAliases = authService.listAliases();
          if (remainingAliases.length > 0) {
            console.log();
            console.log(chalk.blue(`Remaining aliases:`));
            remainingAliases.forEach(alias => console.log(chalk.dim(`   • ${alias}`)));
          }
        } else {
          console.log(chalk.red(`❌ Failed to remove configuration for alias "${options.alias}"`));
        }
      }

      console.log();
      console.log(chalk.blue(`💡 Use 'bizmanage login' to save a new API key`));
    } catch (error) {
      console.log();
      console.log(chalk.red(`❌ Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
