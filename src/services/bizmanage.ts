import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import chalk from 'chalk';
import { AuthConfig } from './auth.js';
import { logger } from '../utils/logger.js';

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
  private serviceLogger = logger.child('BizmanageService');

  constructor(config: AuthConfig) {
    this.config = config;
    this.serviceLogger.debug('Initializing BizmanageService', {
      instanceUrl: config.instanceUrl,
      hasApiKey: !!config.apiKey
    });
    
    this.client = axios.create({
      baseURL: config.instanceUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        // Add timestamp for response time calculation
        (config as any).requestStartTime = Date.now();
        
        this.serviceLogger.logRequest(
          config.method?.toUpperCase() || 'UNKNOWN',
          `${config.baseURL}${config.url}`,
          config.headers,
          config.data
        );
        return config;
      },
      (error) => {
        this.serviceLogger.error('Request failed', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        const startTime = (response.config as any).requestStartTime;
        const responseTime = startTime ? Date.now() - startTime : undefined;
        
        this.serviceLogger.logResponse(
          response.status,
          response.config.url || '',
          response.data,
          responseTime
        );
        return response;
      },
      (error) => {
        if (error.response) {
          const startTime = (error.config as any)?.requestStartTime;
          const responseTime = startTime ? Date.now() - startTime : undefined;
          
          this.serviceLogger.logResponse(
            error.response.status,
            error.config?.url || '',
            error.response.data,
            responseTime
          );
        } else {
          this.serviceLogger.error('Network error', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test authentication by pinging the Bizmanage API
   * Sends GET /restapi/ping - should return 200 if authenticated, 403 if not
   */
  async ping(): Promise<BizmanagePingResponse> {
    const startTime = Date.now();
    this.serviceLogger.debug('Pinging Bizmanage API for authentication test');
    
    try {
      const response: AxiosResponse = await this.client.get('/restapi/ping');
      const responseTime = Date.now() - startTime;
      
      this.serviceLogger.debug(`Ping completed in ${responseTime}ms`, {
        status: response.status,
        authenticated: response.status === 200
      });
      
      return {
        authenticated: response.status === 200,
        status: response.status,
        message: response.status === 200 
          ? 'Authentication successful' 
          : `Unexpected response: ${response.status}`,
        timestamp: new Date()
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
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
      
      this.serviceLogger.warn(`Ping failed after ${responseTime}ms`, {
        status,
        message,
        error: error.message
      });
      
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
