/**
 * Logger utility with verbosity levels for bizmanage-cli
 * Built on Winston for robust logging capabilities
 */
import winston from 'winston';
import chalk from 'chalk';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'silly' // Winston uses 'silly' for trace level
}

export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  silent?: boolean;
}

// Custom formatter for CLI output
const cliFormatter = winston.format.printf(({ level, message, prefix, timestamp, metadata, ...meta }) => {
  let formatted = '';
  
  // Add timestamp if enabled
  if (timestamp) {
    const now = new Date().toISOString();
    formatted += chalk.gray(`[${now}] `);
  }
  
  // Add prefix if provided
  if (prefix) {
    formatted += chalk.cyan(`[${prefix}] `);
  }
  
  // Format level with colors
  let levelLabel = '';
  switch (level) {
    case 'error':
      levelLabel = chalk.red('ERROR');
      break;
    case 'warn':
      levelLabel = chalk.yellow('WARN');
      break;
    case 'info':
      levelLabel = chalk.blue('INFO');
      break;
    case 'debug':
      levelLabel = chalk.magenta('DEBUG');
      break;
    case 'silly':
      levelLabel = chalk.dim('TRACE');
      break;
    default:
      levelLabel = level.toUpperCase();
  }
  
  formatted += `${levelLabel} ${message}`;
  
  // Add metadata if present (excluding internal Winston/logger metadata)
  // Only show user-provided metadata, not internal metadata like prefix/timestamp
  const userMeta = { ...meta };
  delete userMeta.prefix;
  delete userMeta.timestamp;
  
  if (Object.keys(userMeta).length > 0) {
    formatted += `\n${JSON.stringify(userMeta, null, 2)}`;
  }
  
  return formatted;
});

export class Logger {
  private winston: winston.Logger;
  private config: LoggerConfig;
  private static instance: Logger | null = null;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.winston = winston.createLogger({
      level: config.level,
      silent: config.silent || false,
      format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.metadata(),
        cliFormatter
      ),
      transports: [
        new winston.transports.Console({
          handleExceptions: true,
          handleRejections: true,
        })
      ],
      exitOnError: false
    });
  }

  /**
   * Get or create a singleton logger instance
   */
  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config || { level: LogLevel.INFO });
    } else if (config) {
      Logger.instance.updateConfig(config);
    }
    return Logger.instance;
  }

  /**
   * Update logger configuration
   */
  private updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.winston.level = this.config.level;
    this.winston.silent = this.config.silent || false;
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.winston.level = level;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Set silent mode
   */
  setSilent(silent: boolean): void {
    this.config.silent = silent;
    this.winston.silent = silent;
  }

  /**
   * Log an error message
   */
  error(message: string, meta?: any): void {
    this.winston.error(message, { 
      prefix: this.config.prefix, 
      timestamp: this.config.timestamp,
      ...meta 
    });
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: any): void {
    this.winston.warn(message, { 
      prefix: this.config.prefix, 
      timestamp: this.config.timestamp,
      ...meta 
    });
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: any): void {
    this.winston.info(message, { 
      prefix: this.config.prefix, 
      timestamp: this.config.timestamp,
      ...meta 
    });
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: any): void {
    this.winston.debug(message, { 
      prefix: this.config.prefix, 
      timestamp: this.config.timestamp,
      ...meta 
    });
  }

  /**
   * Log a trace message
   */
  trace(message: string, meta?: any): void {
    this.winston.silly(message, { 
      prefix: this.config.prefix, 
      timestamp: this.config.timestamp,
      ...meta 
    });
  }

  /**
   * Log a success message (maps to info level with green color)
   */
  success(message: string, meta?: any): void {
    // Custom success logging - we'll handle the color in the message
    this.winston.info(chalk.green(`SUCCESS ${message}`), { 
      prefix: this.config.prefix, 
      timestamp: this.config.timestamp,
      ...meta 
    });
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    const childPrefix = this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix;
    return new Logger({
      ...this.config,
      prefix: childPrefix
    });
  }

  /**
   * Log HTTP request details (debug level)
   */
  logRequest(method: string, url: string, headers?: any, data?: any): void {
    this.debug(`HTTP ${method.toUpperCase()} ${url}`, {
      headers: headers ? this.sanitizeHeaders(headers) : undefined,
      requestData: data || undefined
    });
  }

  /**
   * Log HTTP response details (debug level)
   */
  logResponse(status: number, url: string, data?: any, responseTime?: number): void {
    const statusColor = status >= 400 ? chalk.red : status >= 300 ? chalk.yellow : chalk.green;
    const responseMsg = `HTTP ${statusColor(status)} ${url}${responseTime ? ` (${responseTime}ms)` : ''}`;
    this.debug(responseMsg, { responseData: data });
  }

  /**
   * Sanitize headers to hide sensitive information
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'x-auth-token'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Get the underlying Winston logger (for advanced usage)
   */
  getWinstonLogger(): winston.Logger {
    return this.winston;
  }
}

/**
 * Convenience functions for global logger
 */
export const logger = Logger.getInstance();

export const setLogLevel = (level: LogLevel) => logger.setLevel(level);
export const getLogLevel = () => logger.getLevel();

// Convenience exports
export const logError = (message: string, data?: any) => logger.error(message, data);
export const logWarn = (message: string, data?: any) => logger.warn(message, data);
export const logInfo = (message: string, data?: any) => logger.info(message, data);
export const logDebug = (message: string, data?: any) => logger.debug(message, data);
export const logTrace = (message: string, data?: any) => logger.trace(message, data);
export const logSuccess = (message: string, data?: any) => logger.success(message, data);
