/**
 * Structured Logging Service
 * Provides production-grade logging with JSON format, levels, rotation, and integration
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

export interface LogContext {
  jobId?: string;
  jobName?: string;
  jobType?: string;
  fileId?: number;
  batchSize?: number;
  priority?: number;
  duration?: number;
  filesProcessed?: number;
  errorCode?: string;
  retryCount?: number;
  component?: string;
  operation?: string;
  metadata?: object;
}

export interface LogMetrics {
  timestamp: string;
  level: string;
  service: string;
  component: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class LoggingService {
  private logger: winston.Logger;
  private serviceName: string = 'batch-refinement';
  private logDirectory: string = 'logs';

  constructor() {
    this.setupLogDirectory();
    this.createLogger();
  }

  /**
   * Setup log directory structure
   */
  private setupLogDirectory(): void {
    const dirs = [
      this.logDirectory,
      path.join(this.logDirectory, 'archived'),
      path.join(this.logDirectory, 'metrics')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Create Winston logger with multiple transports
   */
  private createLogger(): void {
    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
      winston.format.errors({ stack: true }),
      winston.format.printf((info) => {
        const logEntry: LogMetrics = {
          timestamp: info.timestamp as string,
          level: (info.level as string).toUpperCase(),
          service: this.serviceName,
          component: (info.component as string) || 'system',
          message: info.message as string,
          context: info.context as LogContext,
          error: info.error as { name: string; message: string; stack?: string } | undefined
        };

        // Remove undefined fields for cleaner JSON
        Object.keys(logEntry).forEach(key => {
          if (logEntry[key] === undefined) {
            delete logEntry[key];
          }
        });

        return JSON.stringify(logEntry);
      })
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf((info) => {
        const emoji = this.getLevelEmoji(info.level);
        const component = info.component ? `[${info.component}]` : '';
        const context = info.context ? ` ${JSON.stringify(info.context)}` : '';
        return `${emoji} ${info.timestamp} ${component} ${info.message}${context}`;
      })
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: this.serviceName },
      transports: [
        // Console output for development
        new winston.transports.Console({
          format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
        }),

        // Application logs with daily rotation
        new DailyRotateFile({
          filename: path.join(this.logDirectory, 'app-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          zippedArchive: true,
          level: 'info'
        }),

        // Error logs with daily rotation
        new DailyRotateFile({
          filename: path.join(this.logDirectory, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          zippedArchive: true,
          level: 'error'
        }),

        // Debug logs (only in development)
        ...(process.env.NODE_ENV !== 'production' ? [
          new DailyRotateFile({
            filename: path.join(this.logDirectory, 'debug-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '50m',
            maxFiles: '7d',
            level: 'debug'
          })
        ] : [])
      ]
    });

    // Handle logging errors
    this.logger.on('error', (error) => {
      console.error('Logging error:', error);
    });
  }

  /**
   * Get emoji for log level
   */
  private getLevelEmoji(level: string): string {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      case 'debug': return '🔍';
      default: return '📝';
    }
  }

  /**
   * Log info level message
   */
  info(message: string, context?: LogContext, component?: string): void {
    this.logger.info(message, { context, component });
  }

  /**
   * Log warning level message
   */
  warn(message: string, context?: LogContext, component?: string): void {
    this.logger.warn(message, { context, component });
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error, context?: LogContext, component?: string): void {
    const errorInfo = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : undefined;

    this.logger.error(message, { error: errorInfo, context, component });
  }

  /**
   * Log debug level message
   */
  debug(message: string, context?: LogContext, component?: string): void {
    this.logger.debug(message, { context, component });
  }

  /**
   * Log job started event
   */
  logJobStarted(jobId: string, jobName: string, jobType: string, context?: Partial<LogContext>): void {
    this.info('Job started', {
      jobId,
      jobName,
      jobType,
      ...context
    }, 'JobScheduler');
  }

  /**
   * Log job completed event
   */
  logJobCompleted(jobId: string, jobName: string, duration: number, context?: Partial<LogContext>): void {
    this.info('Job completed successfully', {
      jobId,
      jobName,
      duration,
      ...context
    }, 'JobScheduler');
  }

  /**
   * Log job failed event
   */
  logJobFailed(jobId: string, jobName: string, error: Error, retryCount?: number, context?: Partial<LogContext>): void {
    this.error('Job failed', error, {
      jobId,
      jobName,
      retryCount,
      errorCode: error.name,
      ...context
    }, 'JobScheduler');
  }

  /**
   * Log file processing event
   */
  logFileProcessing(fileId: number, status: string, context?: Partial<LogContext>): void {
    const level = status === 'success' ? 'info' : status === 'failed' ? 'error' : 'debug';
    
    this.logger.log(level, `File processing ${status}`, {
      context: {
        fileId,
        operation: 'file-processing',
        ...context
      },
      component: 'FileProcessor'
    });
  }

  /**
   * Log performance metrics
   */
  logMetrics(metrics: object, context?: Partial<LogContext>): void {
    // Write metrics to separate file for analysis
    const metricsLogger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: path.join(this.logDirectory, 'metrics', 'metrics-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: '90d',
          zippedArchive: true
        })
      ]
    });

    metricsLogger.info('Performance metrics', {
      metrics,
      context
    });
  }

  /**
   * Create child logger with default context
   */
  createChildLogger(component: string, defaultContext?: LogContext): ChildLogger {
    return new ChildLogger(this, component, defaultContext);
  }
}

/**
 * Child Logger with default context
 */
export class ChildLogger {
  constructor(
    private parent: LoggingService,
    private component: string,
    private defaultContext: LogContext = {}
  ) {}

  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.defaultContext, ...context }, this.component);
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...this.defaultContext, ...context }, this.component);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.parent.error(message, error, { ...this.defaultContext, ...context }, this.component);
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.defaultContext, ...context }, this.component);
  }
}

// Export singleton instance
export const logger = new LoggingService(); 