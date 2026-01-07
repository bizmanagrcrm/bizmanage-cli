import { Command } from 'commander';
import chalk from 'chalk';
import { AuthService } from '../services/auth.js';
import { BizmanageService } from '../services/bizmanage.js';
import { ApiService } from '../services/api.js';
import { ProjectStructureService } from '../services/project-structure.js';

export const statusDetailCommand = new Command()
  .name('status-detail')
  .description('Show detailed authentication, connection, and project status')
  .option('-a, --alias <alias>', 'Configuration alias to check (default: default)', 'default')
  .option('--project', 'Show project status if in a project directory')
  .option('--api', 'Test API endpoints and show available data')
  .action(async (options: { alias: string; project?: boolean; api?: boolean }) => {
    console.log(chalk.blue('📊 Bizmanage CLI Detailed Status'));
    console.log();

    try {
      const authService = new AuthService();
      
      // Check authentication
      const config = await authService.getConfig(options.alias);
      if (!config) {
        console.log(chalk.red(`❌ No configuration found for alias "${options.alias}"`));
        console.log(chalk.dim('Run "bizmanage login" to authenticate first.'));
        console.log();
        return;
      }

      console.log(chalk.green(`✅ Configuration found: ${options.alias}`));
      console.log(chalk.dim(`   Instance: ${config.instanceUrl}`));
      console.log();

      // Test connection
      console.log(chalk.blue('🔗 Testing connection...'));
      const bizmanageService = new BizmanageService(config);
      const statusReport = await bizmanageService.getStatusReport();
      console.log(statusReport);
      console.log();

      // Check project status if requested
      if (options.project) {
        console.log(chalk.blue('📁 Project Status'));
        const projectService = new ProjectStructureService();
        const currentDir = process.cwd();
        
        const isValidProject = await projectService.isValidProject(currentDir);
        if (isValidProject) {
          const projectConfig = await projectService.readProjectConfig(currentDir);
          console.log(chalk.green('✅ Valid Bizmanage project found'));
          if (projectConfig) {
            console.log(chalk.dim(`   Name: ${projectConfig.project.name}`));
            console.log(chalk.dim(`   Description: ${projectConfig.project.description || 'N/A'}`));
            console.log(chalk.dim(`   Created: ${new Date(projectConfig.project.createdAt).toLocaleDateString()}`));
            if (projectConfig.project.lastPull) {
              console.log(chalk.dim(`   Last Pull: ${new Date(projectConfig.project.lastPull).toLocaleDateString()}`));
            }
            if (projectConfig.project.lastPush) {
              console.log(chalk.dim(`   Last Push: ${new Date(projectConfig.project.lastPush).toLocaleDateString()}`));
            }

            // Show project items count
            try {
              const items = await projectService.readProjectItems(currentDir);
              const counts = {
                objects: items.filter(i => i.type === 'object').length,
                actions: items.filter(i => i.type === 'action').length,
                backendScripts: items.filter(i => i.type === 'backend-script').length,
                reports: items.filter(i => i.type === 'report').length,
                pages: items.filter(i => i.type === 'page').length
              };
              
              console.log(chalk.dim('   Local Items:'));
              console.log(chalk.dim(`     • Objects: ${counts.objects}`));
              console.log(chalk.dim(`     • Actions: ${counts.actions}`));
              console.log(chalk.dim(`     • Backend Scripts: ${counts.backendScripts}`));
              console.log(chalk.dim(`     • Reports: ${counts.reports}`));
              console.log(chalk.dim(`     • Pages: ${counts.pages}`));
            } catch (error) {
              console.log(chalk.yellow('⚠️ Could not read project items'));
            }
          }
        } else {
          console.log(chalk.yellow('⚠️ Not in a Bizmanage project directory'));
          console.log(chalk.dim('   Run "bizmanage init" to create a new project'));
          console.log(chalk.dim('   Or run "bizmanage pull --init" in an empty directory'));
        }
        console.log();
      }

      // Test API endpoints if requested
      if (options.api) {
        console.log(chalk.blue('🔌 API Endpoints Test'));
        const apiService = new ApiService(config, 0);
        
        // Test tables endpoint
        try {
          console.log(chalk.dim('Testing /cust-fields/tables endpoint...'));
          const tables = await apiService.fetchTables();
          const systemTables = tables.filter(t => t.system).length;
          const customTables = tables.filter(t => !t.system).length;
          
          console.log(chalk.green(`✅ Tables: ${tables.length} total`));
          console.log(chalk.dim(`   • System tables: ${systemTables}`));
          console.log(chalk.dim(`   • Custom tables: ${customTables}`));
          
          // Show some examples
          if (tables.length > 0) {
            console.log(chalk.dim('   Examples:'));
            tables.slice(0, 3).forEach(table => {
              const type = table.system ? 'System' : 'Custom';
              console.log(chalk.dim(`     - ${table.display_name} (${table.internal_name}) - ${type}`));
            });
          }
        } catch (error) {
          console.log(chalk.red(`❌ Tables endpoint failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }

        // TODO: Test other endpoints when they become available
        console.log(chalk.yellow('⚠️ Backend Scripts endpoint: Not yet available'));
        console.log(chalk.yellow('⚠️ Reports endpoint: Not yet available'));
        console.log(chalk.yellow('⚠️ Pages endpoint: Not yet available'));
        
        console.log();
      }

    } catch (error) {
      console.log(chalk.red('❌ Status check failed:'));
      console.log(chalk.red(`   ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
