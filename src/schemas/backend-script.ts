import { z } from 'zod';

/**
 * Example Zod schema for backend script metadata validation
 * This demonstrates how to validate metadata files for backend scripts
 */

// Backend script metadata schema with comprehensive validation
export const backendScriptMetadataSchema = z.object({
  // Basic information
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters'),
  
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver format (e.g., 1.0.0)'),
  
  author: z
    .string()
    .min(1, 'Author is required')
    .email('Author must be a valid email address')
    .optional()
    .or(z.string().min(1, 'Author name is required')),
  
  tags: z
    .array(z.string().min(1, 'Tag cannot be empty'))
    .min(1, 'At least one tag is required')
    .max(10, 'Maximum 10 tags allowed'),

  // Script-specific metadata
  entryPoint: z
    .string()
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Entry point must be a valid function name')
    .optional(),
  
  dependencies: z
    .array(z.string().min(1, 'Dependency name cannot be empty'))
    .max(20, 'Maximum 20 dependencies allowed')
    .optional(),
  
  permissions: z
    .array(z.enum(['read', 'write', 'execute', 'admin']))
    .min(1, 'At least one permission is required')
    .optional(),
  
  // Scheduling configuration
  schedule: z.object({
    enabled: z.boolean(),
    cron: z
      .string()
      .regex(
        /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
        'Invalid cron expression'
      )
      .optional(),
    timezone: z
      .string()
      .min(1, 'Timezone cannot be empty')
      .optional()
  }).optional(),

  // Performance and resource limits
  timeout: z
    .number()
    .int()
    .min(1, 'Timeout must be at least 1 second')
    .max(3600, 'Timeout cannot exceed 1 hour')
    .optional(),

  memory: z
    .number()
    .int()
    .min(128, 'Memory must be at least 128 MB')
    .max(4096, 'Memory cannot exceed 4 GB')
    .optional(),

  // Environment configuration
  environment: z
    .record(z.string())
    .optional(),

  // Error handling
  retryPolicy: z.object({
    maxRetries: z
      .number()
      .int()
      .min(0, 'Max retries cannot be negative')
      .max(10, 'Max retries cannot exceed 10'),
    retryDelay: z
      .number()
      .int()
      .min(100, 'Retry delay must be at least 100ms')
      .max(60000, 'Retry delay cannot exceed 60 seconds'),
    exponentialBackoff: z.boolean().optional()
  }).optional()
});

// Type inference from the schema
export type BackendScriptMetadata = z.infer<typeof backendScriptMetadataSchema>;

// Example usage function
export function validateBackendScriptExample() {
  // Valid example
  const validMetadata = {
    description: 'A script that processes user data and generates reports',
    version: '1.2.0',
    author: 'developer@company.com',
    tags: ['data-processing', 'reports', 'automation'],
    entryPoint: 'processUserData',
    dependencies: ['lodash', 'moment'],
    permissions: ['read', 'write'],
    schedule: {
      enabled: true,
      cron: '0 2 * * *', // Daily at 2 AM
      timezone: 'UTC'
    },
    timeout: 300,
    memory: 512,
    environment: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    retryPolicy: {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true
    }
  };

  // Validate the metadata
  const result = backendScriptMetadataSchema.safeParse(validMetadata);
  
  if (result.success) {
    console.log('✅ Validation successful');
    return result.data;
  } else {
    console.log('❌ Validation failed:');
    result.error.issues.forEach(issue => {
      console.log(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    return null;
  }
}

// Invalid example to show validation errors
export function showValidationErrors() {
  const invalidMetadata = {
    description: '', // Invalid: empty string
    version: '1.2', // Invalid: not semver
    author: '', // Invalid: empty
    tags: [], // Invalid: empty array
    entryPoint: '123invalid', // Invalid: starts with number
    permissions: ['invalid-permission'], // Invalid: not in enum
    schedule: {
      enabled: true,
      cron: 'invalid-cron', // Invalid: bad cron format
    },
    timeout: -1, // Invalid: negative
    memory: 50, // Invalid: too small
    retryPolicy: {
      maxRetries: 20, // Invalid: too high
      retryDelay: 50, // Invalid: too small
    }
  };

  const result = backendScriptMetadataSchema.safeParse(invalidMetadata);
  
  if (!result.success) {
    console.log('Expected validation errors:');
    result.error.issues.forEach(issue => {
      console.log(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
  }
}

export default backendScriptMetadataSchema;
