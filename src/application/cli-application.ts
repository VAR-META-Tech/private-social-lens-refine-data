/**
 * CLI Application Layer
 * Handles CLI interface while delegating business logic to services
 */

import { container } from '@/core';
import { BatchProcessor } from '@/core';
import { connectDatabase } from '@/database/client';
import { initializeContract } from '@/services';
import { getEnvironmentConfig, displayEnvironmentSummary } from '@/config';
import { logger } from '@/services/logging.service';

export interface CliArguments {
  startId?: number;
  endId?: number;
  batchSize?: number;
  verbose?: boolean;
  showHelp?: boolean;
  jobName?: string;
}

export class CliApplication {
  private batchProcessor: BatchProcessor;

  constructor() {
    this.batchProcessor = new BatchProcessor();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    logger.info('🚀 Initializing Batch Refinement Service...');

    try {
      // Display environment configuration
      const envConfig = getEnvironmentConfig();
      displayEnvironmentSummary(envConfig);

      // Initialize database connection
      await connectDatabase();

      // Initialize dependency injection container (includes hybrid config)
      await container.initialize();

      // Initialize blockchain contract
      initializeContract();

      // Validate complete configuration
      const hybridConfigService = container.getHybridConfigService();
      const configValidation = await hybridConfigService.validateConfig();

      if (!configValidation.valid) {
        logger.warn('⚠️ Configuration validation warnings:');
        configValidation.errors.forEach(error => logger.warn(`  • ${error}`));
      }

      logger.info('✅ Application initialized successfully');
    } catch (error) {
      logger.error('❌ Application initialization failed:', error as Error);
      throw error;
    }
  }

  /**
   * Run batch processing with CLI arguments
   */
  async runBatch(args: CliArguments): Promise<void> {
    try {
      logger.info('📋 Starting batch refinement with arguments:', args);

      // Validate arguments
      if (!args.startId || !args.endId) {
        throw new Error('Start ID and End ID are required');
      }

      if (args.startId <= args.endId) {
        throw new Error('Start ID must be greater than End ID (processing in descending order)');
      }

      // Run batch processing
      const result = await this.batchProcessor.processByFileRange({
        startFileId: args.startId,
        endFileId: args.endId,
        batchSize: args.batchSize,
        jobName: args.jobName || `cli-batch-${args.startId}-${args.endId}`,
        metadata: {
          triggeredBy: 'cli',
          arguments: args,
          timestamp: new Date().toISOString()
        }
      });

      // Display results
      this.displayResults(result);

    } catch (error) {
      logger.error('❌ Batch processing failed:', error as Error);
      throw error;
    }
  }

  /**
   * Display processing results
   */
  private displayResults(result: any): void {
    logger.info('\n🎉 ===== BATCH PROCESSING COMPLETED =====');
    logger.info(`Job ID: ${result.jobId}`);
    logger.info(`Total files: ${result.totalFiles}`);
    logger.info(`Processed files: ${result.processedFiles}`);
    logger.info(`✅ Successful: ${result.successfulFiles}`);
    logger.info(`❌ Failed: ${result.failedFiles}`);
    logger.info(`⏭️ Already refined: ${result.alreadyRefinedFiles}`);
    logger.info(`⏹️ Skipped: ${result.skippedFiles}`);
    logger.info(`⏱️ Processing time: ${result.processingTimeMs}ms`);

    const successRate = result.processedFiles > 0
      ? Math.round((result.successfulFiles / result.processedFiles) * 100 * 100) / 100
      : 0;
    logger.info(`📊 Success rate: ${successRate}%`);
    logger.info('==========================================\n');
  }

