import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { AuthService } from '../services/auth.js';
import { ApiService, BizmanageTableResponse } from '../services/api.js';
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
        tables: 0,
        objects: 0,
        backendScripts: 0,
        reports: 0,
        pages: 0
      };

      // Step 1: First fetch tables from Bizmanage API
      const tablesSpinner = ora('Fetching tables from Bizmanage API...').start();
      let tables: BizmanageTableResponse[] = [];
      
      try {
        tables = await apiService.fetchTables();
        results.tables = tables.length;
        tablesSpinner.succeed(`${chalk.green('✓')} Tables: Found ${results.tables} tables`);
        
        if (tables.length === 0) {
          console.log(chalk.yellow('⚠️  No tables found. This might indicate:'));
          console.log(chalk.dim('   • No custom tables are configured'));
          console.log(chalk.dim('   • API permissions might not include table access'));
          console.log(chalk.dim('   • The endpoint might not be available on your instance'));
        } else {
          console.log(chalk.dim(`   Found tables: ${tables.map(t => t.internal_name || t.display_name).join(', ')}`));
        }
      } catch (error) {
        tablesSpinner.fail(`${chalk.red('✗')} Failed to fetch tables`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Provide helpful error guidance for table fetching
        console.log();
        if (errorMessage.includes('403') || errorMessage.includes('401')) {
          console.log(chalk.yellow('💡 Authentication issue detected. Please check:'));
          console.log(chalk.dim('   • API key is valid and not expired'));
          console.log(chalk.dim('   • Instance URL is correct'));
          console.log(chalk.dim('   • API key has required permissions'));
        } else if (errorMessage.includes('404')) {
          console.log(chalk.yellow('💡 Endpoint not found. This might indicate:'));
          console.log(chalk.dim('   • The API endpoint URL has changed'));
          console.log(chalk.dim('   • Your instance might not support custom tables'));
        } else if (errorMessage.includes('timeout')) {
          console.log(chalk.yellow('💡 Request timed out. Consider:'));
          console.log(chalk.dim('   • Checking your internet connection'));
          console.log(chalk.dim('   • Trying again in a moment'));
        }
        
        console.log();
        console.log(chalk.red(`❌ Pull failed during table fetching: ${errorMessage}`));
        process.exit(1);
      }

      console.log(); // Add spacing after tables section

      // Step 2: Convert tables to objects and process them
      const objectsSpinner = ora('Converting tables to objects and processing actions...').start();
      try {
        const objects = tables.map(table => apiService.convertTableToObject(table));
        objectsSpinner.text = `Processing objects (${objects.length} items)...`;
        
        if (objects.length === 0) {
          objectsSpinner.warn(`${chalk.yellow('⚠️')} Objects: No objects to process`);
        } else {
          const objectResult = await projectService.writeObjects(projectPath, objects);
          
          if (objectResult.success) {
            results.objects = objectResult.itemCount;
            objectsSpinner.succeed(`${chalk.green('✓')} Objects: ${results.objects} items processed`);
          } else {
            objectsSpinner.fail(`${chalk.red('✗')} Objects: ${objectResult.errors.join(', ')}`);
            console.log();
            console.log(chalk.red(`❌ Pull failed during object processing: ${objectResult.errors.join(', ')}`));
            process.exit(1);
          }
        }
      } catch (error) {
        objectsSpinner.fail(`${chalk.red('✗')} Failed to process objects`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log();
        console.log(chalk.red(`❌ Pull failed during object processing: ${errorMessage}`));
        process.exit(1);
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
          backendSpinner.fail(`${chalk.red('✗')} Backend Scripts: ${scriptResult.errors.join(', ')}`);
          console.log();
          console.log(chalk.red(`❌ Pull failed during backend scripts processing: ${scriptResult.errors.join(', ')}`));
          process.exit(1);
        }
      } catch (error) {
        backendSpinner.fail(`${chalk.red('✗')} Failed to fetch backend scripts`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log();
        console.log(chalk.red(`❌ Pull failed during backend scripts fetching: ${errorMessage}`));
        process.exit(1);
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
          reportsSpinner.fail(`${chalk.red('✗')} Reports: ${reportResult.errors.join(', ')}`);
          console.log();
          console.log(chalk.red(`❌ Pull failed during reports processing: ${reportResult.errors.join(', ')}`));
          process.exit(1);
        }
      } catch (error) {
        reportsSpinner.fail(`${chalk.red('✗')} Failed to fetch reports`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log();
        console.log(chalk.red(`❌ Pull failed during reports fetching: ${errorMessage}`));
        process.exit(1);
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
          pagesSpinner.fail(`${chalk.red('✗')} Pages: ${pageResult.errors.join(', ')}`);
          console.log();
          console.log(chalk.red(`❌ Pull failed during pages processing: ${pageResult.errors.join(', ')}`));
          process.exit(1);
        }
      } catch (error) {
        pagesSpinner.fail(`${chalk.red('✗')} Failed to fetch pages`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log();
        console.log(chalk.red(`❌ Pull failed during pages fetching: ${errorMessage}`));
        process.exit(1);
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
      
      // If we reach this point, everything succeeded
      console.log(chalk.green('🎉 Pull completed successfully!'));
      
      const totalItems = results.objects + results.backendScripts + results.reports + results.pages;
      console.log(chalk.dim(`Total items: ${totalItems}`));
      console.log(chalk.dim(`  • Tables Found: ${results.tables}`));
      console.log(chalk.dim(`  • Objects Processed: ${results.objects}`));
      console.log(chalk.dim(`  • Backend Scripts: ${results.backendScripts}`));
      console.log(chalk.dim(`  • Reports: ${results.reports}`));
      console.log(chalk.dim(`  • Pages: ${results.pages}`));
      console.log();
      console.log(chalk.dim(`Files written to: ${projectPath}`));

    } catch (error) {
      console.log();
      console.log(chalk.red(`❌ Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
