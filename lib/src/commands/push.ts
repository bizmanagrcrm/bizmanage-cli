import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import path from 'path';
import { AuthService } from '../services/auth.js';
import { ValidationResult, ValidationService } from '../services/validation.js';
import { CustomizationFile, PushService } from '../services/push.js';
import { logger } from '../utils/logger.js';
import { normalizeLocalName } from '../utils/local-name.js';

const ALL_PUSH_TARGETS = ['objects', 'fields', 'actions', 'reports', 'pages', 'scripts', 'data'] as const;
type PushTarget = typeof ALL_PUSH_TARGETS[number];

const OBJECT_SCOPED_PUSH_TARGETS = new Set<PushTarget>(['objects', 'fields', 'actions', 'data']);

const PUSH_TARGET_ALIASES: Record<string, PushTarget> = {
  object: 'objects',
  objects: 'objects',
  table: 'objects',
  tables: 'objects',
  view: 'objects',
  views: 'objects',
  field: 'fields',
  fields: 'fields',
  action: 'actions',
  actions: 'actions',
  data: 'data',
  datas: 'data',
  report: 'reports',
  reports: 'reports',
  page: 'pages',
  pages: 'pages',
  script: 'scripts',
  scripts: 'scripts',
  backend: 'scripts',
  'backend-script': 'scripts',
  'backend-scripts': 'scripts'
};

interface PushCommandOptions {
  alias: string;
  source: string;
  all?: boolean;
  skipTests?: boolean;
  skipValidation?: boolean;
  include: string[];
  object: string[];
  view: string[];
  field: string[];
  action: string[];
  report: string[];
  page: string[];
  script: string[];
}

interface PushSelection {
  targets: Set<PushTarget>;
  objectSelectors: string[];
  fieldSelectors: string[];
  actionSelectors: string[];
  reportSelectors: string[];
  pageSelectors: string[];
  scriptSelectors: string[];
  isSelective: boolean;
  summary: string;
}

