import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import { AuthConfig } from './auth.js';
import { 
  ObjectDefinition,
  ActionMetadata,
  BackendScriptMetadata,
  ReportMetadata,
  PageMetadata,
  ScriptMetadata
} from '../schemas/project-structure.js';
import { logger } from '../utils/logger.js';

export interface Customization {
  name: string;
  type: 'report' | 'page' | 'backend-script' | 'field';
  code: string;
  metadata: Record<string, any>;
  scope: string;
}

// New interfaces for the project structure
export interface BizmanageObject {
  name: string;
  definition: any; // Can be either ObjectDefinition or raw API format
  actions: BizmanageAction[];
}

export interface BizmanageAction {
  name: string;
  code?: string;
  metadata: ActionMetadata;
}

export interface BizmanageBackendScript {
  name: string;
  code: string;
  metadata: BackendScriptMetadata;
}

export interface BizmanageReport {
  name: string;
  sql: string;
  metadata: ReportMetadata;
}

export interface BizmanagePage {
  name: string;
  html: string;
  metadata: PageMetadata;
}

export interface BizmanageScript {
  name: string;
  code: string;
  metadata: ScriptMetadata;
}

// Actual API response interfaces
export interface BizmanageField {
  internal_name?: string;
  name: string;
  label: string;
  type: string;
  required?: boolean;
  default_value?: any;
  options?: string[];
  validation?: any;
  display_order?: number;
  created_at?: number;
  updated_at?: number;
  [key: string]: any; // Allow for additional fields
}

export interface BizmanageTableResponse {
  system: boolean;
  display_name: string;
  internal_name: string;
  search_enabled: boolean;
  id?: number;
  created_by?: number;
  created_at?: number;
  icon?: string;
  show_on_menu?: boolean;
  related_to?: any;
  data?: any;
  token?: string;
  orderBy?: {
    clm: string;
    order: 'asc' | 'desc';
  };
  filters?: any[];
  desc?: string;
  bcg_color?: string;
  grids?: any;
  available_filters?: Array<{
    type: string;
    text: string;
    name: string;
    hide?: boolean;
    is_custom?: boolean;
    field_internal_name?: string;
    field?: string;
    otherTable?: string;
    otherColumnDisplay?: string;
  }>;
  has_comments?: boolean;
  table_name?: string;
  set_filters?: any;
  deleted_ref?: any;
  availableEventsForWH?: Array<{
    event_name: string;
    display_name: string;
  }>;
  read_only?: boolean;
}

/**
 * API response interface for script from /restapi/be-scripts/list
 */
export interface BizmanageScriptResponse {
  id: number;
  name: string;
  description: string | null;
  method: string;
  script: string;
  created_at: number | string | null;
  updated_at: number | string | null;
  created_by: number | null;
  updated_by: number | null;
  is_public: boolean;
  token: string | null;
  last_run: number | null;
  last_run_status: string | null;
  last_run_output: string | null;
  last_run_duration: number | null;
  last_run_by: number | null;
  last_run_at: number | null;
  last_run_error: string | null;
  crontab: string | null;
  active: boolean;
  version: number;
  timeout: number | null;
  modules: any;
}

/**
 * API response interface for page from /restapi/admin/custom-pages?latest_only=true
 */
export interface BizmanagePageResponse {
  id: number;
  content: string;
  version: number;
  publihsed: boolean;
  name: string;
  data?: any;
  access_policy?: string;
  render_type?: string;
  url?: string;
  max_version?: number;
}

/**
 * API response interface for report from /restapi/c-reports/list-with-sql
 */
export interface BizmanageReportResponse {
  id: number;
  internal_name: string;
  display_name: string;
  params?: Array<{
    input_type: string;
    [key: string]: any;
  }>;
  report_type: string;
  deleted_ref: any;
  settings: any;
  to_users: any;
  to_user_roles: any;
  created_by: number;
  created_at: string;
  query?: string; // SQL query for the report
}

/**
 * API response interface for action from /restapi/customization/actions/:table_name
 */
