import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { ProjectStructureService } from '../services/project-structure.js';
import { normalizeLocalName } from '../utils/local-name.js';

interface CreateViewCommandOptions {
  path: string;
  displayName?: string;
  force?: boolean;
}

export const createViewCommand = new Command()
  .name('create-view')
  .description('Create boilerplate files for a new view in the current Bizmanage project')
  .argument('<name>', 'Internal view name')
  .option('-p, --path <path>', 'Project path (default: current directory)', '.')
  .option('--display-name <name>', 'Display name shown in Bizmanage')
  .option('--force', 'Overwrite an existing view boilerplate')
  .action(async (name: string, options: CreateViewCommandOptions) => {
    const projectPath = path.resolve(options.path);
    const projectService = new ProjectStructureService();

    if (!await projectService.isValidProject(projectPath)) {
      console.log(chalk.red(`❌ "${projectPath}" is not a Bizmanage project.`));
      console.log(chalk.dim('Run "bizmanage init" first or pass --path to an existing project.'));
      process.exit(1);
    }

    const internalName = normalizeLocalName(name);
    const displayName = options.displayName?.trim() || toDisplayName(name);

    const result = await projectService.createViewBoilerplate(projectPath, internalName, displayName, {
      force: options.force
    });

    if (!result.created) {
      console.log(chalk.yellow(`⚠️  View "${internalName}" already exists.`));
      console.log(chalk.dim(`Use --force to overwrite ${result.definitionPath}`));
      process.exit(1);
    }

    console.log(chalk.green(`✓ Created view boilerplate for "${internalName}"`));
    console.log(chalk.dim(`Folder: ${result.objectDir}`));
  });

function toDisplayName(name: string): string {
  const words = name
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'New View';
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
