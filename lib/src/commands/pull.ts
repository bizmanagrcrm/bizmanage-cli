import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { AuthService } from '../services/auth.js';
import { ApiService, BizmanageTableResponse } from '../services/api.js';
import { ProjectStructureService } from '../services/project-structure.js';
import { BizmanageService } from '../services/bizmanage.js';
import { logger } from '../utils/logger.js';
import { HashCacheService } from '../services/hash-cache.js';
import { normalizeLocalName } from '../utils/local-name.js';

const ALL_PULL_TARGETS = ['objects', 'fields', 'actions', 'reports', 'pages', 'scripts'] as const;
type PullTarget = typeof ALL_PULL_TARGETS[number];

const OBJECT_SCOPED_PULL_TARGETS = new Set<PullTarget>(['objects', 'fields', 'actions']);

const PULL_TARGET_ALIASES: Record<string, PullTarget> = {
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

interface PullCommandOptions {
  alias: string;
  output: string;
  init?: boolean;
  delay: string;
  force?: boolean;
  include: string[];
  object: string[];
  view: string[];
  field: string[];
  action: string[];
  report: string[];
  page: string[];
  script: string[];
}

interface PullSelection {
  targets: Set<PullTarget>;
  objectSelectors: string[];
  fieldSelectors: string[];
  actionSelectors: string[];
  reportSelectors: string[];
  pageSelectors: string[];
  scriptSelectors: string[];
  isSelective: boolean;
  summary: string;
}

export const pullCommand = new Command()
  .name('pull')
  .description('Pull customizations from Bizmanage platform to local filesystem')
  .option('-a, --alias <alias>', 'Configuration alias to use (default: default)', 'default')
  .option('-o, --output <path>', 'Output directory (default: current directory)', '.')
  .option('--init', 'Initialize a new project structure')
  .option('-d, --delay <ms>', 'Delay in milliseconds between API requests (default: 0 for fast pulls)', '0')
  .option('-f, --force', 'Force pull even if local changes are detected (overwrites local files)')
  .option('--include <target>', 'Pull only selected targets: objects, fields, actions, reports, pages, scripts (repeatable or comma-separated)', collectPullOptionValues, [])
  .option('--object <name>', 'Limit object-scoped pulls to matching tables/views (repeatable or comma-separated)', collectPullOptionValues, [])
  .option('--view <name>', 'Alias for --object', collectPullOptionValues, [])
  .option('--field <name>', 'Pull only matching fields; supports table.field or table:field', collectPullOptionValues, [])
  .option('--action <name>', 'Pull only matching actions; supports table.action or table:action', collectPullOptionValues, [])
  .option('--report <name>', 'Pull only matching reports', collectPullOptionValues, [])
  .option('--page <name>', 'Pull only matching pages', collectPullOptionValues, [])
  .option('--script <name>', 'Pull only matching backend scripts', collectPullOptionValues, [])
  .action(async (options: PullCommandOptions) => {
    const serviceLogger = logger.child('PullCommand');
    serviceLogger.info(chalk.blue('⬇️  Pulling customizations from Bizmanage platform'));

    try {
      const projectPath = path.resolve(options.output);
      const authService = new AuthService(projectPath);
      const config = await authService.getConfig(options.alias);

      if (!config) {
        serviceLogger.error(chalk.red(`❌ No configuration found for alias "${options.alias}"`));
        serviceLogger.info(chalk.dim('Run "bizmanage login" first to authenticate.'));
        process.exit(1);
      }

      serviceLogger.debug(`Using configuration: ${options.alias}`);
      serviceLogger.debug(`Instance: ${config.instanceUrl}`);
      serviceLogger.debug(`Output directory: ${path.resolve(options.output)}`);

      const bizmanageService = new BizmanageService(config);
      const connectionTest = await bizmanageService.testConnection();

      if (!connectionTest.success) {
        serviceLogger.error(chalk.red(`❌ Connection test failed: ${connectionTest.message}`));
        process.exit(1);
      }

      serviceLogger.debug(`Connected successfully (${connectionTest.responseTime}ms)`);

      const delayMs = parseInt(options.delay, 10);
      if (isNaN(delayMs) || delayMs < 0) {
        serviceLogger.error(chalk.red('❌ Invalid delay value. Must be a non-negative number.'));
        process.exit(1);
      }

      if (delayMs > 0) {
        serviceLogger.debug(`Rate limiting enabled: ${delayMs}ms delay between requests`);
      }

      const apiService = new ApiService(config, delayMs);
      const projectService = new ProjectStructureService();
      const selection = resolvePullSelection(options);

      const isExistingProject = await projectService.isValidProject(projectPath);

      if (options.init || !isExistingProject) {
        if (isExistingProject && !options.init) {
          serviceLogger.warn(chalk.yellow('⚠️  Existing project found. Use --init flag to reinitialize.'));
        } else {
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

      const hashCache = new HashCacheService();
      if (isExistingProject && !options.init) {
        await hashCache.initialize(projectPath);

        if (!options.force) {
          const changes = await hashCache.getChanges(projectPath);
          const hasChanges = changes.total.changed > 0 || changes.total.new > 0 || changes.total.deleted > 0;

          if (hasChanges) {
            serviceLogger.warn(chalk.yellow('⚠️  Local changes detected - pull aborted to avoid overwriting'));
            console.log(chalk.red('❌ Pull blocked. Local changes exist.'));
            console.log(chalk.yellow('Run "bizmanage status" to review pending changes.'));
            console.log(chalk.yellow('Commit and push your work to git first, then rerun with -f to overwrite local files:'));
            console.log(chalk.blue('  bizmanage pull -f'));
            console.log(chalk.dim('Note: Using -f will override local changes with data from the platform.'));
            process.exit(1);
          }
        } else {
          await hashCache.clear();
          serviceLogger.warn(chalk.yellow('⚠️  Force pull enabled - local files will be overwritten'));
        }
      }

      if (selection.isSelective) {
        serviceLogger.info(chalk.dim(`Selection: ${selection.summary}`));
      }

      const results = {
        tables: 0,
        objects: 0,
        backendScripts: 0,
        reports: 0,
        pages: 0
      };

      const shouldFetchTables = Array.from(selection.targets).some((target) => OBJECT_SCOPED_PULL_TARGETS.has(target));
      let tables: BizmanageTableResponse[] = [];

      if (shouldFetchTables) {
        const tablesSpinner = ora('Fetching tables from Bizmanage API...').start();

        try {
          const fetchedTables = await apiService.fetchTables();
          tables = selection.objectSelectors.length > 0
            ? fetchedTables.filter((table) => matchesObjectSelector(table, selection.objectSelectors))
            : fetchedTables;

          results.tables = tables.length;

          if (selection.objectSelectors.length > 0) {
            tablesSpinner.succeed(`${chalk.green('✓')} Tables: Matched ${results.tables} of ${fetchedTables.length} tables`);
          } else {
            tablesSpinner.succeed(`${chalk.green('✓')} Tables: Found ${results.tables} tables`);
          }

          if (tables.length === 0) {
            serviceLogger.warn(chalk.yellow('⚠️  No tables matched the current pull selection'));
          }
        } catch (error) {
          tablesSpinner.fail(`${chalk.red('✗')} Failed to fetch tables`);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          if (errorMessage.includes('403') || errorMessage.includes('401')) {
            serviceLogger.warn(chalk.yellow('💡 Authentication issue detected'));
            serviceLogger.debug('Please check:');
            serviceLogger.debug('   • API key is valid and not expired');
            serviceLogger.debug('   • Instance URL is correct');
            serviceLogger.debug('   • API key has required permissions');
          } else if (errorMessage.includes('404')) {
            serviceLogger.warn(chalk.yellow('💡 Endpoint not found'));
            serviceLogger.debug('This might indicate:');
            serviceLogger.debug('   • The API endpoint URL has changed');
            serviceLogger.debug('   • Your instance might not support custom tables');
          } else if (errorMessage.includes('timeout')) {
            serviceLogger.warn(chalk.yellow('💡 Request timed out'));
            serviceLogger.debug('Consider:');
            serviceLogger.debug('   • Checking your internet connection');
            serviceLogger.debug('   • Trying again in a moment');
          }

          serviceLogger.error(chalk.red(`❌ Pull failed during table fetching: ${errorMessage}`));
          process.exit(1);
        }
      }

      if (selection.targets.has('objects')) {
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

          for (let i = 0; i < tables.length; i++) {
            const table = tables[i];
            const tableName = table.internal_name || table.display_name;
            objectsSpinner.text = `Fetching definition for ${tableName} (${i + 1}/${tables.length})...`;

            try {
              const fullDefinition = await apiService.fetchTableDefinition(tableName);
              objects.push({
                name: tableName,
                definition: fullDefinition,
                actions: []
              });
            } catch (error) {
              objectsSpinner.warn(`${chalk.yellow('⚠️')} Could not fetch definition for ${tableName}`);
            }
          }

          objectsSpinner.text = `Processing objects (${objects.length} items)...`;

          if (objects.length === 0) {
            objectsSpinner.succeed(`${chalk.green('✓')} Objects: 0 items processed`);
          } else {
            const objectResult = await projectService.writeObjectsWithRawDefinitions(projectPath, objects);

            if (objectResult.success) {
              results.objects = objectResult.itemCount;
              objectsSpinner.succeed(`${chalk.green('✓')} Objects: ${results.objects} items processed`);
            } else {
              objectsSpinner.fail(`${chalk.red('✗')} Objects: ${objectResult.errors.join(', ')}`);
              serviceLogger.error(chalk.red(`❌ Pull failed during object processing: ${objectResult.errors.join(', ')}`));
              process.exit(1);
            }
          }
        } catch (error) {
          objectsSpinner.fail(`${chalk.red('✗')} Failed to process objects`);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          serviceLogger.error(chalk.red(`❌ Pull failed during object processing: ${errorMessage}`));
          process.exit(1);
        }
      }

      let totalFields = 0;
      if (selection.targets.has('fields') && tables.length > 0) {
        const fieldsSpinner = ora('Fetching fields for tables...').start();

        try {
          for (let i = 0; i < tables.length; i++) {
            const table = tables[i];
            const tableName = table.internal_name || table.display_name;
            fieldsSpinner.text = `Fetching fields for ${tableName} (${i + 1}/${tables.length})...`;

            try {
              const fields = await apiService.fetchFields(tableName);
              const filteredFields = selection.fieldSelectors.length > 0
                ? fields.filter((field) => matchesScopedSelector(
                  selection.fieldSelectors,
                  [table.internal_name, table.display_name],
                  [field.internal_name, field.name, field.label]
                ))
                : fields;

              if (filteredFields.length > 0) {
                const fieldResult = await projectService.writeFields(projectPath, tableName, filteredFields);
                if (fieldResult.success) {
                  totalFields += fieldResult.itemCount;
                } else {
                  fieldsSpinner.warn(`${chalk.yellow('⚠️')} Failed to write fields for ${tableName}`);
                }
              }
            } catch (error) {
              fieldsSpinner.warn(`${chalk.yellow('⚠️')} Could not fetch fields for ${tableName}`);
            }
          }

          fieldsSpinner.succeed(`${chalk.green('✓')} Fields: ${totalFields} fields processed across ${tables.length} tables`);
        } catch (error) {
          fieldsSpinner.fail(`${chalk.red('✗')} Failed to process fields`);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          serviceLogger.error(chalk.red(`❌ Pull failed during fields processing: ${errorMessage}`));
          process.exit(1);
        }
      }

      let totalActions = 0;
      if (selection.targets.has('actions') && tables.length > 0) {
        const actionsSpinner = ora('Fetching actions for tables...').start();

        try {
          for (let i = 0; i < tables.length; i++) {
            const table = tables[i];
            const tableName = table.internal_name || table.display_name;
            actionsSpinner.text = `Fetching actions for ${tableName} (${i + 1}/${tables.length})...`;

            try {
              const actions = await apiService.fetchActions(tableName);
              const filteredActions = selection.actionSelectors.length > 0
                ? actions.filter((action) => matchesScopedSelector(
                  selection.actionSelectors,
                  [table.internal_name, table.display_name],
                  [action.name, action.metadata.action_name, action.metadata.title]
                ))
                : actions;

              if (filteredActions.length > 0) {
                const actionResult = await projectService.writeActions(projectPath, tableName, filteredActions);
                if (actionResult.success) {
                  totalActions += actionResult.itemCount;
                } else {
                  actionsSpinner.warn(`${chalk.yellow('⚠️')} Failed to write actions for ${tableName}`);
                }
              }
            } catch (error) {
              actionsSpinner.warn(`${chalk.yellow('⚠️')} Could not fetch actions for ${tableName}`);
            }
          }

          actionsSpinner.succeed(`${chalk.green('✓')} Actions: ${totalActions} actions processed across ${tables.length} tables`);
        } catch (error) {
          actionsSpinner.fail(`${chalk.red('✗')} Failed to process actions`);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          serviceLogger.error(chalk.red(`❌ Pull failed during actions processing: ${errorMessage}`));
          process.exit(1);
        }
      }

      if (selection.targets.has('reports')) {
        const reportsSpinner = ora('Fetching reports...').start();

        try {
          const reports = await apiService.fetchReports();
          const filteredReports = selection.reportSelectors.length > 0
            ? reports.filter((report) => matchesAnySelector(
              selection.reportSelectors,
              [report.name, report.metadata.internal_name, report.metadata.display_name]
            ))
            : reports;

          reportsSpinner.text = `Processing reports (${filteredReports.length} items)...`;

          const reportResult = await projectService.writeReports(projectPath, filteredReports);

          if (reportResult.success) {
            results.reports = reportResult.itemCount;
            reportsSpinner.succeed(`${chalk.green('✓')} Reports: ${results.reports} items processed`);
          } else {
            reportsSpinner.fail(`${chalk.red('✗')} Reports: ${reportResult.errors.join(', ')}`);
            serviceLogger.error(chalk.red(`❌ Pull failed during reports processing: ${reportResult.errors.join(', ')}`));
            process.exit(1);
          }
        } catch (error) {
          reportsSpinner.fail(`${chalk.red('✗')} Failed to fetch reports`);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          serviceLogger.error(chalk.red(`❌ Pull failed during reports fetching: ${errorMessage}`));
          process.exit(1);
        }
      }

      if (selection.targets.has('pages')) {
        const pagesSpinner = ora('Fetching pages...').start();

        try {
          const pages = await apiService.fetchPages();
          const filteredPages = selection.pageSelectors.length > 0
            ? pages.filter((page) => matchesAnySelector(
              selection.pageSelectors,
              [page.name, page.metadata.name, page.metadata.url]
            ))
            : pages;

          pagesSpinner.text = `Processing pages (${filteredPages.length} items)...`;

          const pageResult = await projectService.writePages(projectPath, filteredPages);

          if (pageResult.success) {
            results.pages = pageResult.itemCount;
            pagesSpinner.succeed(`${chalk.green('✓')} Pages: ${results.pages} items processed`);
          } else {
            pagesSpinner.fail(`${chalk.red('✗')} Pages: ${pageResult.errors.join(', ')}`);
            serviceLogger.error(chalk.red(`❌ Pull failed during pages processing: ${pageResult.errors.join(', ')}`));
            process.exit(1);
          }
        } catch (error) {
          pagesSpinner.fail(`${chalk.red('✗')} Failed to fetch pages`);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          serviceLogger.error(chalk.red(`❌ Pull failed during pages fetching: ${errorMessage}`));
          process.exit(1);
        }
      }

      if (selection.targets.has('scripts')) {
        const backendScriptsSpinner = ora('Fetching backend scripts...').start();

        try {
          const backendScripts = await apiService.fetchScripts();
          const filteredScripts = selection.scriptSelectors.length > 0
            ? backendScripts.filter((script) => matchesAnySelector(selection.scriptSelectors, [script.name]))
            : backendScripts;

          backendScriptsSpinner.text = `Processing backend scripts (${filteredScripts.length} items)...`;

          const scriptResult = await projectService.writeScripts(projectPath, filteredScripts);

          if (scriptResult.success) {
            results.backendScripts = scriptResult.itemCount;
            backendScriptsSpinner.succeed(`${chalk.green('✓')} Backend Scripts: ${results.backendScripts} items processed`);
          } else {
            backendScriptsSpinner.fail(`${chalk.red('✗')} Backend Scripts: ${scriptResult.errors.join(', ')}`);
            serviceLogger.error(chalk.red(`❌ Pull failed during backend scripts processing: ${scriptResult.errors.join(', ')}`));
            process.exit(1);
          }
        } catch (error) {
          backendScriptsSpinner.fail(`${chalk.red('✗')} Failed to fetch backend scripts`);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          serviceLogger.error(chalk.red(`❌ Pull failed during backend scripts fetching: ${errorMessage}`));
          process.exit(1);
        }
      }

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
        serviceLogger.warn(chalk.yellow('⚠️  Failed to update project config timestamp'));
      }

      serviceLogger.info('');
      serviceLogger.info(chalk.green(selection.isSelective ? '🎉 Selective pull completed successfully!' : '🎉 Pull completed successfully!'));

      const totalItems = results.objects + results.backendScripts + results.reports + results.pages + totalFields + totalActions;
      serviceLogger.info(chalk.dim(`Total: ${totalItems} items (${results.tables} tables, ${results.objects} objects, ${totalFields} fields, ${totalActions} actions, ${results.backendScripts} scripts, ${results.reports} reports, ${results.pages} pages)`));
      serviceLogger.info(chalk.dim(`Files written to: ${projectPath}`));
    } catch (error) {
      serviceLogger.error(chalk.red(`❌ Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

function collectPullOptionValues(value: string, previous: string[]): string[] {
  return previous.concat(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function resolvePullSelection(options: PullCommandOptions): PullSelection {
  const explicitTargets = normalizeTargets(options.include ?? []);
  const hasExplicitTargets = explicitTargets.length > 0;

  const objectSelectors = uniqueSelectors([...(options.object ?? []), ...(options.view ?? [])]);
  const fieldSelectors = uniqueSelectors(options.field ?? []);
  const actionSelectors = uniqueSelectors(options.action ?? []);
  const reportSelectors = uniqueSelectors(options.report ?? []);
  const pageSelectors = uniqueSelectors(options.page ?? []);
  const scriptSelectors = uniqueSelectors(options.script ?? []);

  const targets = new Set<PullTarget>(explicitTargets);

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
    }

    if (targets.size === 0) {
      for (const target of ALL_PULL_TARGETS) {
        targets.add(target);
      }
    }
  }

  validatePullSelection({
    targets,
    objectSelectors,
    fieldSelectors,
    actionSelectors,
    reportSelectors,
    pageSelectors,
    scriptSelectors
  });

  const isSelective = targets.size !== ALL_PULL_TARGETS.length
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

function normalizeTargets(values: string[]): PullTarget[] {
  const targets: PullTarget[] = [];

  for (const value of values) {
    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue || normalizedValue === 'all') {
      continue;
    }

    const target = PULL_TARGET_ALIASES[normalizedValue];
    if (!target) {
      throw new Error(`Invalid pull target "${value}". Use objects, fields, actions, reports, pages, or scripts.`);
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

function validatePullSelection(selection: Omit<PullSelection, 'isSelective' | 'summary'>): void {
  if (selection.objectSelectors.length > 0 && !Array.from(selection.targets).some((target) => OBJECT_SCOPED_PULL_TARGETS.has(target))) {
    throw new Error('Object/view selectors require pulling objects, fields, or actions.');
  }

  if (selection.fieldSelectors.length > 0 && !selection.targets.has('fields')) {
    throw new Error('Field selectors require pulling fields.');
  }

  if (selection.actionSelectors.length > 0 && !selection.targets.has('actions')) {
    throw new Error('Action selectors require pulling actions.');
  }

  if (selection.reportSelectors.length > 0 && !selection.targets.has('reports')) {
    throw new Error('Report selectors require pulling reports.');
  }

  if (selection.pageSelectors.length > 0 && !selection.targets.has('pages')) {
    throw new Error('Page selectors require pulling pages.');
  }

  if (selection.scriptSelectors.length > 0 && !selection.targets.has('scripts')) {
    throw new Error('Script selectors require pulling backend scripts.');
  }
}

function buildSelectionSummary(
  targets: Set<PullTarget>,
  selectors: Pick<PullSelection, 'objectSelectors' | 'fieldSelectors' | 'actionSelectors' | 'reportSelectors' | 'pageSelectors' | 'scriptSelectors'>
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

function matchesObjectSelector(table: BizmanageTableResponse, selectors: string[]): boolean {
  return matchesAnySelector(selectors, [table.internal_name, table.display_name]);
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