export interface BizmanageActionResponse {
  id: number;
  table_name: string;
  is_hidden?: {
    dash?: boolean;
    grid?: boolean;
  };
  title: string;
  action_name: string;
  deleted_ref: any;
  color: string | null;
  icon: string | null;
  type: string; // 'custom-script', 'url', etc.
  group: string | null;
  value: any;
  custom_script?: string; // Only present if type === 'custom-script'
  action_type: string; // 'quick_action', 'menu', etc.
  order: number | null;
  condition: any;
  email_field: string | null;
  link?: string; // For url type actions
  multiRows?: boolean;
  is_system?: boolean;
}

export class ApiService {
  private client: AxiosInstance;
  private config: AuthConfig;
  private serviceLogger = logger.child('ApiService');
  private delayMs: number;
  private lastRequestTime: number = 0;

  constructor(config: AuthConfig, delayMs: number = 0) {
    this.config = config;
    this.delayMs = delayMs;
    this.client = axios.create({
      baseURL: config.instanceUrl,
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Apply rate limiting delay between API requests
   */
  private async applyDelay(): Promise<void> {
    if (this.delayMs > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (this.lastRequestTime > 0 && timeSinceLastRequest < this.delayMs) {
        const waitTime = this.delayMs - timeSinceLastRequest;
        this.serviceLogger.debug(`Waiting ${waitTime}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      this.lastRequestTime = Date.now();
    }
  }

  /**
   * Fetch tables/views from Bizmanage API
   */
  async fetchTables(): Promise<BizmanageTableResponse[]> {
    try {
      await this.applyDelay();
      this.serviceLogger.debug('Fetching tables from Bizmanage API');
      const response = await this.client.get('/restapi/customization/tables?custom_fields=true');
      this.serviceLogger.debug(`Fetched ${response.data.length} tables`);
      return response.data;
    } catch (error: any) {
      this.serviceLogger.error(`Failed to fetch tables: ${error.response?.data?.message || error.message}`);
      throw new Error(`Failed to fetch tables: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetch full table definition by internal name
   * Endpoint: GET /restapi/customization/tables?internal_name=[table name]
   */
  async fetchTableDefinition(tableName: string): Promise<any> {
    try {
      await this.applyDelay();
      this.serviceLogger.debug(`Fetching table definition for: ${tableName}`);
      const response = await this.client.get(`/restapi/customization/tables?internal_name=${tableName}`);
      
      // Response should be an array with one item, or a single object
      const tableData = Array.isArray(response.data) ? response.data[0] : response.data;
      
      if (!tableData) {
        throw new Error(`No table definition found for ${tableName}`);
      }
      
      this.serviceLogger.debug(`Fetched definition for ${tableName}`);
      
      // Remove id and meta fields like created_by, updated_by, created_at, updated_at
      const { 
        id, 
        created_by, 
        updated_by, 
        created_at, 
        updated_at,
        ...cleanedDefinition 
      } = tableData;
      
      return cleanedDefinition;
    } catch (error: any) {
      this.serviceLogger.error(`Failed to fetch table definition for ${tableName}: ${error.response?.data?.message || error.message}`);
      throw new Error(`Failed to fetch table definition for ${tableName}: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetch fields for a specific table
   */
  async fetchFields(tableName: string): Promise<BizmanageField[]> {
    try {
      await this.applyDelay();
      this.serviceLogger.debug(`Fetching fields for table: ${tableName}`);
      const response = await this.client.get(`/restapi/customization/fields/${tableName}`);
      this.serviceLogger.debug(`Fetched ${response.data.length} fields for ${tableName}`);
      
      // Remove id from each field response
      const fields = response.data.map((field: any) => {
        const { id, ...fieldWithoutId } = field;
        return fieldWithoutId;
      });
      
      return fields;
    } catch (error: any) {
      this.serviceLogger.error(`Failed to fetch fields for ${tableName}: ${error.response?.data?.message || error.message}`);
      throw new Error(`Failed to fetch fields for ${tableName}: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetch actions for a specific table
   * Endpoint: GET /restapi/customization/actions/:table_name
   * Response format: { display_name: string, menus: BizmanageActionResponse[] }
   */
  async fetchActions(tableName: string): Promise<BizmanageAction[]> {
    try {
      await this.applyDelay();
      this.serviceLogger.debug(`Fetching actions for table: ${tableName}`);
      const response = await this.client.get(`/restapi/customization/actions/${tableName}`);
      
      // Response is an object with { display_name, menus } where menus contains the actions
      const responseData = response.data;
      
      if (!responseData || typeof responseData !== 'object') {
        this.serviceLogger.warn(`Invalid response format for ${tableName}`);
        return [];
      }
      
      const menus = responseData.menus;
      
      if (!Array.isArray(menus)) {
        this.serviceLogger.warn(`No menus array found for ${tableName}`);
        return [];
      }
      
      this.serviceLogger.debug(`Fetched ${menus.length} actions for ${tableName}`);
      
      // Transform API response to our internal format
      const actions: BizmanageAction[] = menus.map((apiAction: BizmanageActionResponse) => {
        // Extract metadata (excluding id and custom_script)
        const { id, custom_script, ...metadata } = apiAction;
        
        const action: BizmanageAction = {
          name: apiAction.action_name,
          metadata: metadata as ActionMetadata
        };
        
        // Only include code if type is 'custom-script' and custom_script exists
        if (apiAction.type === 'custom-script' && apiAction.custom_script) {
          action.code = apiAction.custom_script;
        }
        
        return action;
      });
      
      return actions;
    } catch (error: any) {
      this.serviceLogger.error(`Failed to fetch actions for ${tableName}: ${error.response?.data?.message || error.message}`);
      throw new Error(`Failed to fetch actions for ${tableName}: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Convert Bizmanage table response to our object format
   * Note: This method is deprecated. Use fetchTableDefinition() instead for pull operations.
   * @deprecated
   */
  convertTableToObject(table: BizmanageTableResponse): BizmanageObject {
    // Remove meta fields (only id and created_by are in BizmanageTableResponse)
    const { id, created_by, created_at, ...definition } = table;
    
    return {
      name: table.internal_name,
      definition,
      actions: []
    };
  }

  /**
   * Fetch objects (tables/views) with their definitions and actions
   * @deprecated Use fetchTableDefinition() for individual tables instead
   */
  async fetchObjects(): Promise<BizmanageObject[]> {
    try {
      const tables = await this.fetchTables();
      
      // Convert tables to our object format
      const objects = tables.map(table => this.convertTableToObject(table));
      
      // Filter out tables that don't have meaningful data
      return objects.filter(obj => 
        obj.definition?.display_name && 
        obj.name // Ensure we have basic required fields
      );
      
    } catch (error: any) {
      throw new Error(`Failed to fetch objects: ${error.message}`);
    }
  }

  /**
   * Fetch custom reports with SQL
   * Endpoint: GET /restapi/c-reports/list-with-sql
   */
  async fetchReports(): Promise<BizmanageReport[]> {
    await this.applyDelay();
    
    try {
      const response = await this.client.get<BizmanageReportResponse[]>('/restapi/c-reports/list-with-sql');
      
      // Transform API response to our internal format
      const reports: BizmanageReport[] = response.data
        .filter(apiReport => {
          // Skip reports without internal_name
          if (!apiReport.internal_name) {
            this.serviceLogger.warn('Skipping report without internal_name', { id: apiReport.id, display_name: apiReport.display_name });
            return false;
          }
          return true;
        })
        .map(apiReport => {
          // Extract metadata (excluding id and sql)
          const metadata: ReportMetadata = {
            internal_name: apiReport.internal_name,
            display_name: apiReport.display_name,
            params: apiReport.params,
            report_type: apiReport.report_type,
            deleted_ref: apiReport.deleted_ref,
            settings: apiReport.settings,
            to_users: apiReport.to_users,
            to_user_roles: apiReport.to_user_roles,
            created_by: apiReport.created_by,
            created_at: apiReport.created_at
          };

          return {
            name: apiReport.internal_name, // Use internal_name as the filename
            sql: apiReport.query || '', // SQL query from 'query' field
            metadata
          };
        });

      this.serviceLogger.info(`Fetched ${reports.length} reports from API`);
      return reports;
    } catch (error) {
      this.serviceLogger.error('Failed to fetch reports', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Fetch custom pages from the platform
   * Endpoint: GET /restapi/admin/custom-pages?latest_only=true
   */
  async fetchPages(): Promise<BizmanagePage[]> {
    await this.applyDelay();
    
    try {
      const response = await this.client.get<BizmanagePageResponse[]>('/restapi/admin/custom-pages?latest_only=true');
      
      // Transform API response to our internal format
      const pages: BizmanagePage[] = response.data
        .filter(apiPage => {
          // Skip pages without url (used as filename)
          if (!apiPage.url) {
            this.serviceLogger.warn('Skipping page without url', { id: apiPage.id, name: apiPage.name });
            return false;
          }
          return true;
        })
        .map(apiPage => {
          // Extract metadata (excluding id and content)
          const metadata: PageMetadata = {
            name: apiPage.name,
            version: apiPage.version,
            publihsed: apiPage.publihsed,
            data: apiPage.data,
            access_policy: apiPage.access_policy,
            render_type: apiPage.render_type,
            url: apiPage.url,
            max_version: apiPage.max_version
          };

          return {
            name: apiPage.url!, // Use url as the filename
            html: apiPage.content || '',
            metadata
          };
        });

      this.serviceLogger.info(`Fetched ${pages.length} pages from API`);
      return pages;
    } catch (error) {
      this.serviceLogger.error('Failed to fetch pages', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Fetch backend scripts from the platform
   * Endpoint: GET /restapi/be-scripts/list
   */
  async fetchScripts(): Promise<BizmanageScript[]> {
    await this.applyDelay();
    
    try {
      const response = await this.client.get<BizmanageScriptResponse[]>('/restapi/be-scripts/list');
      
      // Transform API response to our internal format
      const scripts: BizmanageScript[] = response.data.map(apiScript => {
        // Extract metadata (excluding id, script content, and last_run* fields)
        const metadata: ScriptMetadata = {
          name: apiScript.name,
          description: apiScript.description,
          method: apiScript.method,
          created_at: apiScript.created_at,
          updated_at: apiScript.updated_at,
          created_by: apiScript.created_by,
          updated_by: apiScript.updated_by,
          is_public: apiScript.is_public,
          token: apiScript.token,
          crontab: apiScript.crontab,
          active: apiScript.active,
          version: apiScript.version,
          timeout: apiScript.timeout,
          modules: apiScript.modules
        };

        return {
          name: apiScript.name,
          code: apiScript.script || '',
          metadata
        };
      });

      this.serviceLogger.info(`Fetched ${scripts.length} scripts from API`);
      return scripts;
    } catch (error) {
      this.serviceLogger.error('Failed to fetch scripts', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
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
      await this.applyDelay();
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
      await this.applyDelay();
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

  /**
   * Push object/table definition to the platform
   * POST /restapi/customization/view
   */
  async pushObjectDefinition(definition: any): Promise<any> {
    try {
      await this.applyDelay();
      
      this.serviceLogger.debug('Pushing object definition', { 
        internal_name: definition.internal_name,
        display_name: definition.display_name,
        payload: JSON.stringify(definition, null, 2)
      });

      const response = await this.client.post('/restapi/customization/view-by-internal-name', definition);
      
      this.serviceLogger.info('Successfully pushed object definition', {
        internal_name: definition.internal_name,
        status: response.status
      });

      return response.data;
    } catch (error: any) {
      this.serviceLogger.error('Failed to push object definition', {
        internal_name: definition.internal_name,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        message: error.response?.data?.message || error.message
      });
      
      if (error.response) {
        const errorMsg = error.response.data?.message 
          || error.response.data?.error
          || JSON.stringify(error.response.data)
          || error.response.statusText;
        throw new Error(`Failed to push object definition: ${errorMsg}`);
      }
      throw error;
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
