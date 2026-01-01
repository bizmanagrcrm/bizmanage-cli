import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { AuthService } from '../services/auth.js';

export const loginCommand = new Command()
  .name('login')
  .description('Login to Bizmanage platform')
  .option('-a, --alias <alias>', 'Configuration alias (default: default)', 'default')
  .action(async (options) => {
    console.log(chalk.blue('🔐 Bizmanage CLI Login'));
    console.log();

    try {
      // Prompt for credentials
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'instanceUrl',
          message: 'Instance URL:',
          validate: (input) => {
            if (!input.trim()) return 'Instance URL is required';
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API Key:',
          validate: (input) => input.trim() ? true : 'API Key is required'
        }
      ]);

      const spinner = ora('Validating credentials...').start();

      // Simulate API call to validate credentials
      const isValid = await simulateAuthValidation(answers.instanceUrl, answers.apiKey);

      if (isValid) {
        spinner.succeed('Credentials validated successfully!');
        
        // Save credentials using AuthService
        const authService = new AuthService();
        await authService.saveConfig(options.alias, {
          instanceUrl: answers.instanceUrl,
          apiKey: answers.apiKey
        });

        console.log(chalk.green(`✅ Logged in successfully as alias: ${chalk.bold(options.alias)}`));
        console.log(chalk.dim(`Config saved to: ${authService.getConfigPath()}`));
      } else {
        spinner.fail('Invalid credentials');
        console.log(chalk.red('❌ Login failed. Please check your Instance URL and API Key.'));
        process.exit(1);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(chalk.red(`❌ Login failed: ${errorMessage}`));
      process.exit(1);
    }
  });

/**
 * Simulate API call to validate authentication
 * In real implementation, this would make an actual API call using axios
 */
async function simulateAuthValidation(instanceUrl: string, apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      // Mock validation logic - in real implementation:
      // const response = await axios.get(`${instanceUrl}/api/auth/validate`, {
      //   headers: { Authorization: `Bearer ${apiKey}` }
      // });
      // resolve(response.status === 200);
      
      // For demo, accept any non-empty values
      resolve(instanceUrl.length > 0 && apiKey.length > 0);
    }, 1500);
  });
}
