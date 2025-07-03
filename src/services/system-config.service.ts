/**
 * System Configuration Service
 * Handles dynamic system configuration management
 */

import { prisma } from '@/database/client';
import { SystemConfig, ConfigDataType } from '@/generated/prisma';
import { logger } from './logging.service';

export interface ConfigValue {
  key: string;
  value: string;
  description?: string;
  dataType: ConfigDataType;
  isEncrypted?: boolean;
}

export class SystemConfigService {
  /**
   * Get configuration value by key
   */
  async getConfig(key: string): Promise<string | null> {
    const config = await prisma.systemConfig.findUnique({
      where: { key }
    });

    return config ? config.value : null;
  }

  /**
   * Get configuration value with type casting
   */
  async getConfigTyped<T>(key: string, defaultValue: T): Promise<T> {
    const config = await prisma.systemConfig.findUnique({
      where: { key }
    });

    if (!config) {
      return defaultValue;
    }

    try {
      switch (config.dataType) {
        case ConfigDataType.INTEGER:
          return parseInt(config.value, 10) as T;
        case ConfigDataType.BOOLEAN:
          return (config.value.toLowerCase() === 'true') as T;
        case ConfigDataType.JSON:
          return JSON.parse(config.value) as T;
        case ConfigDataType.STRING:
        default:
          return config.value as T;
      }
    } catch (error) {
      console.warn(`Failed to parse config ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Set configuration value
   */
  async setConfig(
    key: string,
    value: string,
    description?: string,
    dataType: ConfigDataType = ConfigDataType.STRING,
    updatedBy: string = 'system'
  ): Promise<SystemConfig> {
    const config = await prisma.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value,
        description,
        dataType,
        updatedBy
      },
      update: {
        value,
        description,
        dataType,
        updatedBy,
        updatedAt: new Date()
      }
    });

    logger.info(`⚙️ Updated config: ${key} = ${value}`);
    return config;
  }

  /**
   * Get all configuration
   */
  async getAllConfig(): Promise<SystemConfig[]> {
    return await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' }
    });
  }

  /**
   * Get configuration by prefix
   */
  async getConfigByPrefix(prefix: string): Promise<SystemConfig[]> {
    return await prisma.systemConfig.findMany({
      where: {
        key: {
          startsWith: prefix
        }
      },
      orderBy: { key: 'asc' }
    });
  }

  /**
   * Delete configuration
   */
  async deleteConfig(key: string): Promise<boolean> {
    try {
      await prisma.systemConfig.delete({
        where: { key }
      });
      logger.info(`🗑️ Deleted config: ${key}`);
      return true;
    } catch (error) {
      console.warn(`Failed to delete config ${key}:`, error);
      return false;
    }
  }

  /**
   * Initialize default configuration
   */
  async initializeDefaults(): Promise<void> {
    const defaults: ConfigValue[] = [
      {
        key: 'processing.batch_size',
        value: '10',
        description: 'Default batch size for processing',
        dataType: ConfigDataType.INTEGER
      },
      {
        key: 'processing.max_concurrent_jobs',
        value: '5',
        description: 'Maximum number of concurrent jobs',
        dataType: ConfigDataType.INTEGER
      },
      {
        key: 'processing.default_priority',
        value: '5',
        description: 'Default job priority (1-10)',
        dataType: ConfigDataType.INTEGER
      },
      {
        key: 'processing.max_retries',
        value: '3',
        description: 'Maximum retry attempts for failed jobs',
        dataType: ConfigDataType.INTEGER
      },
      {
        key: 'processing.retry_delay_seconds',
        value: '300',
        description: 'Delay between retry attempts (seconds)',
        dataType: ConfigDataType.INTEGER
      },
      {
        key: 'cron.batch_processing',
        value: '0 */6 * * *',
        description: 'Cron schedule for batch processing (every 6 hours)',
        dataType: ConfigDataType.STRING
      },
      {
        key: 'cron.cleanup_old_logs',
        value: '0 2 * * 1',
        description: 'Cron schedule for cleanup (every Monday at 2 AM)',
        dataType: ConfigDataType.STRING
      },
      {
        key: 'cron.health_check',
        value: '*/30 * * * *',
        description: 'Cron schedule for health checks (every 30 minutes)',
        dataType: ConfigDataType.STRING
      },
      {
        key: 'api.refinement_timeout_ms',
        value: '30000',
        description: 'Refinement API request timeout (milliseconds)',
        dataType: ConfigDataType.INTEGER
      },
      {
        key: 'features.auto_retry',
        value: 'true',
        description: 'Enable automatic retry for failed jobs',
        dataType: ConfigDataType.BOOLEAN
      },
      {
        key: 'features.parallel_processing',
        value: 'true',
        description: 'Enable parallel file processing',
        dataType: ConfigDataType.BOOLEAN
      },
      {
        key: 'logging.level',
        value: 'info',
        description: 'Logging level (debug, info, warn, error)',
        dataType: ConfigDataType.STRING
      },
      {
        key: 'logging.max_file_size_mb',
        value: '10',
        description: 'Maximum log file size in MB',
        dataType: ConfigDataType.INTEGER
      }
    ];

    for (const config of defaults) {
      await this.setConfig(
        config.key,
        config.value,
        config.description,
        config.dataType,
        'system-init'
      );
    }

    logger.info(`✅ Initialized ${defaults.length} default configuration values`);
  }

  /**
   * Get processing configuration
   */
  async getProcessingConfig(): Promise<{
    batchSize: number;
    maxConcurrentJobs: number;
    defaultPriority: number;
    maxRetries: number;
    retryDelaySeconds: number;
    autoRetry: boolean;
    parallelProcessing: boolean;
  }> {
    return {
      batchSize: await this.getConfigTyped('processing.batch_size', 10),
      maxConcurrentJobs: await this.getConfigTyped('processing.max_concurrent_jobs', 5),
      defaultPriority: await this.getConfigTyped('processing.default_priority', 5),
      maxRetries: await this.getConfigTyped('processing.max_retries', 3),
      retryDelaySeconds: await this.getConfigTyped('processing.retry_delay_seconds', 300),
      autoRetry: await this.getConfigTyped('features.auto_retry', true),
      parallelProcessing: await this.getConfigTyped('features.parallel_processing', true)
    };
  }

  /**
   * Get cron schedules
   */
  async getCronSchedules(): Promise<{
    batchProcessing: string;
    cleanupOldLogs: string;
    healthCheck: string;
  }> {
    return {
      batchProcessing: await this.getConfigTyped('cron.batch_processing', '0 */6 * * *'),
      cleanupOldLogs: await this.getConfigTyped('cron.cleanup_old_logs', '0 2 * * 1'),
      healthCheck: await this.getConfigTyped('cron.health_check', '*/30 * * * *')
    };
  }

  /**
   * Get API configuration
   */
  async getApiConfig(): Promise<{
    refinementTimeoutMs: number;
  }> {
    return {
      refinementTimeoutMs: await this.getConfigTyped('api.refinement_timeout_ms', 30000)
    };
  }

  /**
   * Validate configuration values
   */
  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Validate batch size
      const batchSize = await this.getConfigTyped('processing.batch_size', 10);
      if (batchSize < 1 || batchSize > 100) {
        errors.push('processing.batch_size must be between 1 and 100');
      }

      // Validate max concurrent jobs
      const maxJobs = await this.getConfigTyped('processing.max_concurrent_jobs', 5);
      if (maxJobs < 1 || maxJobs > 20) {
        errors.push('processing.max_concurrent_jobs must be between 1 and 20');
      }

      // Validate priority
      const priority = await this.getConfigTyped('processing.default_priority', 5);
      if (priority < 1 || priority > 10) {
        errors.push('processing.default_priority must be between 1 and 10');
      }

      // Validate retry settings
      const maxRetries = await this.getConfigTyped('processing.max_retries', 3);
      if (maxRetries < 0 || maxRetries > 10) {
        errors.push('processing.max_retries must be between 0 and 10');
      }

      const retryDelay = await this.getConfigTyped('processing.retry_delay_seconds', 300);
      if (retryDelay < 10 || retryDelay > 3600) {
        errors.push('processing.retry_delay_seconds must be between 10 and 3600');
      }

      // Validate timeout
      const timeout = await this.getConfigTyped('api.refinement_timeout_ms', 30000);
      if (timeout < 1000 || timeout > 300000) {
        errors.push('api.refinement_timeout_ms must be between 1000 and 300000');
      }

    } catch (error) {
      errors.push(`Configuration validation error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
