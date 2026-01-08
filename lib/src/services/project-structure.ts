import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { 
  BizmanageProjectConfig, 
  validateProjectConfig,
  ObjectDefinition,
  ActionMetadata,
  BackendScriptMetadata,
  ReportMetadata,
  PageMetadata,
  ScriptMetadata,
  validateObjectDefinition,
  validateActionMetadata,
  validateBackendScriptMetadata,
  validateReportMetadata,
  validatePageMetadata,
  validateScriptMetadata
} from '../schemas/project-structure.js';
import { logger } from '../utils/logger.js';
import { HashCacheService } from './hash-cache.js';

export interface ProjectItem {
  id: string;
  name: string;
  type: 'object' | 'action' | 'backend-script' | 'report' | 'page';
  objectName?: string; // For actions, which object they belong to
  code?: string;
  metadata: any;
  filePath: string;
  metadataPath: string;
}

export interface PullResult {
  success: boolean;
  itemCount: number;
  errors: string[];
  warnings: string[];
}

export class ProjectStructureService {
  private serviceLogger = logger.child('ProjectStructureService');
  private hashCache: HashCacheService;

  constructor() {
    this.hashCache = new HashCacheService();
  }

  /**
   * Initialize a new Bizmanage project structure
   */
  async initializeProject(
    projectPath: string, 
    config: {
      name: string;
      description?: string;
      instanceUrl: string;
      alias: string;
    }
  ): Promise<void> {
    this.serviceLogger.debug('Initializing new project', { projectPath, name: config.name });

    // Create directory structure
    await fs.ensureDir(projectPath);
    
    const srcPath = path.join(projectPath, 'src');
    await fs.ensureDir(path.join(srcPath, 'objects'));
    await fs.ensureDir(path.join(srcPath, 'backend'));
    await fs.ensureDir(path.join(srcPath, 'reports'));
    await fs.ensureDir(path.join(srcPath, 'pages'));

    // Create project config
    const projectConfig: BizmanageProjectConfig = {
      version: '1.0.0', // TODO: Get from package.json
      instance: {
        url: config.instanceUrl,
        alias: config.alias
      },
      project: {
        name: config.name,
        description: config.description,
        createdAt: new Date().toISOString()
      }
    };

    await fs.writeJSON(
      path.join(projectPath, 'bizmanage.config.json'),
      projectConfig,
      { spaces: 2 }
    );

    this.serviceLogger.info('Project initialized successfully', { projectPath });
  }

