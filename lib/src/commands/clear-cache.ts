import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import ora from 'ora';
import { HashCacheService } from '../services/hash-cache.js';
import { logger } from '../utils/logger.js';

export const clearCacheCommand = new Command()
  .name('clear-cache')
  .aliases(['rm-cache', 'cache-clear'])
  .description('Clear the hash cache, making all files behave as if they are new')
  .option('-p, --path <path>', 'Project path (default: current directory)', '.')
  .action(async (options: { path: string }) => {
    const projectPath = path.resolve(options.path);
    const spinner = ora('Clearing hash cache...').start();

    try {
      logger.info('Clearing hash cache', { projectPath });

      const hashCacheService = new HashCacheService();
      await hashCacheService.initialize(projectPath);
      
      const statsBefore = hashCacheService.getStats();
      await hashCacheService.clear();

      spinner.succeed(chalk.green('✓ Hash cache cleared successfully'));
      
      console.log();
      console.log(chalk.blue('📊 Cache Statistics:'));
      console.log(chalk.dim(`  Files cleared: ${statsBefore.totalFiles}`));
      console.log();
      console.log(chalk.yellow('💡 All files will now be treated as new on the next pull/push operation'));
      
      logger.info('Hash cache cleared successfully', { filesCleared: statsBefore.totalFiles });
    } catch (error) {
      spinner.fail(chalk.red('Failed to clear hash cache'));
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      logger.error('Failed to clear hash cache', { error: error instanceof Error ? error.message : 'Unknown error' });
      process.exit(1);
    }
  });