export const pushCommand = new Command()
  .name('push')
  .description('Push local customizations to Bizmanage platform with validation and testing')
  .option('-a, --alias <alias>', 'Configuration alias to use (default: default)', 'default')
  .option('-s, --source <path>', 'Source directory (default: current directory)', '.')
  .option('--all', 'Push all files (default: only changed files)')
  .option('--skip-tests', 'Skip running tests before deploy')
  .option('--skip-validation', 'Skip metadata validation')
  .option('--include <target>', 'Push only selected targets: objects, fields, actions, reports, pages, scripts, data (repeatable or comma-separated)', collectPushOptionValues, [])
  .option('--object <name>', 'Limit object-scoped pushes to matching tables/views (repeatable or comma-separated)', collectPushOptionValues, [])
  .option('--view <name>', 'Alias for --object', collectPushOptionValues, [])
  .option('--field <name>', 'Push only matching fields; supports table.field or table:field', collectPushOptionValues, [])
  .option('--action <name>', 'Push only matching actions; supports table.action or table:action', collectPushOptionValues, [])
  .option('--report <name>', 'Push only matching reports', collectPushOptionValues, [])
  .option('--page <name>', 'Push only matching pages', collectPushOptionValues, [])
  .option('--script <name>', 'Push only matching backend scripts', collectPushOptionValues, [])
  .action(async (options: PushCommandOptions) => {
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
      const selection = resolvePushSelection(options);

      console.log(chalk.dim(`Using configuration: ${options.alias}`));
      console.log(chalk.dim(`Instance: ${config.instanceUrl}`));
      console.log(chalk.dim(`Project path: ${projectPath}`));
      console.log(chalk.dim(`Mode: ${pushingAll ? 'Push all files' : 'Push changed files only'}`));
      if (selection.isSelective) {
        console.log(chalk.dim(`Selection: ${selection.summary}`));
      }
      console.log();

      const pushService = new PushService(config);
      const candidateFiles = pushingAll
        ? await pushService.getAllFiles(projectPath)
        : await pushService.getChangedFiles(projectPath);
      const filesToPush = filterPushFiles(candidateFiles, selection);

      if (!options.skipValidation) {
        const validationMode = pushingAll ? 'selected project files' : 'selected changed files';
        console.log(chalk.yellow(`📋 Step 1: Validating ${validationMode}...`));

        const validationResult = await validateSelectedFiles(filesToPush);

        if (!validationResult.valid) {
          console.log(chalk.red('❌ Validation failed:'));
          validationResult.errors.forEach((error) => {
            console.log(chalk.red(`  • ${error.file}: ${error.message}`));
          });
          process.exit(1);
        }

        console.log(chalk.green('✅ Validation passed'));
        console.log();
      }

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

      console.log(chalk.yellow('🚀 Step 3: Deploying to platform...'));

      const pushSpinner = ora(pushingAll ? 'Pushing selected files from full project scan...' : 'Pushing selected changed files...').start();

      try {
        const pushResult = await pushService.pushFiles(projectPath, filesToPush);

        if (!pushResult.success) {
          pushSpinner.fail(chalk.red('Push completed with errors'));

          if (pushResult.errors.length > 0) {
            console.log();
            console.log(chalk.red(`❌ ${pushResult.errors.length} error(s):`));
            pushResult.errors.forEach((error) => {
              console.log(chalk.red(`  • ${error.file}: ${error.message}`));
            });
          }

          if (pushResult.pushedFiles.length > 0) {
            console.log();
            console.log(chalk.yellow(`⚠️  ${pushResult.pushedFiles.length} file(s) pushed successfully before errors:`));
            pushResult.pushedFiles.forEach((file) => {
              console.log(chalk.dim(`  • ${file}`));
            });
          }

          process.exit(1);
        } else if (pushResult.pushedFiles.length === 0) {
          pushSpinner.info(chalk.blue('No files to push - everything is up to date'));
          console.log();
          console.log(chalk.dim(`No deployment was needed for ${config.instanceUrl}`));
          return;
        } else {
          pushSpinner.succeed(chalk.green(`Successfully pushed ${pushResult.pushedFiles.length} file(s)`));

          console.log(chalk.dim('\nPushed files:'));
          pushResult.pushedFiles.forEach((file) => {
            console.log(chalk.dim(`  • ${file}`));
          });
        }

        console.log();
        console.log(chalk.green(selection.isSelective ? '🎉 Selective push completed successfully!' : '🎉 Push completed successfully!'));
        console.log(chalk.dim(`Deployed to ${config.instanceUrl}`));
      } catch (error) {
        pushSpinner.fail('Push failed');
        throw error;
      }
    } catch (error) {
      commandLogger.error('Push failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      console.log();
      console.log(chalk.red(`❌ Push failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

async function validateSelectedFiles(files: CustomizationFile[]): Promise<ValidationResult> {
  const validationService = new ValidationService();
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  const seen = new Set<string>();

  for (const file of files) {
    if (seen.has(file.filePath)) {
      continue;
    }

    seen.add(file.filePath);
    const fileResult = await validationService.validateFile(file.filePath);
    result.errors.push(...fileResult.errors);
    result.warnings.push(...fileResult.warnings);

    if (!fileResult.valid) {
      result.valid = false;
    }
  }

  return result;
}

function filterPushFiles(files: CustomizationFile[], selection: PushSelection): CustomizationFile[] {
  return files.filter((file) => {
    const target = mapFileTypeToTarget(file.type);

    if (!selection.targets.has(target)) {
      return false;
    }

    const objectName = getObjectNameFromPath(file.relativePath);
    if (selection.objectSelectors.length > 0) {
      if (!objectName || !matchesAnySelector(selection.objectSelectors, [objectName])) {
        return false;
      }
    }

    switch (file.type) {
      case 'object':
        return true;
      case 'field':
        return selection.fieldSelectors.length === 0 || matchesScopedSelector(
          selection.fieldSelectors,
          objectName ? [objectName] : [],
          [getItemNameFromPath(file.relativePath), file.metadata?.internal_name, file.metadata?.name, file.metadata?.label]
        );
      case 'action':
        return selection.actionSelectors.length === 0 || matchesScopedSelector(
          selection.actionSelectors,
          objectName ? [objectName] : [],
          [getItemNameFromPath(file.relativePath), file.metadata?.action_name, file.metadata?.title]
        );
      case 'data':
        return true;
      case 'report':
        return selection.reportSelectors.length === 0 || matchesAnySelector(
          selection.reportSelectors,
          [getItemNameFromPath(file.relativePath), file.metadata?.internal_name, file.metadata?.display_name]
        );
      case 'page':
        return selection.pageSelectors.length === 0 || matchesAnySelector(
          selection.pageSelectors,
          [getItemNameFromPath(file.relativePath), file.metadata?.name, file.metadata?.url]
        );
      case 'backend-script':
        return selection.scriptSelectors.length === 0 || matchesAnySelector(
          selection.scriptSelectors,
          [getItemNameFromPath(file.relativePath), file.metadata?.name]
        );
      default:
        return true;
    }
  });
}

function mapFileTypeToTarget(type: CustomizationFile['type']): PushTarget {
  switch (type) {
    case 'object':
      return 'objects';
    case 'field':
      return 'fields';
    case 'action':
      return 'actions';
    case 'data':
      return 'data';
    case 'report':
      return 'reports';
    case 'page':
      return 'pages';
    case 'backend-script':
      return 'scripts';
  }
}

function getObjectNameFromPath(relativePath: string): string | undefined {
  const normalized = relativePath.replace(/\\/g, '/');
  const match = normalized.match(/src\/objects\/([^/]+)/);
  return match?.[1];
}

function getItemNameFromPath(relativePath: string): string {
  return path.basename(relativePath, path.extname(relativePath));
}

function collectPushOptionValues(value: string, previous: string[]): string[] {
  return previous.concat(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function resolvePushSelection(options: PushCommandOptions): PushSelection {
  const explicitTargets = normalizeTargets(options.include ?? []);
  const hasExplicitTargets = explicitTargets.length > 0;

  const objectSelectors = uniqueSelectors([...(options.object ?? []), ...(options.view ?? [])]);
  const fieldSelectors = uniqueSelectors(options.field ?? []);
  const actionSelectors = uniqueSelectors(options.action ?? []);
  const reportSelectors = uniqueSelectors(options.report ?? []);
  const pageSelectors = uniqueSelectors(options.page ?? []);
  const scriptSelectors = uniqueSelectors(options.script ?? []);

  const targets = new Set<PushTarget>(explicitTargets);

  if (!hasExplicitTargets) {
    if (fieldSelectors.length > 0) {
      targets.add('fields');
    }

    if (actionSelectors.length > 0) {
      targets.add('actions');
    }

    if (reportSelectors.length > 0) {
      targets.add('reports');
    }

    if (pageSelectors.length > 0) {
      targets.add('pages');
    }

    if (scriptSelectors.length > 0) {
      targets.add('scripts');
    }

    if (targets.size === 0 && objectSelectors.length > 0) {
      targets.add('objects');
      targets.add('fields');
      targets.add('actions');
      targets.add('data');
    }

    if (targets.size === 0) {
      for (const target of ALL_PUSH_TARGETS) {
        targets.add(target);
      }
    }
  }

  validatePushSelection({
    targets,
    objectSelectors,
    fieldSelectors,
    actionSelectors,
    reportSelectors,
    pageSelectors,
    scriptSelectors
  });

  const isSelective = targets.size !== ALL_PUSH_TARGETS.length
    || objectSelectors.length > 0
    || fieldSelectors.length > 0
    || actionSelectors.length > 0
    || reportSelectors.length > 0
    || pageSelectors.length > 0
    || scriptSelectors.length > 0;

  return {
    targets,
    objectSelectors,
    fieldSelectors,
    actionSelectors,
    reportSelectors,
    pageSelectors,
    scriptSelectors,
    isSelective,
    summary: buildSelectionSummary(targets, {
      objectSelectors,
      fieldSelectors,
      actionSelectors,
      reportSelectors,
      pageSelectors,
      scriptSelectors
    })
  };
}

function normalizeTargets(values: string[]): PushTarget[] {
  const targets: PushTarget[] = [];

  for (const value of values) {
    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue || normalizedValue === 'all') {
      continue;
    }

    const target = PUSH_TARGET_ALIASES[normalizedValue];
    if (!target) {
      throw new Error(`Invalid push target "${value}". Use objects, fields, actions, reports, pages, scripts, or data.`);
    }

    if (!targets.includes(target)) {
      targets.push(target);
    }
  }

  return targets;
}

function uniqueSelectors(values: string[]): string[] {
  const seen = new Set<string>();
  const selectors: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    selectors.push(trimmed);
  }

  return selectors;
}

function validatePushSelection(selection: Omit<PushSelection, 'isSelective' | 'summary'>): void {
  if (selection.objectSelectors.length > 0 && !Array.from(selection.targets).some((target) => OBJECT_SCOPED_PUSH_TARGETS.has(target))) {
    throw new Error('Object/view selectors require pushing objects, fields, or actions.');
  }

  if (selection.fieldSelectors.length > 0 && !selection.targets.has('fields')) {
    throw new Error('Field selectors require pushing fields.');
  }

  if (selection.actionSelectors.length > 0 && !selection.targets.has('actions')) {
    throw new Error('Action selectors require pushing actions.');
  }

  if (selection.reportSelectors.length > 0 && !selection.targets.has('reports')) {
    throw new Error('Report selectors require pushing reports.');
  }

  if (selection.pageSelectors.length > 0 && !selection.targets.has('pages')) {
    throw new Error('Page selectors require pushing pages.');
  }

  if (selection.scriptSelectors.length > 0 && !selection.targets.has('scripts')) {
    throw new Error('Script selectors require pushing backend scripts.');
  }
}

function buildSelectionSummary(
  targets: Set<PushTarget>,
  selectors: Pick<PushSelection, 'objectSelectors' | 'fieldSelectors' | 'actionSelectors' | 'reportSelectors' | 'pageSelectors' | 'scriptSelectors'>
): string {
  const parts = [`targets=${Array.from(targets).join(', ')}`];

  if (selectors.objectSelectors.length > 0) {
    parts.push(`objects=${selectors.objectSelectors.join(', ')}`);
  }

  if (selectors.fieldSelectors.length > 0) {
    parts.push(`fields=${selectors.fieldSelectors.join(', ')}`);
  }

  if (selectors.actionSelectors.length > 0) {
    parts.push(`actions=${selectors.actionSelectors.join(', ')}`);
  }

  if (selectors.reportSelectors.length > 0) {
    parts.push(`reports=${selectors.reportSelectors.join(', ')}`);
  }

  if (selectors.pageSelectors.length > 0) {
    parts.push(`pages=${selectors.pageSelectors.join(', ')}`);
  }

  if (selectors.scriptSelectors.length > 0) {
    parts.push(`scripts=${selectors.scriptSelectors.join(', ')}`);
  }

  return parts.join(' | ');
}

function matchesScopedSelector(selectors: string[], scopeCandidates: Array<string | undefined>, itemCandidates: Array<string | undefined>): boolean {
  return selectors.some((selector) => {
    const { scope, name } = splitScopedSelector(selector);

    if (scope) {
      return matchesAnySelector([scope], scopeCandidates) && matchesAnySelector([name], itemCandidates);
    }

    return matchesAnySelector([name], itemCandidates);
  });
}

function splitScopedSelector(value: string): { scope?: string; name: string } {
  for (const separator of [':', '.']) {
    const index = value.indexOf(separator);
    if (index > 0 && index < value.length - 1) {
      return {
        scope: value.slice(0, index).trim(),
        name: value.slice(index + 1).trim()
      };
    }
  }

  return { name: value.trim() };
}

function matchesAnySelector(selectors: string[], candidates: Array<string | undefined>): boolean {
  return selectors.some((selector) => matchesSingleSelector(selector, candidates));
}

function matchesSingleSelector(selector: string, candidates: Array<string | undefined>): boolean {
  const selectorValues = getComparableValues(selector);

  return candidates.some((candidate) => {
    const candidateValues = getComparableValues(candidate);
    return selectorValues.some((value) => candidateValues.includes(value));
  });
}

function getComparableValues(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const normalized = normalizeLocalName(trimmed);
  const raw = trimmed.toLowerCase();

  return normalized === raw ? [raw] : [raw, normalized];
}

async function runTests(): Promise<boolean> {
  return new Promise((resolve) => {
    const spinner = ora('Running npm test...').start();

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

        if (errorOutput) {
          console.log(chalk.red('\nTest Error Output:'));
          console.log(chalk.dim(errorOutput.slice(0, 1000)));
        }
        if (output) {
          console.log(chalk.red('\nTest Output:'));
          console.log(chalk.dim(output.slice(0, 1000)));
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
