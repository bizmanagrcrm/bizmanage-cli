import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import { AuthConfig } from './auth.js';

export interface Customization {
  id: string;
  name: string;
  type: 'report' | 'page' | 'backend-script' | 'field';
  code: string;
  metadata: Record<string, any>;
  scope: string;
}

export class ApiService {
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
      timeout: 30000
    });
  }

  /**
   * Fetch customizations for a specific scope from the API
   * This is a mock implementation - replace with actual API calls
   */
  async fetchCustomizations(scope: string): Promise<Customization[]> {
    // Mock API call with setTimeout to simulate network delay
    return new Promise((resolve) => {
      setTimeout(() => {
        // In real implementation:
        // const response = await this.client.get(`/api/customizations/${scope}`);
        // return response.data;

        // Mock data for demonstration
        const mockCustomizations: Customization[] = [
          {
            id: `${scope}-1`,
            name: `Sample ${scope} 1`,
            type: scope as any,
            code: getSampleCode(scope),
            metadata: {
              description: `Sample ${scope} customization`,
              version: '1.0.0',
              author: 'developer',
              tags: [scope, 'sample']
            },
            scope
          },
          {
            id: `${scope}-2`,
            name: `Sample ${scope} 2`,
            type: scope as any,
            code: getSampleCode(scope),
            metadata: {
              description: `Another ${scope} customization`,
              version: '1.1.0',
              author: 'developer',
              tags: [scope, 'sample']
            },
            scope
          }
        ];

        resolve(mockCustomizations);
      }, Math.random() * 1000 + 500); // Random delay between 500-1500ms
    });
  }

  /**
   * Deploy customizations to the platform
   * This is a mock implementation - replace with actual API calls
   */
  async deployCustomizations(customizations: Customization[]): Promise<void> {
    // Mock API call with setTimeout to simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // In real implementation:
        // const response = await this.client.post('/api/customizations/deploy', {
        //   customizations
        // });
        // 
        // if (response.status !== 200) {
        //   throw new Error(`Deployment failed: ${response.statusText}`);
        // }

        // Mock success (90% chance) or failure (10% chance) for demonstration
        if (Math.random() > 0.1) {
          console.log(chalk.dim(`Mock: Deployed ${customizations.length} customizations to ${this.config.instanceUrl}`));
          resolve();
        } else {
          reject(new Error('Mock deployment failure - network timeout'));
        }
      }, Math.random() * 2000 + 1000); // Random delay between 1000-3000ms
    });
  }

  /**
   * Test API connection and authentication using the ping endpoint
   */
  async testConnection(): Promise<{ success: boolean; status?: number; message?: string }> {
    try {
      const response = await this.client.get('/restapi/ping');
      
      if (response.status === 200) {
        return { 
          success: true, 
          status: 200, 
          message: 'Authentication successful' 
        };
      } else {
        return { 
          success: false, 
          status: response.status, 
          message: `Unexpected response status: ${response.status}` 
        };
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        return { 
          success: false, 
          status: 403, 
          message: 'Authentication failed - invalid credentials' 
        };
      }
      
      return { 
        success: false, 
        status: error.response?.status || 0, 
        message: error.message || 'Connection failed' 
      };
    }
  }

  /**
   * Test authentication by pinging the Bizmanage API
   */
  async ping(): Promise<{ authenticated: boolean; status: number; message: string }> {
    try {
      const response = await this.client.get('/restapi/ping');
      
      return {
        authenticated: response.status === 200,
        status: response.status,
        message: response.status === 200 ? 'Authenticated' : 'Authentication failed'
      };
    } catch (error: any) {
      const status = error.response?.status || 0;
      
      return {
        authenticated: false,
        status,
        message: status === 403 
          ? 'Not authenticated - invalid or missing credentials'
          : `Connection error: ${error.message}`
      };
    }
  }
}

/**
 * Generate sample code based on scope type
 */
function getSampleCode(scope: string): string {
  switch (scope) {
    case 'backend-scripts':
      return `// Backend Script for ${scope}
export function processData(input) {
  console.log('Processing data:', input);
  return input.map(item => ({
    ...item,
    processed: true,
    timestamp: new Date().toISOString()
  }));
}`;

    case 'reports':
      return `SELECT 
  id,
  name,
  created_date,
  status
FROM custom_table 
WHERE status = 'active'
ORDER BY created_date DESC`;

    case 'pages':
      return `<div class="custom-page">
  <h1>Custom Page</h1>
  <p>This is a custom page component.</p>
  <button onclick="handleClick()">Click Me</button>
</div>

<script>
function handleClick() {
  alert('Custom page button clicked!');
}
</script>`;

    case 'fields':
      return `{
  "type": "text",
  "label": "Custom Field",
  "required": true,
  "validation": {
    "minLength": 3,
    "maxLength": 100
  }
}`;

    default:
      return `// Sample code for ${scope}
console.log('Hello from ${scope}');`;
  }
}
