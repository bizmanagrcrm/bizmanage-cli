import { z } from 'zod';

/**
 * Schema for bizmanage.config.json - project-level configuration
 */
export const BizmanageProjectConfigSchema = z.object({
  version: z.string().describe('CLI version that created this project'),
  instance: z.object({
    url: z.string().url().describe('Target Bizmanage instance URL'),
    alias: z.string().describe('Auth alias to use for this project')
  }),
  project: z.object({
    name: z.string().describe('Project name'),
    description: z.string().optional().describe('Project description'),
    createdAt: z.string().datetime().describe('Project creation timestamp'),
    lastPull: z.string().datetime().optional().describe('Last pull timestamp'),
    lastPush: z.string().datetime().optional().describe('Last push timestamp')
  }),
  structure: z.object({
    srcDir: z.string().default('src').describe('Source directory name'),
    objects: z.string().default('objects').describe('Objects directory name'),
    backend: z.string().default('backend').describe('Backend scripts directory name'),
    reports: z.string().default('reports').describe('Reports directory name'),
    pages: z.string().default('pages').describe('Pages directory name')
  }).optional()
});

export type BizmanageProjectConfig = z.infer<typeof BizmanageProjectConfigSchema>;

/**
 * Schema for object definition.json files
 */
export const ObjectDefinitionSchema = z.object({
  name: z.string().describe('Object/table name'),
  type: z.enum(['table', 'view']).describe('Object type'),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    label: z.string().optional(),
    required: z.boolean().optional(),
    defaultValue: z.any().optional(),
    validation: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      options: z.array(z.string()).optional()
    }).optional()
  })).describe('Field definitions'),
  settings: z.object({
    displayName: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    sorting: z.object({
      field: z.string(),
      direction: z.enum(['asc', 'desc'])
    }).optional(),
    pagination: z.object({
      defaultPageSize: z.number(),
      allowedPageSizes: z.array(z.number())
    }).optional(),
    permissions: z.object({
      create: z.array(z.string()).optional(),
      read: z.array(z.string()).optional(),
      update: z.array(z.string()).optional(),
      delete: z.array(z.string()).optional()
    }).optional()
  }).optional(),
  lastModified: z.string().datetime(),
  version: z.string()
});

export type ObjectDefinition = z.infer<typeof ObjectDefinitionSchema>;

/**
 * Schema for action metadata files (*.meta.json)
 */
export const ActionMetadataSchema = z.object({
  label: z.string().describe('Display label for the action'),
  description: z.string().optional().describe('Action description'),
  type: z.enum(['javascript', 'http', 'link', 'configuration']).describe('Action type'),
  icon: z.string().optional().describe('Icon identifier'),
  permissions: z.array(z.string()).optional().describe('Required permissions/roles'),
  placement: z.object({
    context: z.enum(['row', 'bulk', 'toolbar', 'menu']).describe('Where the action appears'),
    order: z.number().optional().describe('Display order')
  }).optional(),
  conditions: z.object({
    fieldConditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'empty', 'not_empty']),
      value: z.any().optional()
    })).optional(),
    recordState: z.enum(['new', 'existing', 'any']).optional()
  }).optional(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'select']),
    label: z.string(),
    required: z.boolean().optional(),
    defaultValue: z.any().optional(),
    options: z.array(z.object({
      value: z.any(),
      label: z.string()
    })).optional()
  })).optional(),
  // For HTTP/Link actions
  httpConfig: z.object({
    url: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
    headers: z.record(z.string()).optional(),
    openInNewWindow: z.boolean().optional()
  }).optional(),
  lastModified: z.string().datetime(),
  version: z.string()
});

export type ActionMetadata = z.infer<typeof ActionMetadataSchema>;

/**
 * Schema for backend script metadata files
 */
