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
 * Schema for object definition.json files (raw API format)
 * This matches the format returned by GET /restapi/customization/tables?internal_name=<name>
 * with id and meta fields (created_by, updated_by, created_at, updated_at) removed
 */
export const ObjectDefinitionSchema = z.object({
  internal_name: z.string().describe('Internal table/object name'),
  display_name: z.string().describe('Display name for the table'),
  system: z.boolean().optional().describe('Whether this is a system table'),
  search_enabled: z.boolean().optional(),
  icon: z.string().nullable().optional(),
  show_on_menu: z.boolean().nullable().optional(),
  related_to: z.any().nullable().optional(),
  data: z.any().nullable().optional(),
  token: z.string().nullable().optional(),
  orderBy: z.object({
    clm: z.string(),
    order: z.enum(['asc', 'desc'])
  }).nullable().optional(),
  filters: z.any().nullable().optional(),
  desc: z.string().nullable().optional(),
  bcg_color: z.string().nullable().optional(),
  grids: z.any().nullable().optional(),
  available_filters: z.array(z.object({
    type: z.string(),
    text: z.string(),
    name: z.string(),
    hide: z.boolean().optional(),
    is_custom: z.boolean().optional(),
    field_internal_name: z.string().optional(),
    field: z.string().optional(),
    otherTable: z.string().optional(),
    otherColumnDisplay: z.string().optional()
  })).nullable().optional(),
  has_comments: z.boolean().nullable().optional(),
  table_name: z.string().nullable().optional(),
  set_filters: z.any().nullable().optional(),
  deleted_ref: z.any().nullable().optional(),
  availableEventsForWH: z.array(z.object({
    event_name: z.string(),
    display_name: z.string()
  })).optional(),
  read_only: z.boolean().optional()
}).passthrough();

export type ObjectDefinition = z.infer<typeof ObjectDefinitionSchema>;

/**
 * Schema for action metadata files (*.json)
 */
export const ActionMetadataSchema = z.object({
  table_name: z.string().optional(),
  is_hidden: z.object({
    dash: z.boolean().optional(),
    grid: z.boolean().optional()
  }).optional(),
  title: z.string().describe('Display title for the action'),
  action_name: z.string().describe('Internal action name'),
  deleted_ref: z.any().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  type: z.string().describe('Action type: custom-script, url, etc.'),
  group: z.string().nullable().optional(),
  value: z.any().optional(),
  action_type: z.string().nullable().optional().describe('Action type: quick_action, menu, etc.'),
  order: z.number().nullable().optional(),
  condition: z.any().nullable().optional(),
  email_field: z.string().nullable().optional(),
  link: z.string().optional(), // For url type actions
  multiRows: z.boolean().optional(),
  is_system: z.boolean().optional()
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