  /**
   * Read project configuration
   */
  async readProjectConfig(projectPath: string): Promise<BizmanageProjectConfig | null> {
    const configPath = path.join(projectPath, 'bizmanage.config.json');
    
    if (!await fs.pathExists(configPath)) {
      return null;
    }

    try {
      const configData = await fs.readJSON(configPath);
      return validateProjectConfig(configData);
    } catch (error) {
      this.serviceLogger.error('Failed to read project config', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error(`Invalid project configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write fields for a specific object/table
   */
  async writeFields(
    projectPath: string,
    objectName: string,
    fields: Array<any>
  ): Promise<PullResult> {
    const result: PullResult = { success: true, itemCount: 0, errors: [], warnings: [] };
    const objectDir = path.join(projectPath, 'src', 'objects', this.sanitizeName(objectName));
    const fieldsDir = path.join(objectDir, 'fields');

    try {
      await this.hashCache.initialize(projectPath);
      await fs.ensureDir(fieldsDir);

      let written = 0;
      let skipped = 0;

      for (const field of fields) {
        // Remove id from field data
        const { id, ...fieldWithoutId } = field;
        
        // Use internal_name if available, otherwise fall back to name
        const fieldName = this.sanitizeName(field.internal_name || field.name || 'unknown');
        const fieldPath = path.join(fieldsDir, `${fieldName}.json`);

        // Write field definition only if changed
        const wasWritten = await this.hashCache.writeJSONIfChanged(
          projectPath,
          fieldPath,
          fieldWithoutId,
          { spaces: 2 }
        );
        
        if (wasWritten) {
          written++;
        } else {
          skipped++;
        }
        result.itemCount++;
      }

      await this.hashCache.save();
      
      if (skipped > 0) {
        this.serviceLogger.debug(`Wrote ${written} fields, skipped ${skipped} unchanged fields`);
      }

      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.serviceLogger.error('Failed to write fields', { objectName, error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return result;
  }

  /**
   * Write objects (tables/views) with their definitions and actions
   */
  async writeObjects(
    projectPath: string,
    objects: Array<{
      name: string;
      definition: ObjectDefinition;
      actions: Array<{
        name: string;
        code?: string;
        metadata: ActionMetadata;
      }>;
    }>
  ): Promise<PullResult> {
    const result: PullResult = { success: true, itemCount: 0, errors: [], warnings: [] };
    const objectsPath = path.join(projectPath, 'src', 'objects');

    try {
      await this.hashCache.initialize(projectPath);
      await fs.ensureDir(objectsPath);

      for (const obj of objects) {
        const objectDir = path.join(objectsPath, this.sanitizeName(obj.name));
        await fs.ensureDir(objectDir);

        // Write definition.json
        await this.hashCache.writeJSONIfChanged(
          projectPath,
          path.join(objectDir, 'definition.json'),
          obj.definition,
          { spaces: 2 }
        );

        // Write actions
        if (obj.actions.length > 0) {
          const actionsDir = path.join(objectDir, 'actions');
          await fs.ensureDir(actionsDir);

          for (const action of obj.actions) {
            const actionName = this.sanitizeName(action.name);

            // Write code file if present
            if (action.code) {
              const ext = this.getActionFileExtension(action.metadata.type);
              await this.hashCache.writeFileIfChanged(
                projectPath,
                path.join(actionsDir, `${actionName}${ext}`),
                action.code,
                'utf8'
              );
            }

            // Write metadata file
            await this.hashCache.writeJSONIfChanged(
              projectPath,
              path.join(actionsDir, `${actionName}.meta.json`),
              action.metadata,
              { spaces: 2 }
            );

            result.itemCount++;
          }
        }

        result.itemCount++;
      }

      await this.hashCache.save();
      this.serviceLogger.info(`Objects written successfully`, { count: objects.length });
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to write objects: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.serviceLogger.error('Failed to write objects', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return result;
  }

  /**
   * Write backend scripts
   */
  async writeBackendScripts(
    projectPath: string,
    scripts: Array<{
      name: string;
      code: string;
      metadata: BackendScriptMetadata;
    }>
  ): Promise<PullResult> {
    const result: PullResult = { success: true, itemCount: 0, errors: [], warnings: [] };
    const backendPath = path.join(projectPath, 'src', 'backend');

    try {
      await this.hashCache.initialize(projectPath);
      await fs.ensureDir(backendPath);

      for (const script of scripts) {
        const scriptName = this.sanitizeName(script.name);

        // Write code file
        await this.hashCache.writeFileIfChanged(
          projectPath,
          path.join(backendPath, `${scriptName}.js`),
          script.code,
          'utf8'
        );

        // Write metadata file
        await this.hashCache.writeJSONIfChanged(
          projectPath,
          path.join(backendPath, `${scriptName}.meta.json`),
          script.metadata,
          { spaces: 2 }
        );

        result.itemCount++;
      }

      await this.hashCache.save();
      this.serviceLogger.info(`Backend scripts written successfully`, { count: scripts.length });
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to write backend scripts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.serviceLogger.error('Failed to write backend scripts', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return result;
  }

  /**
   * Write reports
   */
  async writeReports(
    projectPath: string,
    reports: Array<{
      name: string;
      sql: string;
      metadata: ReportMetadata;
    }>
  ): Promise<PullResult> {
    const result: PullResult = { success: true, itemCount: 0, errors: [], warnings: [] };
    const reportsPath = path.join(projectPath, 'src', 'reports');

    try {
      await this.hashCache.initialize(projectPath);
      await fs.ensureDir(reportsPath);

      for (const report of reports) {
        const reportName = this.sanitizeName(report.name);

        // Write SQL file
        await this.hashCache.writeFileIfChanged(
          projectPath,
          path.join(reportsPath, `${reportName}.sql`),
          report.sql,
          'utf8'
        );

        // Write metadata file
        await this.hashCache.writeJSONIfChanged(
          projectPath,
          path.join(reportsPath, `${reportName}.meta.json`),
          report.metadata,
          { spaces: 2 }
        );

        result.itemCount++;
      }

      await this.hashCache.save();
      this.serviceLogger.info(`Reports written successfully`, { count: reports.length });
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to write reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.serviceLogger.error('Failed to write reports', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return result;
  }

  /**
   * Write pages
   */
  async writePages(
    projectPath: string,
    pages: Array<{
      name: string;
      html: string;
      metadata: PageMetadata;
    }>
  ): Promise<PullResult> {
    const result: PullResult = { success: true, itemCount: 0, errors: [], warnings: [] };
    const pagesPath = path.join(projectPath, 'src', 'pages');

    try {
      await this.hashCache.initialize(projectPath);
      await fs.ensureDir(pagesPath);

      for (const page of pages) {
        const pageName = this.sanitizeName(page.name);

        // Write HTML file
        await this.hashCache.writeFileIfChanged(
          projectPath,
          path.join(pagesPath, `${pageName}.html`),
          page.html,
          'utf8'
        );

        // Write metadata file
        await this.hashCache.writeJSONIfChanged(
          projectPath,
          path.join(pagesPath, `${pageName}.meta.json`),
          page.metadata,
          { spaces: 2 }
        );

        result.itemCount++;
      }

      await this.hashCache.save();
      this.serviceLogger.info(`Pages written successfully`, { count: pages.length });
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to write pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.serviceLogger.error('Failed to write pages', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return result;
  }

  /**
   * Write scripts (from /restapi/be-scripts/list)
   */
  async writeScripts(
    projectPath: string,
    scripts: Array<{
      name: string;
      code: string;
      metadata: ScriptMetadata;
    }>
  ): Promise<PullResult> {
    const result: PullResult = { success: true, itemCount: 0, errors: [], warnings: [] };
    const backendPath = path.join(projectPath, 'src', 'backend');

    try {
      await this.hashCache.initialize(projectPath);
      await fs.ensureDir(backendPath);

      for (const script of scripts) {
        const scriptName = this.sanitizeName(script.name);

        // Write code file (.js)
        await this.hashCache.writeFileIfChanged(
          projectPath,
          path.join(backendPath, `${scriptName}.js`),
          script.code,
          'utf8'
        );

        // Write metadata file (.json)
        await this.hashCache.writeJSONIfChanged(
          projectPath,
          path.join(backendPath, `${scriptName}.json`),
          script.metadata,
          { spaces: 2 }
        );

        result.itemCount++;
      }

      await this.hashCache.save();
      this.serviceLogger.info(`Scripts written successfully`, { count: scripts.length });
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to write scripts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.serviceLogger.error('Failed to write scripts', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return result;
  }

  /**
   * Read all project items from the file system
   */
  async readProjectItems(projectPath: string): Promise<ProjectItem[]> {
    const items: ProjectItem[] = [];
    const srcPath = path.join(projectPath, 'src');

    if (!await fs.pathExists(srcPath)) {
      return items;
    }

    // Read objects
    const objectsPath = path.join(srcPath, 'objects');
    if (await fs.pathExists(objectsPath)) {
      const objectItems = await this.readObjects(objectsPath);
      items.push(...objectItems);
    }

    // Read backend scripts
    const backendPath = path.join(srcPath, 'backend');
    if (await fs.pathExists(backendPath)) {
      const backendItems = await this.readBackendScripts(backendPath);
      items.push(...backendItems);
    }

    // Read reports
    const reportsPath = path.join(srcPath, 'reports');
    if (await fs.pathExists(reportsPath)) {
      const reportItems = await this.readReports(reportsPath);
      items.push(...reportItems);
    }

    // Read pages
    const pagesPath = path.join(srcPath, 'pages');
    if (await fs.pathExists(pagesPath)) {
      const pageItems = await this.readPages(pagesPath);
      items.push(...pageItems);
    }

    return items;
  }

  /**
   * Update project config with pull/push timestamps
   */
  async updateProjectConfig(projectPath: string, updates: Partial<BizmanageProjectConfig>): Promise<void> {
    const configPath = path.join(projectPath, 'bizmanage.config.json');
    
    if (!await fs.pathExists(configPath)) {
      throw new Error('Project configuration not found');
    }

    const currentConfig = await this.readProjectConfig(projectPath);
    if (!currentConfig) {
      throw new Error('Failed to read current project configuration');
    }

    const updatedConfig = { ...currentConfig, ...updates };
    
    await fs.writeJSON(configPath, updatedConfig, { spaces: 2 });
    this.serviceLogger.debug('Project config updated', { updates });
  }

  /**
   * Check if a directory is a valid Bizmanage project
   */
  async isValidProject(projectPath: string): Promise<boolean> {
    const configPath = path.join(projectPath, 'bizmanage.config.json');
    const srcPath = path.join(projectPath, 'src');
    
    return await fs.pathExists(configPath) && await fs.pathExists(srcPath);
  }

  // Private helper methods

  private async readObjects(objectsPath: string): Promise<ProjectItem[]> {
    const items: ProjectItem[] = [];
    const objectDirs = await fs.readdir(objectsPath, { withFileTypes: true });

    for (const dir of objectDirs) {
      if (!dir.isDirectory()) continue;

      const objectPath = path.join(objectsPath, dir.name);
      const defPath = path.join(objectPath, 'definition.json');

      if (await fs.pathExists(defPath)) {
        try {
          const definition = await fs.readJSON(defPath);
          validateObjectDefinition(definition);

          items.push({
            id: definition.name || dir.name,
            name: definition.name || dir.name,
            type: 'object',
            metadata: definition,
            filePath: defPath,
            metadataPath: defPath
          });

          // Read actions
          const actionsPath = path.join(objectPath, 'actions');
          if (await fs.pathExists(actionsPath)) {
            const actionItems = await this.readObjectActions(actionsPath, dir.name);
            items.push(...actionItems);
          }
        } catch (error) {
          this.serviceLogger.warn(`Failed to read object definition: ${dir.name}`, { error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    }

    return items;
  }

  private async readObjectActions(actionsPath: string, objectName: string): Promise<ProjectItem[]> {
    const items: ProjectItem[] = [];
    const files = await fs.readdir(actionsPath);
    
    const metaFiles = files.filter(f => f.endsWith('.meta.json'));

    for (const metaFile of metaFiles) {
      const actionName = metaFile.replace('.meta.json', '');
      const metaPath = path.join(actionsPath, metaFile);
      
      try {
        const metadata = await fs.readJSON(metaPath);
        validateActionMetadata(metadata);

        // Look for corresponding code file
        const possibleExtensions = ['.js', '.json'];
        let code: string | undefined;
        let codePath: string | undefined;

        for (const ext of possibleExtensions) {
          const codeFilePath = path.join(actionsPath, `${actionName}${ext}`);
          if (await fs.pathExists(codeFilePath)) {
            code = await fs.readFile(codeFilePath, 'utf8');
            codePath = codeFilePath;
            break;
          }
        }

        items.push({
          id: `${objectName}_${actionName}`,
          name: actionName,
          type: 'action',
          objectName,
          code,
          metadata,
          filePath: codePath || metaPath,
          metadataPath: metaPath
        });
      } catch (error) {
        this.serviceLogger.warn(`Failed to read action metadata: ${actionName}`, { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return items;
  }

  private async readBackendScripts(backendPath: string): Promise<ProjectItem[]> {
    const items: ProjectItem[] = [];
    const files = await fs.readdir(backendPath);
    
    const metaFiles = files.filter(f => f.endsWith('.meta.json'));

    for (const metaFile of metaFiles) {
      const scriptName = metaFile.replace('.meta.json', '');
      const metaPath = path.join(backendPath, metaFile);
      const codePath = path.join(backendPath, `${scriptName}.js`);
      
      try {
        const metadata = await fs.readJSON(metaPath);
        validateBackendScriptMetadata(metadata);

        let code: string | undefined;
        if (await fs.pathExists(codePath)) {
          code = await fs.readFile(codePath, 'utf8');
        }

        items.push({
          id: scriptName,
          name: scriptName,
          type: 'backend-script',
          code,
          metadata,
          filePath: codePath,
          metadataPath: metaPath
        });
      } catch (error) {
        this.serviceLogger.warn(`Failed to read backend script: ${scriptName}`, { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return items;
  }

  private async readReports(reportsPath: string): Promise<ProjectItem[]> {
    const items: ProjectItem[] = [];
    const files = await fs.readdir(reportsPath);
    
    const metaFiles = files.filter(f => f.endsWith('.meta.json'));

    for (const metaFile of metaFiles) {
      const reportName = metaFile.replace('.meta.json', '');
      const metaPath = path.join(reportsPath, metaFile);
      const sqlPath = path.join(reportsPath, `${reportName}.sql`);
      
      try {
        const metadata = await fs.readJSON(metaPath);
        validateReportMetadata(metadata);

        let code: string | undefined;
        if (await fs.pathExists(sqlPath)) {
          code = await fs.readFile(sqlPath, 'utf8');
        }

        items.push({
          id: reportName,
          name: reportName,
          type: 'report',
          code,
          metadata,
          filePath: sqlPath,
          metadataPath: metaPath
        });
      } catch (error) {
        this.serviceLogger.warn(`Failed to read report: ${reportName}`, { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return items;
  }

  private async readPages(pagesPath: string): Promise<ProjectItem[]> {
    const items: ProjectItem[] = [];
    const files = await fs.readdir(pagesPath);
    
    const metaFiles = files.filter(f => f.endsWith('.meta.json'));

    for (const metaFile of metaFiles) {
      const pageName = metaFile.replace('.meta.json', '');
      const metaPath = path.join(pagesPath, metaFile);
      const htmlPath = path.join(pagesPath, `${pageName}.html`);
      
      try {
        const metadata = await fs.readJSON(metaPath);
        validatePageMetadata(metadata);

        let code: string | undefined;
        if (await fs.pathExists(htmlPath)) {
          code = await fs.readFile(htmlPath, 'utf8');
        }

        items.push({
          id: pageName,
          name: pageName,
          type: 'page',
          code,
          metadata,
          filePath: htmlPath,
          metadataPath: metaPath
        });
      } catch (error) {
        this.serviceLogger.warn(`Failed to read page: ${pageName}`, { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return items;
  }

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private getActionFileExtension(type: string): string {
    switch (type) {
      case 'javascript':
        return '.js';
      case 'configuration':
      case 'http':
      case 'link':
        return '.json';
      default:
        return '.txt';
    }
  }
}
