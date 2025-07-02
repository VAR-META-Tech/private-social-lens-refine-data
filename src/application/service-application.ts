/**
 * Service Application
 * Long-running service with automated job scheduling
 * Replaces manual CLI execution with automated cron jobs
 */

import { container } from '@/core';
import { JobType } from '@/generated/prisma';

export class ServiceApplication {
  private isRunning = false;
  private shutdownSignalReceived = false;

  /**
   * Start the service application
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Service is already running');
      return;
    }

    console.log('🚀 Starting Batch Refinement Service...');

    try {
      // Initialize container and all services
      await container.initialize();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Mark as running
      this.isRunning = true;

      console.log('✅ Batch Refinement Service started successfully');
      console.log('🕐 Job scheduler is running and monitoring for scheduled jobs');
      console.log('📊 Service is ready to process files automatically');

      // Keep the service running
      await this.keepAlive();

    } catch (error) {
      console.error('❌ Failed to start service:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the service application
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Service is not running');
      return;
    }

    console.log('🛑 Stopping Batch Refinement Service...');
    this.shutdownSignalReceived = true;

    try {
      // Stop job scheduler (it has its own graceful shutdown)
      const { jobSchedulerService } = container.getServices();
      await jobSchedulerService.stopScheduledJob('all');

      this.isRunning = false;
      console.log('✅ Batch Refinement Service stopped gracefully');

    } catch (error) {
      console.error('❌ Error during service shutdown:', error);
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
    console.log('📅 Creating example scheduled jobs...');

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

      console.log('✅ Example scheduled jobs created');
      console.log('ℹ️  System schedulers (health-check, weekly-cleanup) are created automatically by JobSchedulerService');

    } catch (error) {
      console.error('❌ Failed to create example jobs:', error);
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

    console.log(`🎯 One-time job scheduled and triggered: ${job.jobName}`);
    return job.id;
  }

  /**
   * Run health check manually
   */
  async runHealthCheck(): Promise<void> {
    console.log('🏥 Running manual health check...');

    try {
      const status = await this.getStatus();

      console.log('📊 Service Status:');
      console.log(`  - Running: ${status.isRunning}`);
      console.log(`  - Uptime: ${Math.round(status.uptime)}s`);
      console.log(`  - Scheduled Jobs: ${status.scheduler.scheduledJobs}`);
      console.log(`  - Running Jobs: ${status.scheduler.runningJobs}`);
      console.log(`  - Container Health: ${status.container.status}`);

      // Check recent jobs
      if (status.scheduler.recentJobs?.length > 0) {
        console.log('📋 Recent Jobs:');
        status.scheduler.recentJobs.forEach((job: any) => {
          console.log(`  - ${job.jobName}: ${job.status} (${job.createdAt})`);
        });
      }

      console.log('✅ Health check completed');

    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  }

  /**
   * List all scheduled jobs
   */
  async listScheduledJobs(): Promise<void> {
    console.log('📋 Listing all scheduled jobs...');

    try {
      const { jobSchedulerService } = container.getServices();
      const status = await jobSchedulerService.getStatus();

      if (status.recentJobs.length === 0) {
        console.log('📭 No jobs found');
        return;
      }

      console.log('📊 Job Summary:');
      console.log(`  - Total scheduled: ${status.scheduledJobs}`);
      console.log(`  - Currently running: ${status.runningJobs}`);
      console.log(`  - Max concurrent: ${status.maxConcurrentJobs}`);

      console.log('\n📋 Recent Jobs:');
      status.recentJobs.forEach((job: any, index: number) => {
        const duration = job.completedAt && job.startedAt
          ? Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
          : null;

        console.log(`${index + 1}. ${job.jobName}`);
        console.log(`   Type: ${job.jobType}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Created: ${new Date(job.createdAt).toLocaleString()}`);
        if (job.startedAt) {
          console.log(`   Started: ${new Date(job.startedAt).toLocaleString()}`);
        }
        if (job.completedAt) {
          console.log(`   Completed: ${new Date(job.completedAt).toLocaleString()}`);
        }
        if (duration) {
          console.log(`   Duration: ${duration}s`);
        }
        console.log('');
      });

    } catch (error) {
      console.error('❌ Failed to list jobs:', error);
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
      console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown('EXCEPTION').then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('REJECTION').then(() => process.exit(1));
    });
  }
}
