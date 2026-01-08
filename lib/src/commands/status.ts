import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { AuthService } from '../services/auth.js';
import { HashCacheService } from '../services/hash-cache.js';
import { ProjectStructureService } from '../services/project-structure.js';

export const statusCommand = new Command()
  .name('status')
  .description('Show project status including authentication and file changes')
  .option('-p, --path <path>', 'Project path (default: current directory)', '.')
  .option('--auth-only', 'Show only authentication status')
  .option('--changes-only', 'Show only file changes')
  .action(async (options: { path: string; authOnly?: boolean; changesOnly?: boolean }) => {
    const projectPath = path.resolve(options.path);
    
    console.log(chalk.blue('📊 Bizmanage CLI Status'));
    console.log();

    try {
      // Show authentication status
      if (!options.changesOnly) {
        const authService = new AuthService(projectPath);
        const aliases = authService.listAliases();

        if (aliases.length === 0) {
          console.log(chalk.yellow('⚠️  No API keys are currently saved'));
          console.log();
          console.log(chalk.blue(`💡 Use 'bizmanage login' to save your API key`));
        } else {
          console.log(chalk.green(`🔑 Authentication (${aliases.length} configuration${aliases.length > 1 ? 's' : ''}):`));
          console.log();

          for (const alias of aliases) {
            const config = await authService.getConfig(alias);
            if (config) {
              console.log(chalk.bold(`  Alias: ${alias}`));
              console.log(chalk.dim(`    Instance: ${config.instanceUrl}`));
              
              // Mask API key for security
              const maskedKey = config.apiKey.length > 8 
                ? `${config.apiKey.substring(0, 4)}***${config.apiKey.substring(config.apiKey.length - 4)}`
                : '****';
              console.log(chalk.dim(`    API Key: ${maskedKey}`));
            }
          }
          console.log();
        }
      }

      // Show file changes status
      if (!options.authOnly) {
        const projectService = new ProjectStructureService();
        const isValidProject = await projectService.isValidProject(projectPath);

        if (!isValidProject) {
          console.log(chalk.yellow('⚠️  Not a valid Bizmanage project'));
          console.log(chalk.dim(`    Path: ${projectPath}`));
          console.log();
          console.log(chalk.blue(`💡 Use 'bizmanage pull --init' to initialize a project`));
          return;
        }

        console.log(chalk.green('📁 Project Status:'));
        console.log(chalk.dim(`    Path: ${projectPath}`));
        
        // Show last pull timestamp
        const projectConfig = await projectService.readProjectConfig(projectPath);
        if (projectConfig?.project?.lastPull) {
          const lastPullDate = new Date(projectConfig.project.lastPull);
          const now = new Date();
          const diffMs = now.getTime() - lastPullDate.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);
          
          let timeAgo = '';
          if (diffDays > 0) {
            timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
          } else if (diffHours > 0) {
            timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
          } else if (diffMins > 0) {
            timeAgo = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
          } else {
            timeAgo = 'just now';
          }
          
          console.log(chalk.dim(`    Last Pull: ${lastPullDate.toLocaleString()} (${timeAgo})`));
        }
        console.log();

        const hashCache = new HashCacheService();
        await hashCache.initialize(projectPath);
        
        const changes = await hashCache.getChanges(projectPath);
        const hasChanges = changes.total.changed > 0 || changes.total.new > 0 || changes.total.deleted > 0;

        if (!hasChanges) {
          console.log(chalk.green('✅ No changes detected'));
          console.log(chalk.dim('    All files match the last pull'));
        } else {
          console.log(chalk.yellow(`📝 Changes detected: ${changes.total.changed + changes.total.new + changes.total.deleted} file(s)`));
          console.log();

          // Show changes by type
          const types = ['objects', 'backend', 'reports', 'pages'];
          
          for (const type of types) {
            const typeChanged = changes.changed[type] || [];
            const typeNew = changes.new[type] || [];
            const typeDeleted = changes.deleted[type] || [];
            const typeTotal = typeChanged.length + typeNew.length + typeDeleted.length;

            if (typeTotal > 0) {
              const icon = type === 'objects' ? '📦' : type === 'backend' ? '⚙️' : type === 'reports' ? '📊' : '📄';
              console.log(chalk.bold(`  ${icon} ${type.charAt(0).toUpperCase() + type.slice(1)} (${typeTotal}):`));

              if (typeChanged.length > 0) {
                console.log(chalk.yellow(`    Modified: ${typeChanged.length}`));
                typeChanged.slice(0, 5).forEach(file => {
                  console.log(chalk.dim(`      ${file}`));
                });
                if (typeChanged.length > 5) {
                  console.log(chalk.dim(`      ... and ${typeChanged.length - 5} more`));
                }
              }

              if (typeNew.length > 0) {
                console.log(chalk.green(`    New: ${typeNew.length}`));
                typeNew.slice(0, 5).forEach(file => {
                  console.log(chalk.dim(`      ${file}`));
                });
                if (typeNew.length > 5) {
                  console.log(chalk.dim(`      ... and ${typeNew.length - 5} more`));
                }
              }

              if (typeDeleted.length > 0) {
                console.log(chalk.red(`    Deleted: ${typeDeleted.length}`));
                typeDeleted.slice(0, 5).forEach(file => {
                  console.log(chalk.dim(`      ${file}`));
                });
                if (typeDeleted.length > 5) {
                  console.log(chalk.dim(`      ... and ${typeDeleted.length - 5} more`));
                }
              }

              console.log();
            }
          }

          console.log(chalk.yellow('⚠️  Run "bizmanage pull" to sync with remote'));
        }
      }

      console.log();
      console.log(chalk.blue(`💡 Use 'bizmanage test' to check API connection`));
      console.log(chalk.blue(`💡 Use 'bizmanage pull' to sync customizations`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
