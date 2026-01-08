import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import path from 'path';
import { AuthService } from '../services/auth.js';
import { ApiService } from '../services/api.js';
import { FileSystemService } from '../services/filesystem.js';
import { ValidationService } from '../services/validation.js';

export const pushCommand = new Command()
  .name('push')
  .description('Push local customizations to Bizmanage platform with validation and testing')
  .option('-a, --alias <alias>', 'Configuration alias to use (default: default)', 'default')
  .option('-s, --source <path>', 'Source directory (default: ./src)', './src')
  .option('--skip-tests', 'Skip running tests before deploy')
  .option('--skip-validation', 'Skip metadata validation')
  .action(async (options: { 
    alias: string; 
    source: string; 
    skipTests?: boolean; 
    skipValidation?: boolean; 
  }) => {
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

      console.log(chalk.dim(`Using configuration: ${options.alias}`));
      console.log(chalk.dim(`Instance: ${config.instanceUrl}`));
      console.log(chalk.dim(`Source directory: ${options.source}`));
      console.log();

      // Step 1: Validation
      if (!options.skipValidation) {
        console.log(chalk.yellow('📋 Step 1: Validating project files...'));
        const validationService = new ValidationService();
        const validationResult = await validationService.validateProject(options.source);
        
        if (!validationResult.valid) {
          console.log(chalk.red('❌ Validation failed:'));
          validationResult.errors.forEach((error: any) => {
            console.log(chalk.red(`  • ${error.file}: ${error.message}`));
          });
          process.exit(1);
        }
        console.log(chalk.green('✅ All project files are valid'));
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
      
      const fsService = new FileSystemService();
      const apiService = new ApiService(config, 0);

      // Read local files and prepare payload
      const spinner = ora('Reading local files...').start();
      const customizations = await fsService.readCustomizations(options.source);
      spinner.succeed(`Read ${customizations.length} customizations`);

      // Deploy to platform
      const deploySpinner = ora('Uploading to platform...').start();
      
      try {
        // Mock API call to deploy customizations
        await apiService.deployCustomizations(customizations);
        deploySpinner.succeed('Deployment completed successfully');
        
        console.log();
        console.log(chalk.green('🎉 Push completed successfully!'));
        console.log(chalk.dim(`Deployed ${customizations.length} customizations to ${config.instanceUrl}`));
        
      } catch (error) {
        deploySpinner.fail('Deployment failed');
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
    
    const testProcess = spawn('npm', ['test'], {
      cwd: process.cwd(),
      stdio: 'pipe'
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
