import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';
import { HashCacheService } from './hash-cache.js';
import { ApiService } from './api.js';
import { AuthConfig } from './auth.js';

export interface PushResult {
  success: boolean;
  pushedFiles: string[];
  skippedFiles: string[];
  errors: PushError[];
}

export interface PushError {
  file: string;
  type: string;
  message: string;
}

export type PushCustomizationType = 'object' | 'action' | 'field' | 'backend-script' | 'report' | 'page';

interface CustomizationFile {
  filePath: string;
  relativePath: string;
  type: PushCustomizationType;
  content: string;
  metadata?: any;
}

export class PushService {
  private serviceLogger = logger.child('PushService');
  private apiService: ApiService;
  private hashCache: HashCacheService;

  constructor(config: AuthConfig) {
    this.apiService = new ApiService(config, 0);
    this.hashCache = new HashCacheService();
  }

  /**
   * Detect customization type from file path
   */
  private detectType(filePath: string): PushCustomizationType | null {
    const normalized = filePath.replace(/\\/g, '/');
    
    if (normalized.includes('/objects/') && normalized.endsWith('/definition.json')) {
      return 'object';
    }
    if (normalized.includes('/objects/') && normalized.includes('/actions/')) {
      return 'action';
    }
    if (normalized.includes('/objects/') && normalized.includes('/fields/')) {
      return 'field';
    }
    if (normalized.includes('/backend/')) {
      return 'backend-script';
    }
    if (normalized.includes('/reports/')) {
      return 'report';
    }
    if (normalized.includes('/pages/')) {
      return 'page';
    }
    
    return null;
  }

  /**
   * Get changed files from the project
   */
  async getChangedFiles(projectPath: string): Promise<CustomizationFile[]> {
    await this.hashCache.initialize(projectPath);
    const changes = await this.hashCache.getChanges(projectPath);

    const changedFiles: CustomizationFile[] = [];

    // Process changed files
    for (const files of Object.values(changes.changed)) {
      for (const relPath of files) {
        const fullPath = path.join(projectPath, relPath);
        const type = this.detectType(fullPath);
        
        if (type) {
          const content = await fs.readFile(fullPath, 'utf8');
          changedFiles.push({
            filePath: fullPath,
            relativePath: relPath,
            type,
            content,
            metadata: await this.loadMetadata(fullPath, type)
          });
        }
      }
    }

    // Process new files
    for (const files of Object.values(changes.new)) {
      for (const relPath of files) {
        const fullPath = path.join(projectPath, relPath);
        const type = this.detectType(fullPath);
        
        if (type) {
          const content = await fs.readFile(fullPath, 'utf8');
          changedFiles.push({
            filePath: fullPath,
            relativePath: relPath,
            type,
            content,
            metadata: await this.loadMetadata(fullPath, type)
          });
        }
      }
    }

    this.serviceLogger.debug('Found changed files', { count: changedFiles.length });
    return changedFiles;
  }

