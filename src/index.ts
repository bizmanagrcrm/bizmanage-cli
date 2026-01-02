import { Command } from 'commander';
import chalk from 'chalk';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { pullCommand } from './commands/pull.js';
import { pushCommand } from './commands/push.js';
import { createTestCommand } from './commands/test.js';
import { statusCommand } from './commands/status.js';

const program = new Command();

export function cli() {
  program
    .name('bizmanage')
    .description('CLI tool for building customizations for the Bizmanage SaaS platform')
    .version('1.0.0');

  // Add commands
  program.addCommand(loginCommand);
  program.addCommand(logoutCommand);
  program.addCommand(statusCommand);
  program.addCommand(createTestCommand());
  program.addCommand(pullCommand);
  program.addCommand(pushCommand);

  // Handle unknown commands
  program.on('command:*', () => {
    console.error(chalk.red(`Unknown command: ${program.args.join(' ')}`));
    console.log('See --help for available commands.');
    process.exit(1);
  });

  // Parse command line arguments
  program.parse();
}

// If this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli();
}
