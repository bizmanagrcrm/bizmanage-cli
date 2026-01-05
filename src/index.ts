import { Command } from 'commander';
import chalk from 'chalk';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { pullCommand } from './commands/pull.js';
import { pushCommand } from './commands/push.js';
import { createTestCommand } from './commands/test.js';
import { statusCommand } from './commands/status.js';
import { Logger, LogLevel, logger } from './utils/logger.js';

const program = new Command();

export function cli() {
  program
    .name('bizmanage')
    .description('CLI tool for building customizations for the Bizmanage SaaS platform')
    .version('1.0.0')
    .option('-v, --verbose', 'enable verbose output (INFO level)')
    .option('-vv, --very-verbose', 'enable very verbose output (DEBUG level)')
    .option('-vvv, --extra-verbose', 'enable extra verbose output (TRACE level)')
    .option('--debug', 'enable debug mode (DEBUG level)')
    .option('--silent', 'suppress all output except errors')
    .option('--log-timestamps', 'include timestamps in log output');

  // Configure logger based on verbosity options
  program.hook('preAction', (thisCommand, actionCommand) => {
    const options = program.opts();
    
    let logLevel = LogLevel.INFO; // default
    let silent = false;
    
    if (options.silent) {
      silent = true;
      logLevel = LogLevel.ERROR;
    } else if (options.extraVerbose) {
      logLevel = LogLevel.TRACE;
    } else if (options.veryVerbose || options.debug) {
      logLevel = LogLevel.DEBUG;
    } else if (options.verbose) {
      logLevel = LogLevel.INFO;
    }
    
    // Configure the global logger
    Logger.getInstance({
      level: logLevel,
      timestamp: options.logTimestamps || false,
      prefix: 'bizmanage',
      silent
    });
    
    // Log the command being executed at debug level
    logger.debug(`Executing command: ${actionCommand.name()}`, {
      args: actionCommand.args,
      options: actionCommand.opts()
    });
  });

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
