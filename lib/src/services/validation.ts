import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';
import {
  ObjectDefinitionSchema,
  ActionMetadataSchema,
  BackendScriptMetadataSchema,
  ReportMetadataSchema,
  PageMetadataSchema,
  ScriptMetadataSchema
} from '../schemas/project-structure.js';
import { HashCacheService } from './hash-cache.js';

// AsyncFunction constructor for validating async/await syntax
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  file: string;
  type: string;
  message: string;
  path?: string;
}

export interface ValidationWarning {
  file: string;
  type: string;
  message: string;
}

export type CustomizationType = 'object' | 'action' | 'field' | 'backend-script' | 'report' | 'page' | 'unknown';

export class ValidationService {
  private serviceLogger = logger.child('ValidationService');

  /**
   * Detect customization type from file path
   */
  detectType(filePath: string): CustomizationType {
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
    
    return 'unknown';
  }

  /**
   * Validate a single file
   */
  async validateFile(filePath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (!await fs.pathExists(filePath)) {
      result.valid = false;
      result.errors.push({
        file: filePath,
        type: 'file',
        message: 'File does not exist'
      });
      return result;
    }

    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      result.valid = false;
      result.errors.push({
        file: filePath,
        type: 'file',
        message: 'Path is not a file'
      });
      return result;
    }

    const type = this.detectType(filePath);
    
    try {
      switch (type) {
        case 'object':
          await this.validateObjectDefinition(filePath, result);
          break;
        case 'action':
          await this.validateAction(filePath, result);
          break;
        case 'field':
          await this.validateField(filePath, result);
          break;
        case 'backend-script':
          await this.validateBackendScript(filePath, result);
          break;
        case 'report':
          await this.validateReport(filePath, result);
          break;
        case 'page':
          await this.validatePage(filePath, result);
          break;
        default:
          result.warnings.push({
            file: filePath,
            type: 'unknown',
            message: 'Unknown customization type - skipping validation'
          });
      }
    } catch (error) {
      result.valid = false;
      result.errors.push({
        file: filePath,
        type: 'validation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return result;
  }

  /**
   * Validate all files in a project
   */
  async validateProject(projectPath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    const srcPath = path.join(projectPath, 'src');
    if (!await fs.pathExists(srcPath)) {
      result.valid = false;
      result.errors.push({
        file: projectPath,
        type: 'project',
        message: 'Not a valid project - src directory not found'
      });
      return result;
    }

    // Scan all files
    const filesToValidate: string[] = [];
    
    const scanDir = async (dir: string) => {
      if (!await fs.pathExists(dir)) return;
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && !entry.name.startsWith('.')) {
          filesToValidate.push(fullPath);
        }
      }
    };

    await scanDir(srcPath);

    // Validate each file
    for (const file of filesToValidate) {
      const fileResult = await this.validateFile(file);
      result.errors.push(...fileResult.errors);
      result.warnings.push(...fileResult.warnings);
      if (!fileResult.valid) {
        result.valid = false;
      }
    }

    return result;
  }

  /**
   * Validate only changed/new files in a project using hash cache
   */
  async validateChangedFiles(projectPath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    const srcPath = path.join(projectPath, 'src');
    if (!await fs.pathExists(srcPath)) {
      result.valid = false;
      result.errors.push({
        file: projectPath,
        type: 'project',
        message: 'Not a valid project - src directory not found'
      });
      return result;
    }

    // Get changed files using hash cache
    const hashCache = new HashCacheService();
    await hashCache.initialize(projectPath);
    const changes = await hashCache.getChanges(projectPath);

    // Collect files to validate (changed and new)
    const filesToValidate: string[] = [];
    
    for (const files of Object.values(changes.changed)) {
      for (const relPath of files) {
        filesToValidate.push(path.join(projectPath, relPath));
      }
    }
    
    for (const files of Object.values(changes.new)) {
      for (const relPath of files) {
        filesToValidate.push(path.join(projectPath, relPath));
      }
    }

    // If no changes, return success
    if (filesToValidate.length === 0) {
      this.serviceLogger.debug('No changed files to validate');
      return result;
    }

    this.serviceLogger.debug('Validating changed files', { count: filesToValidate.length });

    // Validate each changed file
    for (const file of filesToValidate) {
      const fileResult = await this.validateFile(file);
      result.errors.push(...fileResult.errors);
      result.warnings.push(...fileResult.warnings);
      if (!fileResult.valid) {
        result.valid = false;
      }
    }

    return result;
  }

  // Validators for each customization type

  private async validateObjectDefinition(filePath: string, result: ValidationResult): Promise<void> {
    const content = await fs.readJSON(filePath);
    
    try {
      ObjectDefinitionSchema.parse(content);
    } catch (error: any) {
      result.valid = false;
      if (error.errors) {
        error.errors.forEach((err: any) => {
          result.errors.push({
            file: filePath,
            type: 'object',
            message: `${err.path.join('.')}: ${err.message}`,
            path: err.path.join('.')
          });
        });
      } else {
        result.errors.push({
          file: filePath,
          type: 'object',
          message: error.message
        });
      }
      return;
    }

    // Additional business logic validation (raw API format)
    if (!content.internal_name || content.internal_name.trim() === '') {
      result.errors.push({
        file: filePath,
        type: 'object',
        message: 'Object internal_name cannot be empty'
      });
      result.valid = false;
    }
    
    if (!content.display_name || content.display_name.trim() === '') {
      result.errors.push({
        file: filePath,
        type: 'object',
        message: 'Object display_name cannot be empty'
      });
      result.valid = false;
    }
  }

