import axios, { AxiosInstance, AxiosResponse } from 'axios';
import chalk from 'chalk';
import { AuthConfig } from './auth.js';

export interface BizmanagePingResponse {
  authenticated: boolean;
  status: number;
  message: string;
  timestamp: Date;
}

export interface BizmanageConnectionTest {
  success: boolean;
  status: number;
  message: string;
  responseTime: number;
}

export class BizmanageService {
  private client: AxiosInstance;
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.instanceUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  /**
   * Test authentication by pinging the Bizmanage API
   * Sends GET /restapi/ping - should return 200 if authenticated, 403 if not
   */
  async ping(): Promise<BizmanagePingResponse> {
    const startTime = Date.now();
    
    try {
      const response: AxiosResponse = await this.client.get('/restapi/ping');
      
      return {
        authenticated: response.status === 200,
        status: response.status,
        message: response.status === 200 
          ? 'Authentication successful' 
          : `Unexpected response: ${response.status}`,
        timestamp: new Date()
      };
    } catch (error: any) {
      const status = error.response?.status || 0;
      let message: string;
      
      switch (status) {
        case 403:
          message = 'Authentication failed - invalid or expired credentials';
          break;
        case 401:
          message = 'Unauthorized - missing or invalid API key';
          break;
        case 404:
          message = 'Endpoint not found - check instance URL';
          break;
        case 0:
          message = `Network error: ${error.message}`;
          break;
        default:
          message = `HTTP ${status}: ${error.message}`;
      }
      
      return {
        authenticated: false,
        status,
        message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Test the connection to Bizmanage API with detailed diagnostics
   */
  async testConnection(): Promise<BizmanageConnectionTest> {
    const startTime = Date.now();
    
    try {
      const pingResult = await this.ping();
      const responseTime = Date.now() - startTime;
      
      return {
        success: pingResult.authenticated,
        status: pingResult.status,
        message: pingResult.message,
        responseTime
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        status: 0,
        message: `Connection test failed: ${error.message}`,
        responseTime
      };
    }
  }

  /**
   * Get the current instance URL
   */
  getInstanceUrl(): string {
    return this.config.instanceUrl;
  }

  /**
   * Get API key info (masked for security)
   */
  getApiKeyInfo(): { hasKey: boolean; preview: string } {
    const apiKey = this.config.apiKey;
    
    if (!apiKey) {
      return { hasKey: false, preview: '' };
    }
    
    // Show first 4 and last 4 characters with asterisks in between
    const preview = apiKey.length > 8 
      ? `${apiKey.substring(0, 4)}***${apiKey.substring(apiKey.length - 4)}`
      : '****';
    
    return { hasKey: true, preview };
  }

  /**
   * Validate the configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.config.instanceUrl) {
      errors.push('Instance URL is required');
    } else if (!this.config.instanceUrl.startsWith('http')) {
      errors.push('Instance URL must start with http:// or https://');
    }
    
    if (!this.config.apiKey) {
      errors.push('API key is required');
    } else if (this.config.apiKey.length < 10) {
      errors.push('API key appears to be too short');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a formatted status report
   */
  async getStatusReport(): Promise<string> {
    const validation = this.validateConfig();
    
    if (!validation.valid) {
      return chalk.red(`Configuration errors:\n${validation.errors.map(e => `- ${e}`).join('\n')}`);
    }
    
    const connectionTest = await this.testConnection();
    const keyInfo = this.getApiKeyInfo();
    
    let report = chalk.bold('Bizmanage API Status Report\n');
    report += chalk.gray('='.repeat(40)) + '\n';
    report += `Instance URL: ${chalk.cyan(this.getInstanceUrl())}\n`;
    report += `API Key: ${keyInfo.hasKey ? chalk.green(keyInfo.preview) : chalk.red('Not configured')}\n`;
    report += `Status: ${connectionTest.success ? chalk.green('✓ Connected') : chalk.red('✗ Failed')}\n`;
    report += `Response Time: ${chalk.yellow(`${connectionTest.responseTime}ms`)}\n`;
    report += `Message: ${connectionTest.success ? chalk.green(connectionTest.message) : chalk.red(connectionTest.message)}\n`;
    
    if (connectionTest.status) {
      report += `HTTP Status: ${connectionTest.success ? chalk.green(connectionTest.status) : chalk.red(connectionTest.status)}\n`;
    }
    
    return report;
  }
}
