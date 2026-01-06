import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { AuthService } from '../services/auth.js';
import { ApiService } from '../services/api.js';
import { ProjectStructureService } from '../services/project-structure.js';
import { BizmanageService } from '../services/bizmanage.js';

export const pullCommand = new Command()
  .name('pull')
  .description('Pull customizations from Bizmanage platform to local filesystem')
  .option('-a, --alias <alias>', 'Configuration alias to use (default: default)', 'default')
  .option('-o, --output <path>', 'Output directory (default: current directory)', '.')
  .option('--init', 'Initialize a new project structure')
  .action(async (options: { alias: string; output: string; init?: boolean }) => {
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
      console.log(chalk.dim(`Output directory: ${path.resolve(options.output)}`));
      console.log();

      // Test connection first
      const bizmanageService = new BizmanageService(config);
      const connectionTest = await bizmanageService.testConnection();
      
      if (!connectionTest.success) {
        console.log(chalk.red(`❌ Connection test failed: ${connectionTest.message}`));
        process.exit(1);
      }

      console.log(chalk.green(`✅ Connected successfully (${connectionTest.responseTime}ms)`));
      console.log();

      const apiService = new ApiService(config);
      const projectService = new ProjectStructureService();
      
      // Check if this is a new project or existing one
      const projectPath = path.resolve(options.output);
      const isExistingProject = await projectService.isValidProject(projectPath);
      
      if (options.init || !isExistingProject) {
        if (isExistingProject && !options.init) {
          console.log(chalk.yellow('⚠️  Existing project found. Use --init flag to reinitialize.'));
        } else {
          // Initialize new project
          const spinner = ora('Initializing project structure...').start();
          
          try {
            await projectService.initializeProject(projectPath, {
              name: path.basename(projectPath),
              description: `Bizmanage customizations for ${config.instanceUrl}`,
              instanceUrl: config.instanceUrl,
              alias: options.alias
            });
            
            spinner.succeed(chalk.green('✓ Project structure initialized'));
          } catch (error) {
            spinner.fail(chalk.red('✗ Failed to initialize project'));
            throw error;
          }
        }
      }

      // Pull different types of customizations
      const results = {
        objects: 0,
        backendScripts: 0,
        reports: 0,
        pages: 0,
        errors: [] as string[]
      };

      // Pull objects (tables/views with their actions)
      const objectsSpinner = ora('Fetching objects and actions...').start();
      try {
        const objects = await apiService.fetchObjects();
        objectsSpinner.text = `Processing objects (${objects.length} items)...`;
        
        if (objects.length === 0) {
          objectsSpinner.warn(`${chalk.yellow('⚠️')} Objects: No objects found`);
        } else {
          const objectResult = await projectService.writeObjects(projectPath, objects);
          
          if (objectResult.success) {
            results.objects = objectResult.itemCount;
            objectsSpinner.succeed(`${chalk.green('✓')} Objects: ${results.objects} items processed`);
          } else {
            results.errors.push(...objectResult.errors);
            objectsSpinner.fail(`${chalk.red('✗')} Objects: ${objectResult.errors.join(', ')}`);
          }
        }
      } catch (error) {
        objectsSpinner.fail(`${chalk.red('✗')} Failed to fetch objects`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Objects: ${errorMessage}`);
        
        // Provide helpful error guidance
        if (errorMessage.includes('403') || errorMessage.includes('401')) {
          console.log(chalk.yellow('💡 Authentication issue detected. Please check:'));
          console.log(chalk.dim('   • API key is valid and not expired'));
          console.log(chalk.dim('   • Instance URL is correct'));
          console.log(chalk.dim('   • API key has required permissions'));
        } else if (errorMessage.includes('404')) {
          console.log(chalk.yellow('💡 Endpoint not found. This might indicate:'));
          console.log(chalk.dim('   • The API endpoint URL has changed'));
          console.log(chalk.dim('   • Your instance might not support this feature'));
        } else if (errorMessage.includes('timeout')) {
          console.log(chalk.yellow('💡 Request timed out. Consider:'));
          console.log(chalk.dim('   • Checking your internet connection'));
          console.log(chalk.dim('   • Trying again in a moment'));
        }
      }

      // Pull backend scripts
      const backendSpinner = ora('Fetching backend scripts...').start();
      try {
        const scripts = await apiService.fetchBackendScripts();
        backendSpinner.text = `Processing backend scripts (${scripts.length} items)...`;
        
        const scriptResult = await projectService.writeBackendScripts(projectPath, scripts);
        
        if (scriptResult.success) {
          results.backendScripts = scriptResult.itemCount;
          backendSpinner.succeed(`${chalk.green('✓')} Backend Scripts: ${results.backendScripts} items processed`);
        } else {
          results.errors.push(...scriptResult.errors);
          backendSpinner.fail(`${chalk.red('✗')} Backend Scripts: ${scriptResult.errors.join(', ')}`);
        }
      } catch (error) {
        backendSpinner.fail(`${chalk.red('✗')} Failed to fetch backend scripts`);
        results.errors.push(`Backend Scripts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Pull reports
      const reportsSpinner = ora('Fetching reports...').start();
      try {
        const reports = await apiService.fetchReports();
        reportsSpinner.text = `Processing reports (${reports.length} items)...`;
        
        const reportResult = await projectService.writeReports(projectPath, reports);
        
        if (reportResult.success) {
          results.reports = reportResult.itemCount;
          reportsSpinner.succeed(`${chalk.green('✓')} Reports: ${results.reports} items processed`);
        } else {
          results.errors.push(...reportResult.errors);
          reportsSpinner.fail(`${chalk.red('✗')} Reports: ${reportResult.errors.join(', ')}`);
        }
      } catch (error) {
        reportsSpinner.fail(`${chalk.red('✗')} Failed to fetch reports`);
        results.errors.push(`Reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Pull pages
      const pagesSpinner = ora('Fetching pages...').start();
      try {
        const pages = await apiService.fetchPages();
        pagesSpinner.text = `Processing pages (${pages.length} items)...`;
        
        const pageResult = await projectService.writePages(projectPath, pages);
        
        if (pageResult.success) {
          results.pages = pageResult.itemCount;
          pagesSpinner.succeed(`${chalk.green('✓')} Pages: ${results.pages} items processed`);
        } else {
          results.errors.push(...pageResult.errors);
          pagesSpinner.fail(`${chalk.red('✗')} Pages: ${pageResult.errors.join(', ')}`);
        }
      } catch (error) {
        pagesSpinner.fail(`${chalk.red('✗')} Failed to fetch pages`);
        results.errors.push(`Pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Update project config with pull timestamp
      try {
        await projectService.updateProjectConfig(projectPath, {
          project: {
            name: path.basename(projectPath),
            description: `Bizmanage customizations for ${config.instanceUrl}`,
            createdAt: new Date().toISOString(),
            lastPull: new Date().toISOString()
          }
        });
      } catch (error) {
        // Non-fatal error
        console.log(chalk.yellow('⚠️  Failed to update project config timestamp'));
      }

      console.log();
      
      if (results.errors.length > 0) {
        console.log(chalk.red('❌ Pull completed with errors:'));
        results.errors.forEach(error => {
          console.log(chalk.red(`   • ${error}`));
        });
      } else {
        console.log(chalk.green('🎉 Pull completed successfully!'));
      }
      
      const totalItems = results.objects + results.backendScripts + results.reports + results.pages;
      console.log(chalk.dim(`Total items: ${totalItems}`));
      console.log(chalk.dim(`  • Objects: ${results.objects}`));
      console.log(chalk.dim(`  • Backend Scripts: ${results.backendScripts}`));
      console.log(chalk.dim(`  • Reports: ${results.reports}`));
      console.log(chalk.dim(`  • Pages: ${results.pages}`));
      console.log();
      console.log(chalk.dim(`Files written to: ${projectPath}`));

      if (results.errors.length > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.log();
      console.log(chalk.red(`❌ Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
