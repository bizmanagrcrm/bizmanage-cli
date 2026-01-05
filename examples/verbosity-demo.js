#!/usr/bin/env node

/**
 * Example demonstrating verbosity levels in bizmanage-cli
 * 
 * This example shows how different verbosity levels affect logging output.
 * You can run this script to see how the CLI behaves at different log levels.
 */

import { logger, LogLevel, setLogLevel } from '../src/utils/logger.js';

console.log('=== Bizmanage CLI Verbosity Level Demo ===\n');

const logLevels = [
  { level: LogLevel.ERROR, name: 'ERROR (--silent)', description: 'Only errors' },
  { level: LogLevel.WARN, name: 'WARN (default)', description: 'Errors and warnings' },
  { level: LogLevel.INFO, name: 'INFO (-v, --verbose)', description: 'Errors, warnings, and info' },
  { level: LogLevel.DEBUG, name: 'DEBUG (-vv, --very-verbose, --debug)', description: 'Everything except trace' },
  { level: LogLevel.TRACE, name: 'TRACE (-vvv, --extra-verbose)', description: 'Everything including trace' }
];

// Demonstrate each log level
for (const { level, name, description } of logLevels) {
  console.log(`\n--- ${name} ---`);
  console.log(`Description: ${description}\n`);
  
  setLogLevel(level);
  
  // Test different log types
  logger.error('This is an error message');
  logger.warn('This is a warning message');
  logger.info('This is an info message');
  logger.success('This is a success message');
  logger.debug('This is a debug message', { key: 'value' });
  logger.trace('This is a trace message');
  
  // Simulate API call logging
  logger.logRequest('POST', '/api/test', { 'authorization': 'Bearer xxx' }, { data: 'test' });
  logger.logResponse(200, '/api/test', { result: 'success' }, 150);
  
  console.log(''); // spacer
}

console.log('\n=== Usage Examples ===');
console.log('bizmanage login                    # Default logging (INFO level)');
console.log('bizmanage login --silent           # Only errors');
console.log('bizmanage login -v                 # Verbose (INFO level)');
console.log('bizmanage login -vv                # Very verbose (DEBUG level)');
console.log('bizmanage login -vvv               # Extra verbose (TRACE level)');
console.log('bizmanage login --debug            # Debug mode (DEBUG level)');
console.log('bizmanage login --log-timestamps   # Include timestamps');
console.log('\n=== Debug Features ===');
console.log('• HTTP request/response logging at DEBUG level');
console.log('• Service initialization logging');
console.log('• Command execution tracking');
console.log('• Automatic header sanitization for security');
console.log('• Response time tracking');
console.log('• Structured data logging (JSON format)');
