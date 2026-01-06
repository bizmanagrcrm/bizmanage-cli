import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import { FileSystemService } from './filesystem.js';

// Base metadata schema that all customizations share
const baseMetadataSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver format (e.g., 1.0.0)'),
  author: z.string().min(1, 'Author is required'),
  tags: z.array(z.string()).min(1, 'At least one tag is required')
});

// Backend script specific metadata schema
const backendScriptMetadataSchema = baseMetadataSchema.extend({
  entryPoint: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  permissions: z.array(z.enum(['read', 'write', 'execute', 'admin'])).optional(),
  schedule: z.object({
    enabled: z.boolean(),
    cron: z.string().optional(),
    timezone: z.string().optional()
  }).optional()
});

// Report metadata schema
const reportMetadataSchema = baseMetadataSchema.extend({
  category: z.enum(['financial', 'operational', 'analytics', 'custom']),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'date', 'boolean']),
    required: z.boolean(),
    defaultValue: z.any().optional()
  })).optional(),
  refreshRate: z.number().min(0).optional()
});

// Page metadata schema
const pageMetadataSchema = baseMetadataSchema.extend({
  route: z.string().regex(/^\/[a-zA-Z0-9\-_\/]*$/, 'Route must be a valid path starting with /'),
  permissions: z.array(z.string()).optional(),
  layout: z.enum(['default', 'minimal', 'fullscreen']).optional(),
  theme: z.string().optional()
});

// Field metadata schema
const fieldMetadataSchema = baseMetadataSchema.extend({
  fieldType: z.enum(['text', 'number', 'date', 'select', 'multiselect', 'boolean']),
  required: z.boolean(),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    options: z.array(z.string()).optional()
  }).optional()
});

// Main metadata file schema (meta.json)
const metadataFileSchema = z.object({
  scope: z.string().min(1, 'Scope is required'),
  generatedAt: z.string().datetime('Invalid datetime format'),
  itemCount: z.number().min(0, 'Item count must be non-negative'),
  items: z.array(z.object({
    id: z.string().min(1, 'ID is required'),
    name: z.string().min(1, 'Name is required'),
    type: z.enum(['report', 'page', 'backend-script', 'field']),
    file: z.string().min(1, 'File path is required'),
    metadata: z.record(z.any()) // Will be validated separately based on type
  })).min(0, 'Items array is required')
});

export interface ValidationError {
  file: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export class ValidationService {
  private fsService: FileSystemService;

  constructor() {
    this.fsService = new FileSystemService();
  }

  /**
   * Validate all metadata files in a source directory
   */
  async validateMetadataFiles(sourceDir: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    try {
      // Find all meta.json files
      const metadataFiles = await this.fsService.findMetadataFiles(sourceDir);
      
      if (metadataFiles.length === 0) {
        errors.push({
          file: sourceDir,
          message: 'No metadata files found in source directory'
        });
        return { isValid: false, errors };
      }

      // Validate each metadata file
      for (const metaFile of metadataFiles) {
        const fileErrors = await this.validateMetadataFile(metaFile);
        errors.push(...fileErrors);
      }

    } catch (error) {
      errors.push({
        file: sourceDir,
        message: `Failed to scan directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single metadata file
   */
  private async validateMetadataFile(filePath: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    try {
      // Read and parse the metadata file
      const content = await fs.readJSON(filePath);
      
      // Validate the main structure
      const mainValidation = metadataFileSchema.safeParse(content);
      if (!mainValidation.success) {
        for (const issue of mainValidation.error.issues) {
          errors.push({
            file: filePath,
            message: `${issue.path.join('.')}: ${issue.message}`,
            path: issue.path.join('.')
          });
        }
        return errors; // If main structure is invalid, don't validate items
      }

      // Validate individual items based on their type
      const metadata = mainValidation.data;
      for (let i = 0; i < metadata.items.length; i++) {
        const item = metadata.items[i];
        const itemErrors = this.validateItemMetadata(item, `items[${i}]`);
        
        errors.push(...itemErrors.map(error => ({
          ...error,
          file: filePath,
          path: error.path ? `items[${i}].${error.path}` : `items[${i}]`
        })));
      }

    } catch (error) {
      errors.push({
        file: filePath,
        message: `Failed to read or parse file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return errors;
  }

  /**
   * Validate metadata for a specific item based on its type
   */
  private validateItemMetadata(item: any, basePath: string = ''): ValidationError[] {
    const errors: ValidationError[] = [];
    
    try {
      let schema;
      
      switch (item.type) {
        case 'backend-script':
          schema = backendScriptMetadataSchema;
          break;
        case 'report':
          schema = reportMetadataSchema;
          break;
        case 'page':
          schema = pageMetadataSchema;
          break;
        case 'field':
          schema = fieldMetadataSchema;
          break;
        default:
          errors.push({
            file: '',
            message: `Unknown item type: ${item.type}`,
            path: `${basePath}.type`
          });
          return errors;
      }

      const validation = schema.safeParse(item.metadata);
      if (!validation.success) {
        for (const issue of validation.error.issues) {
          errors.push({
            file: '',
            message: issue.message,
            path: `${basePath}.metadata.${issue.path.join('.')}`
          });
        }
      }

    } catch (error) {
      errors.push({
        file: '',
        message: `Failed to validate item metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: basePath
      });
    }

    return errors;
  }

  /**
   * Validate a single backend script metadata object
   * This can be used for unit testing or standalone validation
   */
  validateBackendScriptMetadata(metadata: any): ValidationResult {
    const validation = backendScriptMetadataSchema.safeParse(metadata);
    
    if (validation.success) {
      return { isValid: true, errors: [] };
    }

    const errors = validation.error.issues.map(issue => ({
      file: 'inline',
      message: issue.message,
      path: issue.path.join('.')
    }));

    return { isValid: false, errors };
  }
}
