import { Command } from 'commander';
import chalk from 'chalk';
import { AuthService } from '../services/auth.js';

export const statusCommand = new Command()
  .name('status')
  .description('Show current login status and saved API keys')
  .action(async () => {
    console.log(chalk.blue('📊 Bizmanage CLI Status'));
    console.log();

    try {
      const authService = new AuthService();
      const aliases = authService.listAliases();

      if (aliases.length === 0) {
        console.log(chalk.yellow('⚠️  No API keys are currently saved'));
        console.log();
        console.log(chalk.blue(`💡 Use 'bizmanage login' to save your API key`));
        return;
      }

      console.log(chalk.green(`🔑 Found ${aliases.length} saved configuration(s):`));
      console.log();

      for (const alias of aliases) {
        const config = await authService.getConfig(alias);
        if (config) {
          console.log(chalk.bold(`Alias: ${alias}`));
          console.log(chalk.dim(`   Instance URL: ${config.instanceUrl}`));
          
          // Mask API key for security
          const maskedKey = config.apiKey.length > 8 
            ? `${config.apiKey.substring(0, 4)}***${config.apiKey.substring(config.apiKey.length - 4)}`
            : '****';
          console.log(chalk.dim(`   API Key: ${maskedKey}`));
          console.log();
        }
      }

      console.log(chalk.blue(`💡 Use 'bizmanage test' to check if your API keys are still valid`));
      console.log(chalk.blue(`💡 Use 'bizmanage logout' to delete saved API keys`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