export const BackendScriptMetadataSchema = z.object({
  name: z.string().describe('Script name'),
  description: z.string().optional().describe('Script description'),
  type: z.enum(['scheduled', 'triggered', 'shared']).describe('Script type'),
  triggers: z.array(z.object({
    type: z.enum(['cron', 'webhook', 'event']),
    config: z.any()
  })).optional(),
  dependencies: z.array(z.string()).optional().describe('Other scripts this depends on'),
  imports: z.array(z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(['shared', 'external'])
  })).optional(),
  environment: z.object({
    nodeVersion: z.string().optional(),
    timeout: z.number().optional(),
    memory: z.number().optional()
  }).optional(),
  lastModified: z.string().datetime(),
  version: z.string()
});

export type BackendScriptMetadata = z.infer<typeof BackendScriptMetadataSchema>;

/**
 * Schema for report metadata files
 */
export const ReportMetadataSchema = z.object({
  internal_name: z.string().describe('Report internal name'),
  display_name: z.string().describe('Report display name'),
  params: z.array(z.object({
    input_type: z.string(),
  }).passthrough()).optional().describe('Report parameters'),
  report_type: z.string().describe('Report type'),
  deleted_ref: z.any().nullable().optional(),
  settings: z.any().nullable().optional(),
  to_users: z.any().nullable().optional(),
  to_user_roles: z.any().nullable().optional(),
  created_by: z.number().optional(),
  created_at: z.string().optional()
});

export type ReportMetadata = z.infer<typeof ReportMetadataSchema>;

/**
 * Schema for page metadata files
 */
export const PageMetadataSchema = z.object({
  name: z.string().describe('Page name'),
  version: z.number().describe('Page version'),
  publihsed: z.boolean().optional().describe('Whether page is published (note: typo in API)'),
  data: z.any().optional().describe('Page data object'),
  access_policy: z.string().optional().describe('Access policy for the page'),
  render_type: z.string().optional().describe('How the page should be rendered'),
  url: z.string().optional().describe('Page URL path'),
  max_version: z.number().optional().describe('Maximum version number')
});

export type PageMetadata = z.infer<typeof PageMetadataSchema>;

/**
 * Schema for backend script metadata (for API scripts)
 */
export const ScriptMetadataSchema = z.object({
  name: z.string().describe('Script internal name'),
  description: z.string().nullable().optional().describe('Script description'),
  method: z.string().describe('HTTP method for the script'),
  created_at: z.union([z.string(), z.number(), z.null()]).optional().describe('Creation timestamp'),
  updated_at: z.union([z.string(), z.number(), z.null()]).optional().describe('Update timestamp'),
  created_by: z.union([z.number(), z.null()]).optional().describe('Creator user ID'),
  updated_by: z.union([z.number(), z.null()]).optional().describe('Updater user ID'),
  is_public: z.boolean().optional().describe('Whether script is publicly accessible'),
  token: z.string().nullable().optional().describe('Access token'),
  crontab: z.string().nullable().optional().describe('Cron schedule'),
  active: z.boolean().optional().describe('Whether script is active'),
  version: z.number().optional().describe('Script version'),
  timeout: z.union([z.number(), z.null()]).optional().describe('Execution timeout'),
  modules: z.any().optional().describe('Required modules')
});

export type ScriptMetadata = z.infer<typeof ScriptMetadataSchema>;

/**
 * Validation functions
 */
export const validateProjectConfig = (data: unknown): BizmanageProjectConfig => {
  return BizmanageProjectConfigSchema.parse(data);
};

export const validateObjectDefinition = (data: unknown): ObjectDefinition => {
  return ObjectDefinitionSchema.parse(data);
};

export const validateActionMetadata = (data: unknown): ActionMetadata => {
  return ActionMetadataSchema.parse(data);
};

export const validateBackendScriptMetadata = (data: unknown): BackendScriptMetadata => {
  return BackendScriptMetadataSchema.parse(data);
};

export const validateReportMetadata = (data: unknown): ReportMetadata => {
  return ReportMetadataSchema.parse(data);
};

export const validatePageMetadata = (data: unknown): PageMetadata => {
  return PageMetadataSchema.parse(data);
};

export const validateScriptMetadata = (data: unknown): ScriptMetadata => {
  return ScriptMetadataSchema.parse(data);
};
