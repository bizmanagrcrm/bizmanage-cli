import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import ora from 'ora';
import { ValidationService } from '../services/validation.js';
import { ProjectStructureService } from '../services/project-structure.js';
import { logger } from '../utils/logger.js';

export const validateCommand = new Command()
  .name('validate')
  .description('Validate project files or a specific file')
  .option('-f, --file <path>', 'Validate a specific file')
  .option('-p, --path <path>', 'Project path (default: current directory)', '.')
  .option('-a, --all', 'Validate all files (default: only changed files)')
  .action(async (options: { file?: string; path: string; all?: boolean }) => {
    const commandLogger = logger.child('ValidateCommand');
    
    console.log(chalk.blue('✓ Bizmanage CLI Validation'));
    console.log();

    try {
      const projectPath = path.resolve(options.path);
      const validationService = new ValidationService();

      if (options.file) {
        // Validate single file
        const filePath = path.resolve(options.file);
        commandLogger.debug('Validating single file', { filePath });
        
        const spinner = ora(`Validating ${path.basename(filePath)}...`).start();
        
        const result = await validationService.validateFile(filePath);
        
        if (result.valid && result.errors.length === 0) {
          spinner.succeed(chalk.green(`✓ Validation passed`));
          
          if (result.warnings.length > 0) {
            console.log();
            console.log(chalk.yellow(`⚠️  ${result.warnings.length} warning(s):`));
            result.warnings.forEach(warning => {
              console.log(chalk.yellow(`  • ${warning.message}`));
            });
          }
        } else {
          spinner.fail(chalk.red(`✗ Validation failed`));
          console.log();
          
          if (result.errors.length > 0) {
            console.log(chalk.red(`❌ ${result.errors.length} error(s):`));
            result.errors.forEach(error => {
              console.log(chalk.red(`  • ${error.message}`));
              if (error.path) {
                console.log(chalk.dim(`    at ${error.path}`));
              }
            });
          }
          
          if (result.warnings.length > 0) {
            console.log();
            console.log(chalk.yellow(`⚠️  ${result.warnings.length} warning(s):`));
            result.warnings.forEach(warning => {
              console.log(chalk.yellow(`  • ${warning.message}`));
            });
          }
          
          process.exit(1);
        }
      } else {
        // Validate entire project
        commandLogger.debug('Validating project', { projectPath });
        
        const projectService = new ProjectStructureService();
        const isValidProject = await projectService.isValidProject(projectPath);
        
        if (!isValidProject) {
          console.log(chalk.red('❌ Not a valid Bizmanage project'));
          console.log(chalk.dim(`   Path: ${projectPath}`));
          console.log();
          console.log(chalk.blue('💡 Use "bizmanage pull --init" to initialize a project'));
          process.exit(1);
        }
        
        const validatingAll = options.all === true;
        const spinnerText = validatingAll ? 'Validating all project files...' : 'Validating changed files...';
        const spinner = ora(spinnerText).start();
        
        const result = validatingAll 
          ? await validationService.validateProject(projectPath)
          : await validationService.validateChangedFiles(projectPath);
        
        const totalIssues = result.errors.length + result.warnings.length;
        
        if (result.valid && result.errors.length === 0) {
          const successMessage = validatingAll 
            ? `✓ All files validated successfully`
            : `✓ Changed files validated successfully`;
          spinner.succeed(chalk.green(successMessage));
          
          if (result.warnings.length > 0) {
            console.log();
            console.log(chalk.yellow(`⚠️  ${result.warnings.length} warning(s) found:`));
            console.log();
            
            // Group warnings by type
            const warningsByType: Record<string, typeof result.warnings> = {};
            result.warnings.forEach(warning => {
              if (!warningsByType[warning.type]) {
                warningsByType[warning.type] = [];
              }
              warningsByType[warning.type].push(warning);
            });
            
            for (const [type, warnings] of Object.entries(warningsByType)) {
              console.log(chalk.bold(`  ${type} (${warnings.length}):`));
              warnings.slice(0, 5).forEach(warning => {
                const fileName = path.basename(warning.file);
                console.log(chalk.yellow(`    • ${fileName}: ${warning.message}`));
              });
              if (warnings.length > 5) {
                console.log(chalk.dim(`    ... and ${warnings.length - 5} more`));
              }
              console.log();
            }
          }
        } else {
          spinner.fail(chalk.red(`✗ Validation failed with ${result.errors.length} error(s)`));
          console.log();
          
          // Group errors by type
          const errorsByType: Record<string, typeof result.errors> = {};
          result.errors.forEach(error => {
            if (!errorsByType[error.type]) {
              errorsByType[error.type] = [];
            }
            errorsByType[error.type].push(error);
          });
          
          console.log(chalk.red(`❌ ${result.errors.length} error(s) found:`));
          console.log();
          
          for (const [type, errors] of Object.entries(errorsByType)) {
            console.log(chalk.bold(`  ${type} (${errors.length}):`));
            errors.slice(0, 10).forEach(error => {
              const fileName = path.basename(error.file);
              console.log(chalk.red(`    • ${fileName}: ${error.message}`));
              if (error.path) {
                console.log(chalk.dim(`      at ${error.path}`));
              }
            });
            if (errors.length > 10) {
              console.log(chalk.dim(`    ... and ${errors.length - 10} more`));
            }
            console.log();
          }
          
          if (result.warnings.length > 0) {
            console.log(chalk.yellow(`⚠️  ${result.warnings.length} warning(s) also found`));
            console.log();
          }
          
          process.exit(1);
        }
      }
      
    } catch (error) {
      console.log();
      console.log(chalk.red(`❌ Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      commandLogger.error('Validation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      process.exit(1);
    }
  });
