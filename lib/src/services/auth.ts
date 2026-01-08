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
  private projectConfig: Conf<Record<string, AuthConfig>> | null = null;
  private projectConfigDir: string | null = null;
  private useProjectConfig: boolean = false;

  constructor(projectPath?: string) {
    // Global config in home directory
    this.configDir = path.join(homedir(), '.bizmanage');
    
    // Ensure config directory exists
    fs.ensureDirSync(this.configDir);
    
    this.config = new Conf({
      projectName: 'bizmanage-cli',
      configName: 'config',
      cwd: this.configDir,
      defaults: {}
    });

    // If project path provided, set up project-local config
    if (projectPath) {
      this.projectConfigDir = path.join(projectPath, '.bizmanage');
      fs.ensureDirSync(this.projectConfigDir);
      
      this.projectConfig = new Conf({
        projectName: 'bizmanage-cli',
        configName: 'auth',
        cwd: this.projectConfigDir,
        defaults: {}
      });
      
      this.useProjectConfig = true;
    }
  }

  /**
   * Save authentication configuration for a specific alias
   * Saves to project-local config if project path was provided, otherwise to global config
   */
  async saveConfig(alias: string, config: AuthConfig): Promise<void> {
    if (this.useProjectConfig && this.projectConfig) {
      this.projectConfig.set(alias, config);
    } else {
      this.config.set(alias, config);
    }
  }

  /**
   * Get authentication configuration for a specific alias
   * Checks project-local config first, then falls back to global config
   */
  async getConfig(alias: string): Promise<AuthConfig | null> {
    // Check project-local config first
    if (this.projectConfig) {
      const projectConf = this.projectConfig.get(alias);
      if (projectConf) {
        return projectConf;
      }
    }
    
    // Fall back to global config
    const config = this.config.get(alias);
    return config || null;
  }

  /**
   * Remove authentication configuration for a specific alias
   * Removes from project-local config if available, otherwise from global config
   */
  async removeConfig(alias: string): Promise<boolean> {
    let removed = false;
    
    if (this.useProjectConfig && this.projectConfig) {
      const exists = this.projectConfig.has(alias);
      if (exists) {
        this.projectConfig.delete(alias);
        removed = true;
      }
    } else {
      const exists = this.config.has(alias);
      if (exists) {
        this.config.delete(alias);
        removed = true;
      }
    }
    
    return removed;
  }

  /**
   * Clear all stored configurations
   */
  async clearAllConfigs(): Promise<void> {
    this.config.clear();
  }

  /**
   * List all configured aliases (from both project-local and global configs)
   */
  listAliases(): string[] {
    const globalAliases = Object.keys(this.config.store);
    const projectAliases = this.projectConfig ? Object.keys(this.projectConfig.store) : [];
    
    // Combine and deduplicate
    const allAliases = [...new Set([...projectAliases, ...globalAliases])];
    return allAliases;
  }

  /**
   * Get the path to the configuration file
   * Returns project-local path if available, otherwise global path
   */
  getConfigPath(): string {
    if (this.useProjectConfig && this.projectConfig) {
      return this.projectConfig.path;
    }
    return this.config.path;
  }

  /**
   * Check if an alias exists (in either project-local or global config)
   */
  hasAlias(alias: string): boolean {
    if (this.projectConfig && this.projectConfig.has(alias)) {
      return true;
    }
    return this.config.has(alias);
  }
}