  private async validateAction(filePath: string, result: ValidationResult): Promise<void> {
    // Actions can be .js (code) or .json (metadata)
    if (filePath.endsWith('.js')) {
      // Validate JavaScript syntax
      const content = await fs.readFile(filePath, 'utf8');
      
      if (content.trim() === '') {
        result.warnings.push({
          file: filePath,
          type: 'action',
          message: 'Action script is empty'
        });
      }
      
      // Basic syntax check
      try {
        // Try with AsyncFunction to support await
        new AsyncFunction(content);
      } catch (error: any) {
        // Ignore top-level await errors since the runtime supports it
        if (!error.message.includes('await is only valid in async functions')) {
          result.errors.push({
            file: filePath,
            type: 'action',
            message: `JavaScript syntax error: ${error.message}`
          });
          result.valid = false;
        }
      }
    } else if (filePath.endsWith('.json')) {
      const content = await fs.readJSON(filePath);
      
      try {
        ActionMetadataSchema.parse(content);
      } catch (error: any) {
        result.valid = false;
        if (error.errors) {
          error.errors.forEach((err: any) => {
            result.errors.push({
              file: filePath,
              type: 'action',
              message: `${err.path.join('.')}: ${err.message}`,
              path: err.path.join('.')
            });
          });
        } else {
          result.errors.push({
            file: filePath,
            type: 'action',
            message: error.message
          });
        }
      }
    }
  }

  private async validateField(filePath: string, result: ValidationResult): Promise<void> {
    const content = await fs.readJSON(filePath);
    // relative to /src directory
    const relativeFilePath = path.relative(path.dirname(path.dirname(path.dirname(filePath))), filePath).replace(/\\/g, '/');
    // Basic field validation
    if (!content.internal_name || content.internal_name.trim() === '') {
      result.errors.push({
        file: relativeFilePath,
        type: 'field',
        message: `Field internal_name is required (file: ${relativeFilePath})`
      });
      result.valid = false;
    }

    if (!content.type || content.type.trim() === '') {
      result.errors.push({
        file: filePath,
        type: 'field',
        message: 'Field type is required'
      });
      result.valid = false;
    }
  }

  private async validateBackendScript(filePath: string, result: ValidationResult): Promise<void> {
    if (filePath.endsWith('.js')) {
      // Validate JavaScript
      const content = await fs.readFile(filePath, 'utf8');
      
      if (content.trim() === '') {
        result.warnings.push({
          file: filePath,
          type: 'backend-script',
          message: 'Backend script is empty'
        });
      }

      // Check for syntax errors
      try {
        // Try with AsyncFunction to support await
        new AsyncFunction(content);
      } catch (error: any) {
        // Ignore top-level await errors since the runtime supports it
        if (!error.message.includes('await is only valid in async functions')) {
          result.errors.push({
            file: filePath,
            type: 'backend-script',
            message: `JavaScript syntax error: ${error.message}`
          });
          result.valid = false;
        }
      }
    } else if (filePath.endsWith('.json')) {
      const content = await fs.readJSON(filePath);
      
      try {
        ScriptMetadataSchema.parse(content);
      } catch (error: any) {
        result.valid = false;
        if (error.errors) {
          error.errors.forEach((err: any) => {
            result.errors.push({
              file: filePath,
              type: 'backend-script',
              message: `${err.path.join('.')}: ${err.message}`,
              path: err.path.join('.')
            });
          });
        }
      }
    }
  }

  private async validateReport(filePath: string, result: ValidationResult): Promise<void> {
    if (filePath.endsWith('.sql')) {
      // Validate SQL
      const content = await fs.readFile(filePath, 'utf8');
      
      if (content.trim() === '') {
        result.errors.push({
          file: filePath,
          type: 'report',
          message: 'SQL query is empty'
        });
        result.valid = false;
      }

      // Basic SQL validation - check for common keywords
      const upperContent = content.toUpperCase();
      if (!upperContent.includes('SELECT') && !upperContent.includes('WITH')) {
        result.warnings.push({
          file: filePath,
          type: 'report',
          message: 'SQL query does not contain SELECT or WITH statement'
        });
      }
    } else if (filePath.endsWith('.json')) {
      const content = await fs.readJSON(filePath);
      
      try {
        ReportMetadataSchema.parse(content);
      } catch (error: any) {
        result.valid = false;
        if (error.errors) {
          error.errors.forEach((err: any) => {
            result.errors.push({
              file: filePath,
              type: 'report',
              message: `${err.path.join('.')}: ${err.message}`,
              path: err.path.join('.')
            });
          });
        }
      }
    }
  }

  private async validatePage(filePath: string, result: ValidationResult): Promise<void> {
    if (filePath.endsWith('.html')) {
      // Validate HTML
      const content = await fs.readFile(filePath, 'utf8');
      
      if (content.trim() === '') {
        result.warnings.push({
          file: filePath,
          type: 'page',
          message: 'HTML content is empty'
        });
      }

      // Basic HTML validation - check for balanced tags
      const openTags = (content.match(/<[^/][^>]*>/g) || []).length;
      const closeTags = (content.match(/<\/[^>]+>/g) || []).length;
      
      if (openTags !== closeTags) {
        result.warnings.push({
          file: filePath,
          type: 'page',
          message: `Possibly unbalanced HTML tags (${openTags} open, ${closeTags} close)`
        });
      }
    } else if (filePath.endsWith('.json')) {
      const content = await fs.readJSON(filePath);
      
      try {
        PageMetadataSchema.parse(content);
      } catch (error: any) {
        result.valid = false;
        if (error.errors) {
          error.errors.forEach((err: any) => {
            result.errors.push({
              file: filePath,
              type: 'page',
              message: `${err.path.join('.')}: ${err.message}`,
              path: err.path.join('.')
            });
          });
        }
      }
    }
  }
}
