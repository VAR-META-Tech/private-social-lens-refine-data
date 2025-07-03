/**
 * Service Application
 * Long-running service with automated job scheduling
 * Replaces manual CLI execution with automated cron jobs
 */

import { container } from '@/core';
import { JobType } from '@/generated/prisma';
import { logger } from '@/services/logging.service';

export class ServiceApplication {
  private isRunning = false;
  private shutdownSignalReceived = false;

  /**
   * Start the service application
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('⚠️ Service is already running');
      return;
    }

    logger.info('🚀 Starting Batch Refinement Service...');

    try {
      // Initialize container and all services
      await container.initialize();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Mark as running
      this.isRunning = true;

      logger.info('✅ Batch Refinement Service started successfully');
      logger.info('🕐 Job scheduler is running and monitoring for scheduled jobs');
      logger.info('📊 Service is ready to process files automatically');

      // Keep the service running
      await this.keepAlive();

    } catch (error) {
      logger.error('❌ Failed to start service:', error as Error);
      process.exit(1);
    }
  }

  /**
   * Stop the service application
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('⚠️ Service is not running');
      return;
    }

    logger.info('🛑 Stopping Batch Refinement Service...');
    this.shutdownSignalReceived = true;

    try {
      // Stop job scheduler (it has its own graceful shutdown)
      const { jobSchedulerService } = container.getServices();
      await jobSchedulerService.stopScheduledJob('all');

      this.isRunning = false;
      logger.info('✅ Batch Refinement Service stopped gracefully');

    } catch (error) {
      logger.error('❌ Error during service shutdown:', error as Error);
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    uptime: number;
    scheduler: any;
    container: any;
  }> {
    const { jobSchedulerService } = container.getServices();
    const schedulerStatus = await jobSchedulerService.getStatus();
    const containerHealth = await container.healthCheck();

    return {
      isRunning: this.isRunning,
      uptime: process.uptime(),
      scheduler: schedulerStatus,
      container: containerHealth
    };
  }

  /**
   * Create example scheduled jobs
   */
  async createExampleJobs(): Promise<void> {
    logger.info('📅 Creating example scheduled jobs...');

    const { jobSchedulerService } = container.getServices();

    try {
      // Daily batch processing at 2 AM
      await jobSchedulerService.createScheduledJob({
        jobName: 'scheduler-daily-batch-refinement',
        jobType: JobType.SCHEDULED_BATCH,
        cronSchedule: '0 2 * * *', // Every day at 2 AM
        batchSize: 10,
        priority: 8,
        metadata: {
          description: 'Daily automated batch refinement scheduler',
          automated: true,
          isSchedulerJob: true,
          // Dynamic range configuration
          batchIncrement: 100,          // Process 100 files per batch
          initialStartFileId: 100       // First run: 200-100, second run: 300-200, etc.
        }
      });

      // NOTE: Weekly cleanup is automatically created by JobSchedulerService.scheduleSystemJobs()
      // Removed duplicate scheduler to avoid conflicts
      
      // NOTE: Health check is automatically created by JobSchedulerService.scheduleSystemJobs()
      // If you need additional health checks, create with different names and schedules

      logger.info('✅ Example scheduled jobs created');
      logger.info('ℹ️  System schedulers (health-check, weekly-cleanup) are created automatically by JobSchedulerService');

    } catch (error) {
      logger.error('❌ Failed to create example jobs:', error as Error);
      // Don't throw - these might already exist
    }
  }

  /**
   * Schedule a one-time job
   */
  async scheduleOneTimeJob(config: {
    jobName: string;
    jobType: JobType;
    startFileId?: number;
    endFileId?: number;
    batchSize?: number;
    priority?: number;
    metadata?: object;
  }): Promise<string> {
    const { jobSchedulerService } = container.getServices();

    // Create a manual job (no cron schedule)
    const job = await jobSchedulerService.createScheduledJob({
      ...config,
      cronSchedule: '', // No cron schedule for one-time jobs
    });

    // Execute immediately
    await jobSchedulerService.triggerJob(job.id);

    logger.info(`🎯 One-time job scheduled and triggered: ${job.jobName}`);
    return job.id;
  }

  /**
   * Run health check manually
   */
  async runHealthCheck(): Promise<void> {
    logger.info('🏥 Running manual health check...');

    try {
      const status = await this.getStatus();

      logger.info('📊 Service Status:');
      logger.info(`  - Running: ${status.isRunning}`);
      logger.info(`  - Uptime: ${Math.round(status.uptime)}s`);
      logger.info(`  - Scheduled Jobs: ${status.scheduler.scheduledJobs}`);
      logger.info(`  - Running Jobs: ${status.scheduler.runningJobs}`);
      logger.info(`  - Container Health: ${status.container.status}`);

      // Check recent jobs
      if (status.scheduler.recentJobs?.length > 0) {
        logger.info('📋 Recent Jobs:');
        status.scheduler.recentJobs.forEach((job: any) => {
          logger.info(`  - ${job.jobName}: ${job.status} (${job.createdAt})`);
        });
      }

      logger.info('✅ Health check completed');

    } catch (error) {
      logger.error('❌ Health check failed:', error as Error);
      throw error;
    }
  }

  /**
   * List all scheduled jobs
   */
  async listScheduledJobs(): Promise<void> {
    logger.info('📋 Listing all scheduled jobs...');

    try {
      const { jobSchedulerService } = container.getServices();
      const status = await jobSchedulerService.getStatus();

      if (status.recentJobs.length === 0) {
        logger.info('📭 No jobs found');
        return;
      }

      logger.info('📊 Job Summary:');
      logger.info(`  - Total scheduled: ${status.scheduledJobs}`);
      logger.info(`  - Currently running: ${status.runningJobs}`);
      logger.info(`  - Max concurrent: ${status.maxConcurrentJobs}`);

      logger.info('\n📋 Recent Jobs:');
      status.recentJobs.forEach((job: any, index: number) => {
        const duration = job.completedAt && job.startedAt
          ? Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
          : null;

        logger.info(`${index + 1}. ${job.jobName}`);
        logger.info(`   Type: ${job.jobType}`);
        logger.info(`   Status: ${job.status}`);
        logger.info(`   Created: ${new Date(job.createdAt).toLocaleString()}`);
        if (job.startedAt) {
          logger.info(`   Started: ${new Date(job.startedAt).toLocaleString()}`);
        }
        if (job.completedAt) {
          logger.info(`   Completed: ${new Date(job.completedAt).toLocaleString()}`);
        }
        if (duration) {
          logger.info(`   Duration: ${duration}s`);
        }
        logger.info('');
      });

    } catch (error) {
      logger.error('❌ Failed to list jobs:', error as Error);
      throw error;
    }
  }

  /**
   * Keep the service alive
   */
  private async keepAlive(): Promise<void> {
    // Service runs indefinitely until shutdown signal
    while (!this.shutdownSignalReceived) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception:', error as Error);
      shutdown('EXCEPTION').then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error(`❌ Unhandled Rejection at: ${promise}, reason: ${reason}`);
      shutdown('REJECTION').then(() => process.exit(1));
    });
  }
}
