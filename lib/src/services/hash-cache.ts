import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

interface HashCache {
  version: string;
  hashes: Record<string, string>;
}

export class HashCacheService {
  private serviceLogger = logger.child('HashCacheService');
  private cache: HashCache | null = null;
  private cachePath: string = '';
  private cacheDir: string = '';

  /**
   * Initialize the hash cache for a project
   */
  async initialize(projectPath: string): Promise<void> {
    this.cacheDir = path.join(projectPath, '.bizmanage');
    this.cachePath = path.join(this.cacheDir, 'file-hashes.json');
    
    await fs.ensureDir(this.cacheDir);
    
    if (await fs.pathExists(this.cachePath)) {
      try {
        this.cache = await fs.readJSON(this.cachePath);
        this.serviceLogger.debug('Loaded hash cache', { entries: Object.keys(this.cache?.hashes || {}).length });
      } catch (error) {
        this.serviceLogger.warn('Failed to load hash cache, creating new one');
        this.cache = { version: '1.0.0', hashes: {} };
      }
    } else {
      this.cache = { version: '1.0.0', hashes: {} };
      this.serviceLogger.debug('Initialized new hash cache');
    }
  }

  /**
   * Calculate SHA256 hash of content
   */
  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get relative path from project root for cache key
   */
  private getRelativePath(projectPath: string, filePath: string): string {
    return path.relative(projectPath, filePath).replace(/\\/g, '/');
  }

  /**
   * Check if file content has changed compared to cache
   * Returns true if file should be written (content changed or not in cache)
   */
  async shouldWriteFile(projectPath: string, filePath: string, content: string): Promise<boolean> {
    if (!this.cache) {
      await this.initialize(projectPath);
    }

    const relPath = this.getRelativePath(projectPath, filePath);
    const newHash = this.calculateHash(content);
    const cachedHash = this.cache!.hashes[relPath];

    if (cachedHash === newHash) {
      this.serviceLogger.debug('File unchanged, skipping write', { file: relPath });
      return false;
    }

    this.serviceLogger.debug('File changed or new, will write', { file: relPath });
    return true;
  }

  /**
   * Update hash for a file after writing
   */
  async updateHash(projectPath: string, filePath: string, content: string): Promise<void> {
    if (!this.cache) {
      await this.initialize(projectPath);
    }

    const relPath = this.getRelativePath(projectPath, filePath);
    const newHash = this.calculateHash(content);
    
    this.cache!.hashes[relPath] = newHash;
  }

  /**
   * Write file only if content has changed
   * Returns true if file was written, false if skipped
   */
  async writeFileIfChanged(
    projectPath: string,
    filePath: string,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<boolean> {
    if (!this.cache) {
      await this.initialize(projectPath);
    }

    if (await this.shouldWriteFile(projectPath, filePath, content)) {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content, encoding);
      await this.updateHash(projectPath, filePath, content);
      return true;
    }

    return false;
  }

  /**
   * Write JSON file only if content has changed
   * Returns true if file was written, false if skipped
   */
  async writeJSONIfChanged(
    projectPath: string,
    filePath: string,
    data: any,
    options: { spaces?: string | number } = { spaces: 2 }
  ): Promise<boolean> {
    if (!this.cache) {
      await this.initialize(projectPath);
    }

    const spaces = options.spaces ?? 2;
    const content = JSON.stringify(data, null, spaces);
    
    if (await this.shouldWriteFile(projectPath, filePath, content)) {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeJSON(filePath, data, { spaces });
      await this.updateHash(projectPath, filePath, content);
      return true;
    }

    return false;
  }

  /**
   * Save the hash cache to disk
   */
  async save(): Promise<void> {
    if (!this.cache || !this.cachePath) {
      return;
    }

    try {
      await fs.writeJSON(this.cachePath, this.cache, { spaces: 2 });
      this.serviceLogger.debug('Saved hash cache', { entries: Object.keys(this.cache.hashes).length });
    } catch (error) {
      this.serviceLogger.error('Failed to save hash cache', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Clear all cached hashes
   */
  async clear(): Promise<void> {
    this.cache = { version: '1.0.0', hashes: {} };
    await this.save();
    this.serviceLogger.info('Cleared hash cache');
  }

  /**
   * Get statistics about the cache
   */
  getStats(): { totalFiles: number; cacheHits: number } {
    return {
      totalFiles: Object.keys(this.cache?.hashes || {}).length,
      cacheHits: 0 // This would need tracking in shouldWriteFile to be accurate
    };
  }
}
