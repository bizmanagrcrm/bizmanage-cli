import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { Customization } from './api.js';

export class FileSystemService {
  
  /**
   * Write customizations to local filesystem
   * Creates organized folder structure with code files and metadata
   */
  async writeCustomizations(outputDir: string, scope: string, customizations: Customization[]): Promise<void> {
    const scopeDir = path.join(outputDir, scope);
    await fs.ensureDir(scopeDir);

    // Create metadata file for all items in this scope
    const scopeMetadata = {
      scope,
      generatedAt: new Date().toISOString(),
      itemCount: customizations.length,
      items: customizations.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        file: this.getCodeFileName(c),
        metadata: c.metadata
      }))
    };

    await fs.writeJSON(
      path.join(scopeDir, 'meta.json'),
      scopeMetadata,
      { spaces: 2 }
    );

    // Write individual code files
    for (const customization of customizations) {
      const fileName = this.getCodeFileName(customization);
      const filePath = path.join(scopeDir, fileName);
      
      await fs.writeFile(filePath, customization.code, 'utf8');
    }
  }

  /**
   * Read customizations from local filesystem
   * Reads both code files and metadata to reconstruct customizations
   */
  async readCustomizations(sourceDir: string): Promise<Customization[]> {
    const customizations: Customization[] = [];
    
    if (!await fs.pathExists(sourceDir)) {
      throw new Error(`Source directory does not exist: ${sourceDir}`);
    }

    const scopes = await fs.readdir(sourceDir, { withFileTypes: true });
    
    for (const scope of scopes) {
      if (!scope.isDirectory()) continue;
      
      const scopeDir = path.join(sourceDir, scope.name);
      const metaPath = path.join(scopeDir, 'meta.json');
      
      if (!await fs.pathExists(metaPath)) {
        console.log(chalk.yellow(`⚠️  No meta.json found in ${scope.name}, skipping...`));
        continue;
      }

      try {
        const metadata = await fs.readJSON(metaPath);
        
        for (const item of metadata.items || []) {
          const codePath = path.join(scopeDir, item.file);
          
          if (await fs.pathExists(codePath)) {
            const code = await fs.readFile(codePath, 'utf8');
            
            customizations.push({
              id: item.id,
              name: item.name,
              type: item.type,
              code,
              metadata: item.metadata,
              scope: metadata.scope
            });
          } else {
            console.log(chalk.yellow(`⚠️  Code file not found: ${item.file}`));
          }
        }
      } catch (error) {
        console.log(chalk.red(`❌ Failed to read metadata from ${scope.name}: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }

    return customizations;
  }

  /**
   * Get appropriate file extension based on customization type
   */
  private getCodeFileName(customization: Customization): string {
    const sanitizedName = customization.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    switch (customization.type) {
      case 'backend-script':
        return `${sanitizedName}.js`;
      case 'report':
        return `${sanitizedName}.sql`;
      case 'page':
        return `${sanitizedName}.html`;
      case 'field':
        return `${sanitizedName}.json`;
      default:
        return `${sanitizedName}.txt`;
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  /**
   * Check if a file or directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    return await fs.pathExists(filePath);
  }

  /**
   * Get all .meta.json files recursively from a directory
   */
  async findMetadataFiles(sourceDir: string): Promise<string[]> {
    const metaFiles: string[] = [];
    
    if (!await fs.pathExists(sourceDir)) {
      return metaFiles;
    }

    async function searchDir(dir: string): Promise<void> {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          await searchDir(fullPath);
        } else if (item.name === 'meta.json') {
          metaFiles.push(fullPath);
        }
      }
    }

    await searchDir(sourceDir);
    return metaFiles;
  }
}