  /**
   * Load associated metadata file if it exists
   */
  private async loadMetadata(filePath: string, type: PushCustomizationType): Promise<any> {
    try {
      // For .js files, look for corresponding .json metadata file
      if (filePath.endsWith('.js')) {
        const metadataPath = filePath.replace('.js', '.json');
        if (await fs.pathExists(metadataPath)) {
          return await fs.readJSON(metadataPath);
        }
      }
      
      // For .json files, return the content itself
      if (filePath.endsWith('.json')) {
        return await fs.readJSON(filePath);
      }

      // For .sql files (reports), look for metadata
      if (filePath.endsWith('.sql')) {
        const metadataPath = filePath.replace('.sql', '.json');
        if (await fs.pathExists(metadataPath)) {
          return await fs.readJSON(metadataPath);
        }
      }

      // For .html files (pages), look for metadata
      if (filePath.endsWith('.html')) {
        const metadataPath = filePath.replace('.html', '.json');
        if (await fs.pathExists(metadataPath)) {
          return await fs.readJSON(metadataPath);
        }
      }

      return null;
    } catch (error) {
      this.serviceLogger.warn('Failed to load metadata', { 
        file: filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Push a single customization to the platform
   */
  private async pushCustomization(file: CustomizationFile): Promise<void> {
    this.serviceLogger.debug('Pushing customization', { 
      type: file.type, 
      path: file.relativePath 
    });

    // Different push methods for different types
    switch (file.type) {
      case 'object':
        await this.pushObject(file);
        break;
      case 'action':
        await this.pushAction(file);
        break;
      case 'field':
        await this.pushField(file);
        break;
      case 'backend-script':
        await this.pushBackendScript(file);
        break;
      case 'report':
        await this.pushReport(file);
        break;
      case 'page':
        await this.pushPage(file);
        break;
      default:
        throw new Error(`Unknown customization type: ${file.type}`);
    }
  }

  /**
   * Push object definition to /restapi/customization/view-by-internal-name
   */
  private async pushObject(file: CustomizationFile): Promise<void> {
    this.serviceLogger.info('Pushing object definition', { path: file.relativePath });
    
    try {
      // Parse the definition file (raw API format)
      const definition = JSON.parse(file.content);
      
      // The definition.json now contains the raw API response format
      // We just need to ensure internal_name is present for the push
      if (!definition.internal_name) {
        throw new Error('Object definition missing required field: internal_name');
      }
      
      // Push the definition as-is (it's already in the API format)
      await this.apiService.pushObjectDefinition(definition);
      
      this.serviceLogger.debug('Successfully pushed object definition', { 
        internal_name: definition.internal_name,
        display_name: definition.display_name
      });
    } catch (error) {
      this.serviceLogger.error('Failed to push object definition', {
        path: file.relativePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Push action (metadata + optional code) to /restapi/customization/action
   */
  private async pushAction(file: CustomizationFile): Promise<void> {
    this.serviceLogger.info('Pushing action', { path: file.relativePath });
    
    try {
      let metadata: any;
      let code: string | undefined;
      
      // Determine if this is a .json metadata file or .js code file
      if (file.filePath.endsWith('.json')) {
        // This is the metadata file
        metadata = JSON.parse(file.content);
        
        // Always check for corresponding .js file (not just for custom-script type)
        const codePath = file.filePath.replace('.json', '.js');
        if (await fs.pathExists(codePath)) {
          code = await fs.readFile(codePath, 'utf8');
          this.serviceLogger.debug('Found corresponding code file', { codePath });
        }
      } else if (file.filePath.endsWith('.js')) {
        // This is a code file, load corresponding metadata
        const metadataPath = file.filePath.replace('.js', '.json');
        if (await fs.pathExists(metadataPath)) {
          metadata = await fs.readJSON(metadataPath);
          code = file.content;
        } else {
          throw new Error(`Metadata file not found for action code: ${metadataPath}`);
        }
      } else {
        throw new Error(`Unsupported action file type: ${file.filePath}`);
      }
      
      // Extract table name from path: src/objects/{tableName}/actions/{actionName}.json
      const normalized = file.relativePath.replace(/\\/g, '/');
      const match = normalized.match(/objects\/([^/]+)\/actions\//);
      
      if (!match) {
        throw new Error(`Cannot extract table name from path: ${file.relativePath}`);
      }
      
      const tableName = match[1];
      
      // Add table_name to metadata if not present
      if (!metadata.table_name) {
        metadata.table_name = tableName;
        this.serviceLogger.debug('Added table_name to action metadata', { table_name: tableName });
      }
      
      // If we have code, include it in the metadata as custom_script
      if (code) {
        metadata.custom_script = code;
        this.serviceLogger.debug('Added custom_script to action metadata', { 
          table_name: tableName,
          action_name: metadata.action_name,
          code_length: code.length 
        });
      }
      
      // Validate required fields
      if (!metadata.action_name) {
        throw new Error('Action definition missing required field: action_name');
      }
      
      // Push the action using the ApiService method (passing metadata only now)
      await this.apiService.pushActionDefinition(metadata, code);
      
      this.serviceLogger.debug('Successfully pushed action', { 
        table_name: metadata.table_name,
        action_name: metadata.action_name,
        has_code: !!code
      });
    } catch (error) {
      this.serviceLogger.error('Failed to push action', {
        path: file.relativePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Push field definition to /restapi/customization/field-by-internal-name
   */
  private async pushField(file: CustomizationFile): Promise<void> {
    this.serviceLogger.info('Pushing field', { path: file.relativePath });
    
    try {
      // Parse the field JSON file
      const fieldData = JSON.parse(file.content);
      
      // Extract table name from path: src/objects/{tableName}/fields/{fieldName}.json
      const normalized = file.relativePath.replace(/\\/g, '/');
      const match = normalized.match(/objects\/([^/]+)\/fields\//);
      
      if (!match) {
        throw new Error(`Cannot extract table name from path: ${file.relativePath}`);
      }
      
      const tableName = match[1];
      
      // Validate required fields
      if (!fieldData.internal_name) {
        throw new Error('Field definition missing required field: internal_name');
      }
      
      // Push the field using the ApiService method
      await this.apiService.pushFieldDefinition(tableName, fieldData);
      
      this.serviceLogger.debug('Successfully pushed field', { 
        table: tableName,
        internal_name: fieldData.internal_name,
        field_name: fieldData.field
      });
    } catch (error) {
      this.serviceLogger.error('Failed to push field', {
        path: file.relativePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Push backend script (code + metadata)
   */
  private async pushBackendScript(file: CustomizationFile): Promise<void> {
    this.serviceLogger.info('Pushing backend script', { path: file.relativePath });
    
    try {
      let metadata: any;
      let code: string;
      
      // Determine if this is a .json metadata file or .js code file
      if (file.filePath.endsWith('.json')) {
        // This is the metadata file
        metadata = JSON.parse(file.content);
        
        // Check for corresponding .js file
        const codePath = file.filePath.replace('.json', '.js');
        if (await fs.pathExists(codePath)) {
          code = await fs.readFile(codePath, 'utf8');
          this.serviceLogger.debug('Found corresponding code file', { codePath });
        } else {
          throw new Error(`Code file not found for backend script: ${codePath}`);
        }
      } else if (file.filePath.endsWith('.js')) {
        // This is a code file, load corresponding metadata
        const metadataPath = file.filePath.replace('.js', '.json');
        if (await fs.pathExists(metadataPath)) {
          metadata = await fs.readJSON(metadataPath);
          code = file.content;
        } else {
          throw new Error(`Metadata file not found for backend script code: ${metadataPath}`);
        }
      } else {
        throw new Error(`Unsupported backend script file type: ${file.filePath}`);
      }
      
      // Validate required fields
      if (!metadata.name) {
        throw new Error('Backend script metadata missing required field: name');
      }
      
      // Push the backend script using the ApiService method
      await this.apiService.pushBackendScript(metadata, code);
      
      this.serviceLogger.debug('Successfully pushed backend script', { 
        name: metadata.name,
        method: metadata.method,
        active: metadata.active,
        code_length: code.length
      });
    } catch (error) {
      this.serviceLogger.error('Failed to push backend script', {
        path: file.relativePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Push report (SQL + metadata)
   */
  private async pushReport(file: CustomizationFile): Promise<void> {
    // TODO: Implement actual API call
    // Example: POST /api/reports or PUT /api/reports/{id}
    this.serviceLogger.info('Pushing report', { path: file.relativePath });
    
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation:
    // await this.apiService.client.post('/api/reports', {
    //   sql: file.content,
    //   metadata: file.metadata
    // });
  }

  /**
   * Push page (HTML + metadata)
   */
  private async pushPage(file: CustomizationFile): Promise<void> {
    this.serviceLogger.info('Pushing page', { path: file.relativePath });
    
    try {
      let metadata: any;
      let content: string;
      
      // Determine if this is a .json metadata file or .html content file
      if (file.filePath.endsWith('.json')) {
        // This is the metadata file
        metadata = JSON.parse(file.content);
        
        // Check for corresponding .html file
        const contentPath = file.filePath.replace('.json', '.html');
        if (await fs.pathExists(contentPath)) {
          content = await fs.readFile(contentPath, 'utf8');
          this.serviceLogger.debug('Found corresponding HTML file', { contentPath });
        } else {
          throw new Error(`HTML file not found for page: ${contentPath}`);
        }
      } else if (file.filePath.endsWith('.html')) {
        // This is an HTML file, load corresponding metadata
        const metadataPath = file.filePath.replace('.html', '.json');
        if (await fs.pathExists(metadataPath)) {
          metadata = await fs.readJSON(metadataPath);
          content = file.content;
        } else {
          throw new Error(`Metadata file not found for page HTML: ${metadataPath}`);
        }
      } else {
        throw new Error(`Unsupported page file type: ${file.filePath}`);
      }
      
      // Validate required fields
      if (!metadata.url) {
        throw new Error('Page metadata missing required field: url');
      }
      if (!metadata.name) {
        throw new Error('Page metadata missing required field: name');
      }
      
      // Push the page using the ApiService method
      await this.apiService.pushPage(metadata, content);
      
      this.serviceLogger.debug('Successfully pushed page', { 
        url: metadata.url,
        name: metadata.name,
        content_length: content.length
      });
    } catch (error) {
      this.serviceLogger.error('Failed to push page', {
        path: file.relativePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Push only changed files to the platform
   */
  async pushChangedFiles(projectPath: string): Promise<PushResult> {
    const result: PushResult = {
      success: true,
      pushedFiles: [],
      skippedFiles: [],
      errors: []
    };

    try {
      const changedFiles = await this.getChangedFiles(projectPath);

      if (changedFiles.length === 0) {
        this.serviceLogger.info('No changed files to push');
        return result;
      }

      this.serviceLogger.info('Pushing changed files', { count: changedFiles.length });

      // Push each file
      for (const file of changedFiles) {
        try {
          await this.pushCustomization(file);
          result.pushedFiles.push(file.relativePath);
          
          // Update hash after successful push
          await this.hashCache.updateHash(projectPath, file.filePath, file.content);
          
        } catch (error) {
          result.success = false;
          result.errors.push({
            file: file.relativePath,
            type: file.type,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
          this.serviceLogger.error('Failed to push file', {
            file: file.relativePath,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Save hash cache after all pushes
      await this.hashCache.save();

    } catch (error) {
      result.success = false;
      result.errors.push({
        file: 'project',
        type: 'system',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return result;
  }

  /**
   * Push all files in the project (bypass change detection)
   */
  async pushAllFiles(projectPath: string): Promise<PushResult> {
    const result: PushResult = {
      success: true,
      pushedFiles: [],
      skippedFiles: [],
      errors: []
    };

    const srcPath = path.join(projectPath, 'src');
    if (!await fs.pathExists(srcPath)) {
      result.success = false;
      result.errors.push({
        file: projectPath,
        type: 'project',
        message: 'Not a valid project - src directory not found'
      });
      return result;
    }

    // Collect all files
    const allFiles: CustomizationFile[] = [];
    
    const scanDir = async (dir: string) => {
      if (!await fs.pathExists(dir)) return;
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && !entry.name.startsWith('.')) {
          const type = this.detectType(fullPath);
          if (type) {
            const content = await fs.readFile(fullPath, 'utf8');
            const relPath = path.relative(projectPath, fullPath);
            allFiles.push({
              filePath: fullPath,
              relativePath: relPath,
              type,
              content,
              metadata: await this.loadMetadata(fullPath, type)
            });
          }
        }
      }
    };

    await scanDir(srcPath);

    this.serviceLogger.info('Pushing all files', { count: allFiles.length });

    // Initialize hash cache
    await this.hashCache.initialize(projectPath);

    // Push each file
    for (const file of allFiles) {
      try {
        await this.pushCustomization(file);
        result.pushedFiles.push(file.relativePath);
        
        // Update hash after successful push
        await this.hashCache.updateHash(projectPath, file.filePath, file.content);
        
      } catch (error) {
        result.success = false;
        result.errors.push({
          file: file.relativePath,
          type: file.type,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Save hash cache after all pushes
    await this.hashCache.save();

    return result;
  }
}
