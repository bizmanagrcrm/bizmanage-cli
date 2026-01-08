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
   * Push object definition
   */
  private async pushObject(file: CustomizationFile): Promise<void> {
    // TODO: Implement actual API call
    // Example: POST /api/objects or PUT /api/objects/{id}
    this.serviceLogger.info('Pushing object', { path: file.relativePath });
    
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation:
    // const objectData = JSON.parse(file.content);
    // await this.apiService.client.post('/api/objects', objectData);
  }

  /**
   * Push action (code + metadata)
   */
  private async pushAction(file: CustomizationFile): Promise<void> {
    // TODO: Implement actual API call
    // Example: POST /api/actions or PUT /api/actions/{id}
    this.serviceLogger.info('Pushing action', { path: file.relativePath });
    
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation:
    // await this.apiService.client.post('/api/actions', {
    //   code: file.content,
    //   metadata: file.metadata
    // });
  }

  /**
   * Push field definition
   */
  private async pushField(file: CustomizationFile): Promise<void> {
    // TODO: Implement actual API call
    // Example: POST /api/fields or PUT /api/fields/{id}
    this.serviceLogger.info('Pushing field', { path: file.relativePath });
    
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation:
    // const fieldData = JSON.parse(file.content);
    // await this.apiService.client.post('/api/fields', fieldData);
  }

  /**
   * Push backend script (code + metadata)
   */
  private async pushBackendScript(file: CustomizationFile): Promise<void> {
    // TODO: Implement actual API call
    // Example: POST /api/scripts or PUT /api/scripts/{id}
    this.serviceLogger.info('Pushing backend script', { path: file.relativePath });
    
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation:
    // await this.apiService.client.post('/api/scripts', {
    //   code: file.content,
    //   metadata: file.metadata
    // });
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
    // TODO: Implement actual API call
    // Example: POST /api/pages or PUT /api/pages/{id}
    this.serviceLogger.info('Pushing page', { path: file.relativePath });
    
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation:
    // await this.apiService.client.post('/api/pages', {
    //   html: file.content,
    //   metadata: file.metadata
    // });
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
