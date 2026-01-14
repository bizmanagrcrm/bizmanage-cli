import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import path from 'path';
import { AuthService } from '../services/auth.js';
import { ValidationService } from '../services/validation.js';
import { PushService } from '../services/push.js';
import { logger } from '../utils/logger.js';

export const pushCommand = new Command()
  .name('push')
  .description('Push local customizations to Bizmanage platform with validation and testing')
  .option('-a, --alias <alias>', 'Configuration alias to use (default: default)', 'default')
  .option('-s, --source <path>', 'Source directory (default: current directory)', '.')
  .option('--all', 'Push all files (default: only changed files)')
  .option('--skip-tests', 'Skip running tests before deploy')
  .option('--skip-validation', 'Skip metadata validation')
  .action(async (options: { 
    alias: string; 
    source: string; 
    all?: boolean;
    skipTests?: boolean; 
    skipValidation?: boolean; 
  }) => {
    const commandLogger = logger.child('PushCommand');
    console.log(chalk.blue('⬆️  Pushing customizations to Bizmanage platform'));
    console.log();

    try {
      const authService = new AuthService();
      const config = await authService.getConfig(options.alias);

      if (!config) {
        console.log(chalk.red(`❌ No configuration found for alias "${options.alias}"`));
        console.log(chalk.dim('Run "bizmanage login" first to authenticate.'));
        process.exit(1);
      }

      const projectPath = path.resolve(options.source);
      const pushingAll = options.all === true;

      console.log(chalk.dim(`Using configuration: ${options.alias}`));
      console.log(chalk.dim(`Instance: ${config.instanceUrl}`));
      console.log(chalk.dim(`Project path: ${projectPath}`));
      console.log(chalk.dim(`Mode: ${pushingAll ? 'Push all files' : 'Push changed files only'}`));
      console.log();

      // Step 1: Validation
      if (!options.skipValidation) {
        const validationMode = pushingAll ? 'all project files' : 'changed files';
        console.log(chalk.yellow(`📋 Step 1: Validating ${validationMode}...`));
        const validationService = new ValidationService();
        const validationResult = pushingAll
          ? await validationService.validateProject(projectPath)
          : await validationService.validateChangedFiles(projectPath);
        
        if (!validationResult.valid) {
          console.log(chalk.red('❌ Validation failed:'));
          validationResult.errors.forEach((error: any) => {
            console.log(chalk.red(`  • ${path.basename(error.file)}: ${error.message}`));
          });
          process.exit(1);
        }
        console.log(chalk.green(`✅ Validation passed`));
        console.log();
      }

      // Step 2: Testing
      if (!options.skipTests) {
        console.log(chalk.yellow('🧪 Step 2: Running tests...'));
        const testsPassed = await runTests();
        
        if (!testsPassed) {
          console.log(chalk.red('❌ Tests failed. Aborting deployment.'));
          console.log(chalk.dim('Fix the failing tests or use --skip-tests to bypass this check.'));
          process.exit(1);
        }
        console.log(chalk.green('✅ All tests passed'));
        console.log();
      }

      // Step 3: Deploy
      console.log(chalk.yellow('🚀 Step 3: Deploying to platform...'));
      
      const pushService = new PushService(config);

      // Push customizations
      const pushSpinner = ora(pushingAll ? 'Pushing all files...' : 'Pushing changed files...').start();
      
      try {
        const pushResult = pushingAll
          ? await pushService.pushAllFiles(projectPath)
          : await pushService.pushChangedFiles(projectPath);
        
        if (pushResult.pushedFiles.length === 0) {
          pushSpinner.info(chalk.blue('No files to push - everything is up to date'));
        } else if (pushResult.success) {
          pushSpinner.succeed(chalk.green(`Successfully pushed ${pushResult.pushedFiles.length} file(s)`));
          
          // Show list of pushed files
          if (pushResult.pushedFiles.length > 0) {
            console.log(chalk.dim('\nPushed files:'));
            pushResult.pushedFiles.forEach(file => {
              console.log(chalk.dim(`  • ${file}`));
            });
          }
        } else {
          pushSpinner.fail(chalk.red('Push completed with errors'));
          
          // Show errors
          if (pushResult.errors.length > 0) {
            console.log();
            console.log(chalk.red(`❌ ${pushResult.errors.length} error(s):`));
            pushResult.errors.forEach(error => {
              console.log(chalk.red(`  • ${error.file}: ${error.message}`));
            });
          }
          
          // Show successfully pushed files
          if (pushResult.pushedFiles.length > 0) {
            console.log();
            console.log(chalk.yellow(`⚠️  ${pushResult.pushedFiles.length} file(s) pushed successfully before errors:`));
            pushResult.pushedFiles.forEach(file => {
              console.log(chalk.dim(`  • ${file}`));
            });
          }
          
          process.exit(1);
        }
        
        console.log();
        console.log(chalk.green('🎉 Push completed successfully!'));
        console.log(chalk.dim(`Deployed to ${config.instanceUrl}`));
        
      } catch (error) {
        pushSpinner.fail('Push failed');
        throw error;
      }

    } catch (error) {
      console.log();
      console.log(chalk.red(`❌ Push failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * Run npm test in the current directory
 * Returns true if tests pass, false otherwise
 */
async function runTests(): Promise<boolean> {
  return new Promise((resolve) => {
    const spinner = ora('Running npm test...').start();
    
    // Use shell: true to handle npm on Windows (npm.cmd) and Unix (npm)
    const testProcess = spawn('npm', ['test'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    let errorOutput = '';

    testProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });

    testProcess.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        spinner.succeed('Tests passed');
        resolve(true);
      } else {
        spinner.fail('Tests failed');
        
        // Show test output if tests failed
        if (errorOutput) {
          console.log(chalk.red('\nTest Error Output:'));
          console.log(chalk.dim(errorOutput.slice(0, 1000))); // Limit output
        }
        if (output) {
          console.log(chalk.red('\nTest Output:'));
          console.log(chalk.dim(output.slice(0, 1000))); // Limit output
        }
        
        resolve(false);
      }
    });

    testProcess.on('error', (error) => {
      spinner.fail('Failed to run tests');
      console.log(chalk.red(`Error running tests: ${error.message}`));
      resolve(false);
    });
  });
}