  /**
   * Show help message
   */
  showHelp(): void {
    logger.info(`
🔧 Batch Refinement Service - CLI Interface

USAGE:
  node dist/index.js [options]

OPTIONS:
  -s, --start <id>     Start file ID (required)
  -e, --end <id>       End file ID (required)  
  -b, --batch <size>   Batch size for processing (default: from config)
  -n, --name <name>    Job name (default: auto-generated)
  -v, --verbose        Enable verbose logging
  -h, --help           Show this help message

EXAMPLES:
  # Process files from ID 1000 to 900 with default batch size
  node dist/index.js --start 1000 --end 900

  # Process with custom batch size
  node dist/index.js --start 1000 --end 900 --batch 20

  # Process with custom job name
  node dist/index.js --start 1000 --end 900 --name "my-refinement-job"

ENVIRONMENT VARIABLES:
  DATABASE_URL              PostgreSQL connection string
  DLP_PRIVATE_KEY          DLP private key for decryption
  DLP_ADDRESS              DLP address
  DATA_REGISTRY_ADDRESS    Smart contract address
  RPC_URL                  Ethereum RPC URL
  PINATA_API_JWT           Pinata API JWT for IPFS

CONFIGURATION:
  Configuration is stored in the database and can be modified via the API.
  Default configuration is automatically initialized on first run.

For more information, see the documentation.
    `);
  }

  /**
   * Parse CLI arguments
   */
  parseArguments(argv: string[]): CliArguments {
    const args = argv.slice(2);
    const parsed: CliArguments = {};

    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case '--start':
        case '-s':
          parsed.startId = parseInt(args[i + 1], 10);
          i++;
          break;
        case '--end':
        case '-e':
          parsed.endId = parseInt(args[i + 1], 10);
          i++;
          break;
        case '--batch':
        case '-b':
          parsed.batchSize = parseInt(args[i + 1], 10);
          i++;
          break;
        case '--name':
        case '-n':
          parsed.jobName = args[i + 1];
          i++;
          break;
        case '--verbose':
        case '-v':
          parsed.verbose = true;
          break;
        case '--help':
        case '-h':
          parsed.showHelp = true;
          break;
        default:
          logger.warn(`Unknown argument: ${args[i]}`);
      }
    }

    return parsed;
  }

  /**
   * Validate CLI arguments
   */
  validateArguments(args: CliArguments): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (args.showHelp) {
      return { valid: true, errors: [] };
    }

    if (!args.startId) {
      errors.push('Start ID is required (--start or -s)');
    }

    if (!args.endId) {
      errors.push('End ID is required (--end or -e)');
    }

    if (args.startId && args.endId && args.startId <= args.endId) {
      errors.push('Start ID must be greater than End ID (processing in descending order)');
    }

    if (args.batchSize && (args.batchSize < 1 || args.batchSize > 100)) {
      errors.push('Batch size must be between 1 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Display validation errors
   */
  displayErrors(errors: string[]): void {
    logger.error('❌ Invalid arguments:');
    errors.forEach(error => logger.error(`  • ${error}`));
    logger.error('\nUse --help for usage information.');
  }

  /**
   * Run health check
   */
  async healthCheck(): Promise<void> {
    logger.info('🔍 Running health check...');

    try {
      // Check container
      const containerHealth = await container.healthCheck();
      logger.info(`Container status: ${containerHealth.status}`);
      logger.info(`Services: ${containerHealth.services}`);

      // Check database
      const { healthCheck } = await import('../database/client');
      const dbHealth = await healthCheck();
      logger.info(`Database status: ${dbHealth.status}`);

      // Get some basic stats
      const { batchStatisticsService } = container.getServices();
      const metrics = await batchStatisticsService.getPerformanceMetrics();
      logger.info(`Performance metrics: ${JSON.stringify({
        totalJobs: metrics.totalJobs,
        successRate: `${metrics.successRate}%`,
        totalFilesProcessed: metrics.totalFilesProcessed
      })}`);

      logger.info('✅ Health check completed');
    } catch (error) {
      logger.error('❌ Health check failed:', error as Error);
      throw error;
    }
  }
}
