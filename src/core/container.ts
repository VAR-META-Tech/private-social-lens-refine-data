/**
 * Dependency Injection Container
 * Manages service instances and their dependencies
 */

import { ApiKeyService, RefinementJobService } from '@/services';
import { FileProcessingService } from '@/services';
import { BatchStatisticsService } from '@/services';
import { SystemConfigService } from '@/services';
import { JobSchedulerService } from '@/services';
import { LoggingService } from '@/services';
import { HealthMonitoringService } from '@/services';
import { HybridConfigService } from '@/config';
import { BatchProcessor } from './batch-processor';
import { prisma } from '@/database/client';

export interface ServiceContainer {
  refinementJobService: RefinementJobService;
  fileProcessingService: FileProcessingService;
  batchStatisticsService: BatchStatisticsService;
  systemConfigService: SystemConfigService;
  jobSchedulerService: JobSchedulerService;
  loggingService: LoggingService;
  healthMonitoringService: HealthMonitoringService;
  hybridConfigService: HybridConfigService;
  batchProcessor: BatchProcessor;
  apiKeyService: ApiKeyService;
}

export class Container {
  private static instance: Container;
  private services: Partial<ServiceContainer> = {};
  private initialized = false;

  /**
   * Get singleton instance
   */
  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🔧 Initializing dependency injection container...');

    // Initialize services in dependency order
    this.services.systemConfigService = new SystemConfigService();
    this.services.hybridConfigService = new HybridConfigService(this.services.systemConfigService);
    this.services.batchStatisticsService = new BatchStatisticsService();
    this.services.fileProcessingService = new FileProcessingService();
    this.services.refinementJobService = new RefinementJobService();
    this.services.jobSchedulerService = new JobSchedulerService();
    this.services.loggingService = new LoggingService();
    this.services.healthMonitoringService = new HealthMonitoringService(
      this.services.jobSchedulerService,
      this.services.batchStatisticsService,
      this.services.systemConfigService,
      prisma
    );
    this.services.batchProcessor = new BatchProcessor();
    this.services.apiKeyService = new ApiKeyService(prisma);
    // Initialize hybrid configuration with environment overrides
    await this.services.hybridConfigService.initializeWithOverrides();

    // Initialize job scheduler
    await this.services.jobSchedulerService.initialize();

    this.initialized = true;
    console.log('✅ Dependency injection container initialized');
  }

  /**
   * Get all services
   */
  getServices(): ServiceContainer {
    if (!this.initialized) {
      throw new Error('Container not initialized. Call initialize() first.');
    }

    return this.services as ServiceContainer;
  }

  /**
   * Get refinement job service
   */
  getRefinementJobService(): RefinementJobService {
    return this.getServices().refinementJobService;
  }

  /**
   * Get file processing service
   */
  getFileProcessingService(): FileProcessingService {
    return this.getServices().fileProcessingService;
  }

  /**
   * Get batch statistics service
   */
  getBatchStatisticsService(): BatchStatisticsService {
    return this.getServices().batchStatisticsService;
  }

  /**
   * Get system config service
   */
  getSystemConfigService(): SystemConfigService {
    return this.getServices().systemConfigService;
  }

  /**
   * Get hybrid config service
   */
  getHybridConfigService(): HybridConfigService {
    return this.getServices().hybridConfigService;
  }

  /**
   * Get job scheduler service
   */
  getJobSchedulerService(): JobSchedulerService {
    return this.getServices().jobSchedulerService;
  }

  /**
   * Get batch processor
   */
  getBatchProcessor(): BatchProcessor {
    return this.getServices().batchProcessor;
  }

  /**
   * Get logging service
   */
  getLoggingService(): LoggingService {
    return this.getServices().loggingService;
  }

  /**
   * Get health monitoring service
   */
  getHealthMonitoringService(): HealthMonitoringService {
    return this.getServices().healthMonitoringService;
  }

  /**
   * Get API key service
   */
  getApiKeyService(): ApiKeyService {
    return this.getServices().apiKeyService;
  }

  /**
   * Reset container (for testing)
   */
  reset(): void {
    this.services = {};
    this.initialized = false;
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: Record<string, boolean>;
    timestamp: string;
  }> {
    const serviceChecks: Record<string, boolean> = {};

    try {
      // Check each service
      serviceChecks.systemConfigService = !!this.services.systemConfigService;
      serviceChecks.hybridConfigService = !!this.services.hybridConfigService;
      serviceChecks.refinementJobService = !!this.services.refinementJobService;
      serviceChecks.fileProcessingService = !!this.services.fileProcessingService;
      serviceChecks.batchStatisticsService = !!this.services.batchStatisticsService;
      serviceChecks.jobSchedulerService = !!this.services.jobSchedulerService;
      serviceChecks.loggingService = !!this.services.loggingService;
      serviceChecks.healthMonitoringService = !!this.services.healthMonitoringService;
      serviceChecks.batchProcessor = !!this.services.batchProcessor;
      serviceChecks.apiKeyService = !!this.services.apiKeyService;
      // Test basic functionality
      if (this.services.systemConfigService) {
        const testConfig = await this.services.systemConfigService.getConfig('processing.batch_size');
        serviceChecks.systemConfigTest = testConfig !== null;
      }

      const allHealthy = Object.values(serviceChecks).every(check => check === true);

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        services: serviceChecks,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Container health check failed:', error);
      return {
        status: 'unhealthy',
        services: serviceChecks,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const container = Container.getInstance();
