import Conf from 'conf';
import chalk from 'chalk';
import { homedir } from 'os';
import path from 'path';
import fs from 'fs-extra';

export interface AuthConfig {
  instanceUrl: string;
  apiKey: string;
}

export class AuthService {
  private config: Conf<Record<string, AuthConfig>>;
  private configDir: string;

  constructor() {
    this.configDir = path.join(homedir(), '.bizmanage');
    
    // Ensure config directory exists
    fs.ensureDirSync(this.configDir);
    
    this.config = new Conf({
      projectName: 'bizmanage-cli',
      configName: 'config',
      cwd: this.configDir,
      defaults: {}
    });
  }

  /**
   * Save authentication configuration for a specific alias
   */
  async saveConfig(alias: string, config: AuthConfig): Promise<void> {
    this.config.set(alias, config);
  }

  /**
   * Get authentication configuration for a specific alias
   */
  async getConfig(alias: string): Promise<AuthConfig | null> {
    const config = this.config.get(alias);
    return config || null;
  }

  /**
   * Remove authentication configuration for a specific alias
   */
  async removeConfig(alias: string): Promise<boolean> {
    const exists = this.config.has(alias);
    if (exists) {
      this.config.delete(alias);
    }
    return exists;
  }

  /**
   * Clear all stored configurations
   */
  async clearAllConfigs(): Promise<void> {
    this.config.clear();
  }

  /**
   * List all configured aliases
   */
  listAliases(): string[] {
    return Object.keys(this.config.store);
  }

  /**
   * Get the path to the configuration file
   */
  getConfigPath(): string {
    return this.config.path;
  }

  /**
   * Check if an alias exists
   */
  hasAlias(alias: string): boolean {
    return this.config.has(alias);
  }
}
