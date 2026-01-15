import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { AuthService } from '../services/auth.js';
import { ApiService, BizmanageTableResponse } from '../services/api.js';
import { ProjectStructureService } from '../services/project-structure.js';
import { BizmanageService } from '../services/bizmanage.js';
import { logger } from '../utils/logger.js';
export const pullCommand = new Command()
  .name('pull')
  .description('Pull customizations from Bizmanage platform to local filesystem')
  .option('-a, --alias <alias>', 'Configuration alias to use (default: default)', 'default')
  .option('-o, --output <path>', 'Output directory (default: current directory)', '.')
  .option('--init', 'Initialize a new project structure')
  .option('-d, --delay <ms>', 'Delay in milliseconds between API requests (default: 0 for fast pulls)', '0')
  .action(async (options: { alias: string; output: string; init?: boolean; delay: string }) => {
    const serviceLogger = logger.child('PullCommand');
    serviceLogger.info(chalk.blue('⬇️  Pulling customizations from Bizmanage platform'));
    serviceLogger.info('');

    try {
      const projectPath = path.resolve(options.output);
      const authService = new AuthService(projectPath);
      const config = await authService.getConfig(options.alias);

      if (!config) {
        serviceLogger.error(chalk.red(`❌ No configuration found for alias "${options.alias}"`));
        serviceLogger.info(chalk.dim('Run "bizmanage login" first to authenticate.'));
        process.exit(1);
      }

      serviceLogger.info(chalk.dim(`Using configuration: ${options.alias}`));
      serviceLogger.info(chalk.dim(`Instance: ${config.instanceUrl}`));
      serviceLogger.info(chalk.dim(`Output directory: ${path.resolve(options.output)}`));
      serviceLogger.info('');

      // Test connection first
      const bizmanageService = new BizmanageService(config);
      const connectionTest = await bizmanageService.testConnection();
      
      if (!connectionTest.success) {
        serviceLogger.error(chalk.red(`❌ Connection test failed: ${connectionTest.message}`));
        process.exit(1);
      }

      serviceLogger.info(chalk.green(`✅ Connected successfully (${connectionTest.responseTime}ms)`));
      serviceLogger.info('');

      const delayMs = parseInt(options.delay, 10);
      if (isNaN(delayMs) || delayMs < 0) {
        serviceLogger.error(chalk.red('❌ Invalid delay value. Must be a non-negative number.'));
        process.exit(1);
      }

      if (delayMs > 0) {
        serviceLogger.info(chalk.dim(`Rate limiting enabled: ${delayMs}ms delay between requests`));
        serviceLogger.info('');
      }

      const apiService = new ApiService(config, delayMs);
      const projectService = new ProjectStructureService();
      
      // Check if this is a new project or existing one
      const isExistingProject = await projectService.isValidProject(projectPath);
      
      if (options.init || !isExistingProject) {
        if (isExistingProject && !options.init) {
          serviceLogger.warn(chalk.yellow('⚠️  Existing project found. Use --init flag to reinitialize.'));
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
          serviceLogger.warn(chalk.yellow('⚠️  No tables found. This might indicate:'));
          serviceLogger.info(chalk.dim('   • No custom tables are configured'));
          serviceLogger.info(chalk.dim('   • API permissions might not include table access'));
          serviceLogger.info(chalk.dim('   • The endpoint might not be available on your instance'));
        }
      } catch (error) {
        tablesSpinner.fail(`${chalk.red('✗')} Failed to fetch tables`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Provide helpful error guidance for table fetching
        serviceLogger.info('');
        if (errorMessage.includes('403') || errorMessage.includes('401')) {
          serviceLogger.warn(chalk.yellow('💡 Authentication issue detected. Please check:'));
          serviceLogger.info(chalk.dim('   • API key is valid and not expired'));
          serviceLogger.info(chalk.dim('   • Instance URL is correct'));
          serviceLogger.info(chalk.dim('   • API key has required permissions'));
        } else if (errorMessage.includes('404')) {
          serviceLogger.warn(chalk.yellow('💡 Endpoint not found. This might indicate:'));
          serviceLogger.info(chalk.dim('   • The API endpoint URL has changed'));
          serviceLogger.info(chalk.dim('   • Your instance might not support custom tables'));
        } else if (errorMessage.includes('timeout')) {
          serviceLogger.warn(chalk.yellow('💡 Request timed out. Consider:'));
          serviceLogger.info(chalk.dim('   • Checking your internet connection'));
          serviceLogger.info(chalk.dim('   • Trying again in a moment'));
        }
        
        serviceLogger.info('');
        serviceLogger.error(chalk.red(`❌ Pull failed during table fetching: ${errorMessage}`));
        process.exit(1);
      }

      serviceLogger.info(''); // Add spacing after tables section

      // Step 2: Fetch full table definitions and process them
      const objectsSpinner = ora('Fetching full table definitions...').start();
      try {
        const objects: Array<{
          name: string;
          definition: any;
          actions: Array<{
            name: string;
            code?: string;
            metadata: any;
          }>;
        }> = [];
        
        // Fetch full definition for each table
        for (let i = 0; i < tables.length; i++) {
          const table = tables[i];
          const tableName = table.internal_name || table.display_name;
          objectsSpinner.text = `Fetching definition for ${tableName} (${i + 1}/${tables.length})...`;
          
          try {
            const fullDefinition = await apiService.fetchTableDefinition(tableName);
            objects.push({
              name: tableName,
              definition: fullDefinition,
              actions: [] // Actions will be fetched separately
            });
          } catch (error) {
            objectsSpinner.warn(`${chalk.yellow('⚠️')} Could not fetch definition for ${tableName}`);
          }
        }
        
        objectsSpinner.text = `Processing objects (${objects.length} items)...`;
        
        if (objects.length === 0) {
          objectsSpinner.warn(`${chalk.yellow('⚠️')} Objects: No objects to process`);
        } else {
          const objectResult = await projectService.writeObjectsWithRawDefinitions(projectPath, objects);
          
          if (objectResult.success) {
            results.objects = objectResult.itemCount;
            objectsSpinner.succeed(`${chalk.green('✓')} Objects: ${results.objects} items processed`);
          } else {
            objectsSpinner.fail(`${chalk.red('✗')} Objects: ${objectResult.errors.join(', ')}`);
            serviceLogger.info('');
            serviceLogger.error(chalk.red(`❌ Pull failed during object processing: ${objectResult.errors.join(', ')}`));
            process.exit(1);
          }
        }
      } catch (error) {
        objectsSpinner.fail(`${chalk.red('✗')} Failed to process objects`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        serviceLogger.info('');
        serviceLogger.error(chalk.red(`❌ Pull failed during object processing: ${errorMessage}`));
        process.exit(1);
      }

      // Step 3: Fetch fields for each table
      let totalFields = 0;
      if (tables.length > 0) {
        const fieldsSpinner = ora('Fetching fields for tables...').start();
        try {
          for (let i = 0; i < tables.length; i++) {
            const table = tables[i];
            const tableName = table.internal_name || table.display_name;
            fieldsSpinner.text = `Fetching fields for ${tableName} (${i + 1}/${tables.length})...`;
            
            try {
              const fields = await apiService.fetchFields(tableName);
              
              if (fields.length > 0) {
                const fieldResult = await projectService.writeFields(projectPath, tableName, fields);
                if (fieldResult.success) {
                  totalFields += fieldResult.itemCount;
                } else {
                  fieldsSpinner.warn(`${chalk.yellow('⚠️')} Failed to write fields for ${tableName}`);
                }
              }
            } catch (error) {
              // Don't fail the entire pull if one table's fields can't be fetched
              fieldsSpinner.warn(`${chalk.yellow('⚠️')} Could not fetch fields for ${tableName}`);
            }
          }
          
          fieldsSpinner.succeed(`${chalk.green('✓')} Fields: ${totalFields} fields processed across ${tables.length} tables`);
        } catch (error) {
          fieldsSpinner.fail(`${chalk.red('✗')} Failed to process fields`);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          serviceLogger.info('');
          serviceLogger.error(chalk.red(`❌ Pull failed during fields processing: ${errorMessage}`));
          process.exit(1);
        }
      }

      // Step 4: Fetch actions for each table
      let totalActions = 0;
      if (tables.length > 0) {
        const actionsSpinner = ora('Fetching actions for tables...').start();
        try {
          for (let i = 0; i < tables.length; i++) {
            const table = tables[i];
            const tableName = table.internal_name || table.display_name;
            actionsSpinner.text = `Fetching actions for ${tableName} (${i + 1}/${tables.length})...`;
            
            try {
              const actions = await apiService.fetchActions(tableName);
              
              if (actions.length > 0) {
                const actionResult = await projectService.writeActions(projectPath, tableName, actions);
                if (actionResult.success) {
                  totalActions += actionResult.itemCount;
                } else {
                  actionsSpinner.warn(`${chalk.yellow('⚠️')} Failed to write actions for ${tableName}`);
                }
              }
            } catch (error) {
              // Don't fail the entire pull if one table's actions can't be fetched
              actionsSpinner.warn(`${chalk.yellow('⚠️')} Could not fetch actions for ${tableName}`);
            }
          }
          
          actionsSpinner.succeed(`${chalk.green('✓')} Actions: ${totalActions} actions processed across ${tables.length} tables`);
        } catch (error) {
          actionsSpinner.fail(`${chalk.red('✗')} Failed to process actions`);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          serviceLogger.info('');
          serviceLogger.error(chalk.red(`❌ Pull failed during actions processing: ${errorMessage}`));
          process.exit(1);
        }
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
          serviceLogger.info('');
          serviceLogger.error(chalk.red(`❌ Pull failed during reports processing: ${reportResult.errors.join(', ')}`));
          process.exit(1);
        }
      } catch (error) {
        reportsSpinner.fail(`${chalk.red('✗')} Failed to fetch reports`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        serviceLogger.info('');
        serviceLogger.error(chalk.red(`❌ Pull failed during reports fetching: ${errorMessage}`));
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
          serviceLogger.info('');
          serviceLogger.error(chalk.red(`❌ Pull failed during pages processing: ${pageResult.errors.join(', ')}`));
          process.exit(1);
        }
      } catch (error) {
        pagesSpinner.fail(`${chalk.red('✗')} Failed to fetch pages`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        serviceLogger.info('');
        serviceLogger.error(chalk.red(`❌ Pull failed during pages fetching: ${errorMessage}`));
        process.exit(1);
      }

      // Pull backend scripts
      const backendScriptsSpinner = ora('Fetching backend scripts...').start();
      try {
        const backendScripts = await apiService.fetchScripts();
        backendScriptsSpinner.text = `Processing backend scripts (${backendScripts.length} items)...`;
        
        const scriptResult = await projectService.writeScripts(projectPath, backendScripts);
        
        if (scriptResult.success) {
          results.backendScripts = scriptResult.itemCount;
          backendScriptsSpinner.succeed(`${chalk.green('✓')} Backend Scripts: ${results.backendScripts} items processed`);
        } else {
          backendScriptsSpinner.fail(`${chalk.red('✗')} Backend Scripts: ${scriptResult.errors.join(', ')}`);
          serviceLogger.info('');
          serviceLogger.error(chalk.red(`❌ Pull failed during backend scripts processing: ${scriptResult.errors.join(', ')}`));
          process.exit(1);
        }
      } catch (error) {
        backendScriptsSpinner.fail(`${chalk.red('✗')} Failed to fetch backend scripts`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        serviceLogger.info('');
        serviceLogger.error(chalk.red(`❌ Pull failed during backend scripts fetching: ${errorMessage}`));
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
        serviceLogger.warn(chalk.yellow('⚠️  Failed to update project config timestamp'));
      }

      serviceLogger.info('');
      
      // If we reach this point, everything succeeded
      serviceLogger.info(chalk.green('🎉 Pull completed successfully!'));
      
      const totalItems = results.objects + results.backendScripts + results.reports + results.pages + totalFields + totalActions;
      serviceLogger.info(chalk.dim(`Total items: ${totalItems}`));
      serviceLogger.info(chalk.dim(`  • Tables Found: ${results.tables}`));
      serviceLogger.info(chalk.dim(`  • Objects Processed: ${results.objects}`));
      serviceLogger.info(chalk.dim(`  • Fields Processed: ${totalFields}`));
      serviceLogger.info(chalk.dim(`  • Actions Processed: ${totalActions}`));
      serviceLogger.info(chalk.dim(`  • Backend Scripts: ${results.backendScripts}`));
      serviceLogger.info(chalk.dim(`  • Reports: ${results.reports}`));
      serviceLogger.info(chalk.dim(`  • Pages: ${results.pages}`));
      serviceLogger.info('');
      serviceLogger.info(chalk.dim(`Files written to: ${projectPath}`));

    } catch (error) {
      serviceLogger.info('');
      serviceLogger.error(chalk.red(`❌ Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
