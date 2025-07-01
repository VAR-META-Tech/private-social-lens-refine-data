/**
 * Hybrid Configuration System
 * Combines environment variables with database-stored configuration
 * Environment variables take precedence for system settings
 * Database stores runtime/business configuration that can be modified
 */

import { SystemConfigService } from '@/services';
import { getEnvironmentConfig, EnvironmentConfig } from './environment';

export interface HybridConfig {
  // Environment-based (immutable during runtime)
  environment: EnvironmentConfig;

  // Database-based (can be modified during runtime)
  processing: {
    batchSize: number;
    maxConcurrentJobs: number;
    defaultPriority: number;
    maxRetries: number;
    retryDelaySeconds: number;
    autoRetry: boolean;
    parallelProcessing: boolean;
  };

  cron: {
    batchProcessing: string;
    cleanupOldLogs: string;
    healthCheck: string;
  };

  api: {
    refinementTimeoutMs: number;
  };

  features: {
    autoRetry: boolean;
    parallelProcessing: boolean;
  };

  logging: {
    level: string;
    maxFileSizeMb: number;
  };
}

export class HybridConfigService {
  private systemConfigService: SystemConfigService;
  private cachedConfig: HybridConfig | null = null;
  private lastCacheTime: number = 0;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(systemConfigService: SystemConfigService) {
    this.systemConfigService = systemConfigService;
  }

  /**
   * Get complete hybrid configuration
   */
  async getConfig(forceRefresh: boolean = false): Promise<HybridConfig> {
    const now = Date.now();

    // Return cached config if still valid
    if (!forceRefresh && this.cachedConfig && (now - this.lastCacheTime) < this.cacheTimeout) {
      return this.cachedConfig;
    }

    // Load environment config
    const environment = getEnvironmentConfig();

    // Load database config
    const [processingConfig, cronSchedules, apiConfig] = await Promise.all([
      this.systemConfigService.getProcessingConfig(),
      this.systemConfigService.getCronSchedules(),
      this.systemConfigService.getApiConfig()
    ]);

    // Combine configurations
    this.cachedConfig = {
      environment,
      processing: processingConfig,
      cron: cronSchedules,
      api: apiConfig,
      features: {
        autoRetry: processingConfig.autoRetry,
        parallelProcessing: processingConfig.parallelProcessing
      },
      logging: {
        level: await this.systemConfigService.getConfigTyped('logging.level', environment.logLevel),
        maxFileSizeMb: await this.systemConfigService.getConfigTyped('logging.max_file_size_mb', 10)
      }
    };

    this.lastCacheTime = now;
    return this.cachedConfig;
  }

  /**
   * Get processing configuration
   */
  async getProcessingConfig() {
    const config = await this.getConfig();
    return config.processing;
  }

  /**
   * Get cron schedules
   */
  async getCronSchedules() {
    const config = await this.getConfig();
    return config.cron;
  }

  /**
   * Get environment configuration
   */
  async getEnvironmentConfig() {
    const config = await this.getConfig();
    return config.environment;
  }

  /**
   * Update database configuration and refresh cache
   */
  async updateConfig(key: string, value: string, description?: string): Promise<void> {
    await this.systemConfigService.setConfig(key, value, description);
    this.invalidateCache();
  }

  /**
   * Invalidate cache to force refresh on next access
   */
  invalidateCache(): void {
    this.cachedConfig = null;
    this.lastCacheTime = 0;
  }

  /**
   * Validate entire configuration
   */
  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Validate database config
      const dbValidation = await this.systemConfigService.validateConfig();
      if (!dbValidation.valid) {
        errors.push(...dbValidation.errors);
      }

      // Validate environment config
      const config = await this.getConfig();

      // Cross-validation: ensure database config is within reasonable bounds
      if (config.processing.batchSize > 1000) {
        errors.push('Batch size too large (max 1000)');
      }

      if (config.processing.maxConcurrentJobs > 50) {
        errors.push('Max concurrent jobs too large (max 50)');
      }

      if (config.api.refinementTimeoutMs > 5 * 60 * 1000) {
        errors.push('API timeout too large (max 5 minutes)');
      }

      // Validate cron expressions
      const cronFields = [
        { name: 'batchProcessing', value: config.cron.batchProcessing },
        { name: 'cleanupOldLogs', value: config.cron.cleanupOldLogs },
        { name: 'healthCheck', value: config.cron.healthCheck }
      ];

      for (const field of cronFields) {
        if (!this.isValidCronExpression(field.value)) {
          errors.push(`Invalid cron expression for ${field.name}: ${field.value}`);
        }
      }

    } catch (error) {
      errors.push(`Configuration validation error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Basic cron expression validation
   */
  private isValidCronExpression(expression: string): boolean {
    // Basic validation - split by spaces and check field count
    const fields = expression.trim().split(/\s+/);
    return fields.length === 5; // minute hour day month weekday
  }

  /**
   * Get configuration summary for display
   */
  async getConfigSummary(): Promise<{
    environment: any;
    database: any;
    validation: { valid: boolean; errors: string[] };
  }> {
    const config = await this.getConfig();
    const validation = await this.validateConfig();

    return {
      environment: {
        nodeEnv: config.environment.nodeEnv,
        port: config.environment.port,
        logLevel: config.environment.logLevel,
        rpcUrl: config.environment.rpcUrl.substring(0, 50) + '...',
        databaseConnected: !!config.environment.databaseUrl
      },
      database: {
        batchSize: config.processing.batchSize,
        maxConcurrentJobs: config.processing.maxConcurrentJobs,
        autoRetry: config.features.autoRetry,
        parallelProcessing: config.features.parallelProcessing,
        batchProcessingCron: config.cron.batchProcessing,
        apiTimeout: config.api.refinementTimeoutMs
      },
      validation
    };
  }

  /**
   * Hot-reload configuration by invalidating cache
   */
  async hotReload(): Promise<HybridConfig> {
    this.invalidateCache();
    const config = await this.getConfig(true);
    console.log('🔄 Configuration hot-reloaded');
    return config;
  }

  /**
   * Initialize configuration with environment overrides
   */
  async initializeWithOverrides(): Promise<void> {
    console.log('🔧 Initializing hybrid configuration...');

    // Initialize default database config
    await this.systemConfigService.initializeDefaults();

    // Override database config with environment variables if they exist
    const env = getEnvironmentConfig();

    // Override batch size if set in environment
    if (process.env.BATCH_SIZE) {
      await this.systemConfigService.setConfig(
        'processing.batch_size',
        env.defaultBatchSize.toString(),
        'Batch size (overridden from environment)'
      );
    }

    // Override other environment-specific settings
    await this.systemConfigService.setConfig(
      'logging.level',
      env.logLevel,
      'Logging level (from environment)'
    );

    console.log('✅ Hybrid configuration initialized');
  }
}
