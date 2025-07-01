/**
 * Job Scheduler Service
 * Manages cron jobs, job queue, status tracking, and retry mechanisms
 * Replaces manual CLI execution with automated scheduling
 */

import * as cron from 'node-cron';
import { prisma } from '../database/client';
import { 
  JobStatus, 
  JobType, 
  RefinementJob,
  Prisma 
} from '../generated/prisma';

export interface ScheduledJobConfig {
  jobName: string;
  jobType: JobType;
  cronSchedule: string;
  startFileId?: number;
  endFileId?: number;
  startIndex?: number;
  endIndex?: number;
  batchSize?: number;
  priority?: number;
  maxRetries?: number;
  retryDelaySeconds?: number;
  metadata?: object;
  enabled?: boolean;
}

export interface JobExecutionContext {
  job: RefinementJob;
  executionId: string;
  startTime: Date;
  retryAttempt: number;
}

export class JobSchedulerService {
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private runningJobs: Map<string, JobExecutionContext> = new Map();
  private isShuttingDown: boolean = false;
  private maxConcurrentJobs: number = 5;
  private retryMultiplier: number = 2;
  private maxRetryDelaySeconds: number = 3600; // 1 hour

  constructor() {
    this.setupGracefulShutdown();
  }

  /**
   * Initialize the scheduler and load existing scheduled jobs
   */
  async initialize(): Promise<void> {
    console.log('🕐 Initializing Job Scheduler Service...');

    try {
      // Load existing scheduled jobs from database
      await this.loadScheduledJobs();
      
      // Start job queue processor
      this.startJobQueueProcessor();
      
      // Schedule system maintenance jobs
      await this.scheduleSystemJobs();
      
      console.log('✅ Job Scheduler Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Job Scheduler Service:', error);
      throw error;
    }
  }

  /**
   * Create and schedule a new cron job
   */
  async createScheduledJob(config: ScheduledJobConfig): Promise<RefinementJob> {
    try {
      // Validate cron expression
      if (!cron.validate(config.cronSchedule)) {
        throw new Error(`Invalid cron expression: ${config.cronSchedule}`);
      }

      // Create job in database
      const job = await prisma.refinementJob.create({
        data: {
          jobName: config.jobName,
          jobType: config.jobType,
          cronSchedule: config.cronSchedule,
          startFileId: config.startFileId,
          endFileId: config.endFileId,
          startIndex: config.startIndex,
          endIndex: config.endIndex,
          batchSize: config.batchSize || 10,
          priority: config.priority || 5,
          maxRetries: config.maxRetries || 3,
          retryDelaySeconds: config.retryDelaySeconds || 300,
          metadata: config.metadata || {},
          status: JobStatus.PENDING,
          createdBy: 'scheduler'
        }
      });

      // Schedule the job if enabled
      if (config.enabled !== false) {
        await this.scheduleJob(job);
      }

      console.log(`📅 Created scheduled job: ${job.jobName} [${job.cronSchedule}]`);
      return job;

    } catch (error) {
      console.error(`❌ Failed to create scheduled job: ${config.jobName}`, error);
      throw error;
    }
  }

  /**
   * Schedule a job with cron
   */
  async scheduleJob(job: RefinementJob): Promise<void> {
    if (!job.cronSchedule) {
      console.warn(`⚠️ Job ${job.id} has no cron schedule, skipping`);
      return;
    }

    try {
      const task = cron.schedule(job.cronSchedule, async () => {
        await this.executeJob(job.id);
      });

      this.scheduledJobs.set(job.id, task);
      
      console.log(`⏰ Scheduled job ${job.jobName} with cron: ${job.cronSchedule}`);
    } catch (error) {
      console.error(`❌ Failed to schedule job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute a job (can be called manually or by cron)
   */
  async executeJob(jobId: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log(`🛑 Skipping job ${jobId} - scheduler is shutting down`);
      return;
    }

    // Check if already running
    if (this.runningJobs.has(jobId)) {
      console.log(`⏳ Job ${jobId} is already running, skipping execution`);
      return;
    }

    // Check concurrent job limit
    if (this.runningJobs.size >= this.maxConcurrentJobs) {
      console.log(`🚫 Max concurrent jobs (${this.maxConcurrentJobs}) reached, queuing job ${jobId}`);
      await this.queueJob(jobId);
      return;
    }

    try {
      // Get job details
      const job = await prisma.refinementJob.findUnique({
        where: { id: jobId }
      });

      if (!job) {
        console.error(`❌ Job ${jobId} not found`);
        return;
      }

      // Check if job should be retried
      if (job.status === JobStatus.RETRYING) {
        if (job.nextRetryAt && new Date() < job.nextRetryAt) {
          console.log(`⏸️ Job ${jobId} retry scheduled for ${job.nextRetryAt}`);
          return;
        }
      }

      const executionContext: JobExecutionContext = {
        job,
        executionId: `${jobId}_${Date.now()}`,
        startTime: new Date(),
        retryAttempt: job.retryCount
      };

      // Mark as running
      this.runningJobs.set(jobId, executionContext);

      console.log(`🚀 Starting job execution: ${job.jobName} [${executionContext.executionId}]`);

      // Update job status to running
      await prisma.refinementJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.RUNNING,
          startedAt: new Date()
        }
      });

      // Execute job based on type
      await this.executeJobByType(executionContext);

    } catch (error) {
      console.error(`❌ Job execution failed for ${jobId}:`, error);
      await this.handleJobFailure(jobId, error);
    } finally {
      // Remove from running jobs
      this.runningJobs.delete(jobId);
      
      // Process next job in queue
      this.processJobQueue();
    }
  }

  /**
   * Execute job based on its type
   */
  private async executeJobByType(context: JobExecutionContext): Promise<void> {
    const { job } = context;

    try {
      switch (job.jobType) {
        case JobType.SCHEDULED_BATCH:
          await this.executeScheduledBatchJob(context);
          break;
        
        case JobType.RANGE_BASED:
          await this.executeRangeBasedJob(context);
          break;
        
        case JobType.CLEANUP:
          await this.executeCleanupJob(context);
          break;
        
        case JobType.HEALTH_CHECK:
          await this.executeHealthCheckJob(context);
          break;
        
        case JobType.MANUAL:
          await this.executeManualJob(context);
          break;
        
        default:
          throw new Error(`Unknown job type: ${job.jobType}`);
      }

      // Mark job as completed
      await this.completeJob(context);

    } catch (error) {
      await this.handleJobFailure(job.id, error);
      throw error;
    }
  }

  /**
   * Execute scheduled batch job (process files on schedule)
   */
  private async executeScheduledBatchJob(context: JobExecutionContext): Promise<void> {
    const { job } = context;
    
    console.log(`📦 Executing scheduled batch job: ${job.jobName}`);

    // Get configuration for what files to process
    const config = job.metadata as any || {};
    const startFileId = config.startFileId || job.startFileId || 1000;
    const endFileId = config.endFileId || job.endFileId || 900;
    const batchSize = job.batchSize;

    // Import and execute batch processor
    const { container } = await import('../core/container');
    const { batchProcessor } = container.getServices();

    const result = await batchProcessor.processByFileRange({
      startFileId,
      endFileId,
      batchSize,
      priority: job.priority,
      jobName: job.jobName
    });

    console.log(`✅ Scheduled batch job completed: ${result.successfulFiles}/${result.totalFiles} files processed`);
  }

  /**
   * Execute range-based job (process specific file range)
   */
  private async executeRangeBasedJob(context: JobExecutionContext): Promise<void> {
    const { job } = context;
    
    console.log(`🎯 Executing range-based job: ${job.jobName}`);

    if (!job.startFileId || !job.endFileId) {
      throw new Error('Range-based job requires startFileId and endFileId');
    }

    const { container } = await import('../core/container');
    const { batchProcessor } = container.getServices();

    const result = await batchProcessor.processByFileRange({
      startFileId: job.startFileId,
      endFileId: job.endFileId,
      batchSize: job.batchSize,
      priority: job.priority,
      jobName: job.jobName
    });

    console.log(`✅ Range-based job completed: ${result.successfulFiles}/${result.totalFiles} files processed`);
  }

  /**
   * Execute cleanup job (clean old logs and data)
   */
  private async executeCleanupJob(context: JobExecutionContext): Promise<void> {
    const { job } = context;
    
    console.log(`🗑️ Executing cleanup job: ${job.jobName}`);

    const config = job.metadata as any || {};
    const retentionDays = config.retentionDays || 30;

    // Cleanup old processing logs
    const deletedLogs = await prisma.fileProcessingLog.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
        }
      }
    });

    // Cleanup old batch statistics
    const deletedStats = await prisma.batchStatistic.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
        }
      }
    });

    // Cleanup old completed jobs
    const deletedJobs = await prisma.refinementJob.deleteMany({
      where: {
        status: JobStatus.COMPLETED,
        completedAt: {
          lt: new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
        }
      }
    });

    console.log(`✅ Cleanup completed: ${deletedLogs.count} logs, ${deletedStats.count} stats, ${deletedJobs.count} jobs deleted`);
  }

  /**
   * Execute health check job (monitor system health)
   */
  private async executeHealthCheckJob(context: JobExecutionContext): Promise<void> {
    const { job } = context;
    
    console.log(`🏥 Executing health check job: ${job.jobName}`);

    const healthReport = {
      timestamp: new Date(),
      database: { status: 'unknown' as string },
      services: { status: 'unknown' as string } as any,
      jobs: { status: 'unknown' as string } as any,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;
      healthReport.database.status = 'healthy';
    } catch (error) {
      healthReport.database.status = 'unhealthy';
      console.error('❌ Database health check failed:', error);
    }

    try {
      // Check container services
      const { container } = await import('../core/container');
      const containerHealth = await container.healthCheck();
      healthReport.services = containerHealth;
    } catch (error) {
      healthReport.services.status = 'unhealthy';
      console.error('❌ Services health check failed:', error);
    }

    try {
      // Check job queue health
      const runningJobs = this.runningJobs.size;
      const scheduledJobs = this.scheduledJobs.size;
      
      healthReport.jobs = {
        status: 'healthy',
        running: runningJobs,
        scheduled: scheduledJobs,
        maxConcurrent: this.maxConcurrentJobs
      };
    } catch (error) {
      healthReport.jobs.status = 'unhealthy';
      console.error('❌ Jobs health check failed:', error);
    }

    // Update job metadata with health report
    await prisma.refinementJob.update({
      where: { id: job.id },
      data: {
        metadata: {
          ...(job.metadata as any || {}),
          lastHealthReport: healthReport
        }
      }
    });

    const overallStatus = Object.values(healthReport).every(
      check => typeof check === 'object' && check !== null && check.status === 'healthy'
    ) ? 'healthy' : 'issues-detected';

    console.log(`✅ Health check completed: ${overallStatus}`);
  }

  /**
   * Execute manual job (one-time execution)
   */
  private async executeManualJob(context: JobExecutionContext): Promise<void> {
    const { job } = context;
    
    console.log(`👤 Executing manual job: ${job.jobName}`);

    // Manual jobs can be any type, use metadata to determine execution
    const config = job.metadata as any || {};
    
    if (config.executionType === 'range') {
      await this.executeRangeBasedJob(context);
    } else if (config.executionType === 'cleanup') {
      await this.executeCleanupJob(context);
    } else if (config.executionType === 'health-check') {
      await this.executeHealthCheckJob(context);
    } else {
      // Default to batch processing
      await this.executeScheduledBatchJob(context);
    }
  }

  /**
   * Complete a job successfully
   */
  private async completeJob(context: JobExecutionContext): Promise<void> {
    const { job, startTime } = context;
    const executionTime = Date.now() - startTime.getTime();

    await prisma.refinementJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        retryCount: 0, // Reset retry count on success
        nextRetryAt: null
      }
    });

    console.log(`✅ Job completed successfully: ${job.jobName} (${executionTime}ms)`);
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(jobId: string, error: any): Promise<void> {
    try {
      const job = await prisma.refinementJob.findUnique({
        where: { id: jobId }
      });

      if (!job) {
        console.error(`❌ Cannot handle failure for job ${jobId} - job not found`);
        return;
      }

      const newRetryCount = job.retryCount + 1;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (newRetryCount <= job.maxRetries) {
        // Calculate next retry time with exponential backoff
        const baseDelay = job.retryDelaySeconds;
        const exponentialDelay = baseDelay * Math.pow(this.retryMultiplier, newRetryCount - 1);
        const delaySeconds = Math.min(exponentialDelay, this.maxRetryDelaySeconds);
        const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

        await prisma.refinementJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.RETRYING,
            retryCount: newRetryCount,
            nextRetryAt,
            errorMessage
          }
        });

        console.log(`🔄 Job ${job.jobName} will retry in ${delaySeconds}s (attempt ${newRetryCount}/${job.maxRetries})`);
      } else {
        // Max retries exceeded, mark as failed
        await prisma.refinementJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            errorMessage
          }
        });

        console.error(`❌ Job ${job.jobName} failed after ${job.maxRetries} retries: ${errorMessage}`);
      }
    } catch (dbError) {
      console.error(`❌ Failed to handle job failure for ${jobId}:`, dbError);
    }
  }

  /**
   * Queue a job for later execution
   */
  private async queueJob(jobId: string): Promise<void> {
    // For now, just schedule it to run again in 1 minute
    setTimeout(() => {
      this.executeJob(jobId);
    }, 60000);
  }

  /**
   * Process queued jobs when slots become available
   */
  private processJobQueue(): void {
    // This would be enhanced with a proper queue implementation
    // For now, it's handled by the setTimeout in queueJob
  }

  /**
   * Load scheduled jobs from database on startup
   */
  private async loadScheduledJobs(): Promise<void> {
    const scheduledJobs = await prisma.refinementJob.findMany({
      where: {
        cronSchedule: {
          not: null
        },
        status: {
          not: JobStatus.CANCELLED
        }
      }
    });

    for (const job of scheduledJobs) {
      try {
        await this.scheduleJob(job);
      } catch (error) {
        console.error(`❌ Failed to load scheduled job ${job.id}:`, error);
      }
    }

    console.log(`📅 Loaded ${scheduledJobs.length} scheduled jobs`);
  }

  /**
   * Schedule system maintenance jobs
   */
  private async scheduleSystemJobs(): Promise<void> {
    // Health check every 30 minutes
    await this.createScheduledJob({
      jobName: 'system-health-check',
      jobType: JobType.HEALTH_CHECK,
      cronSchedule: '*/30 * * * *',
      priority: 1,
      metadata: { type: 'system', automated: true }
    });

    // Cleanup every Sunday at 2 AM
    await this.createScheduledJob({
      jobName: 'weekly-cleanup',
      jobType: JobType.CLEANUP,
      cronSchedule: '0 2 * * 0',
      priority: 2,
      metadata: { 
        type: 'system', 
        automated: true,
        retentionDays: 30 
      }
    });

    console.log('🔧 System maintenance jobs scheduled');
  }

  /**
   * Start job queue processor
   */
  private startJobQueueProcessor(): void {
    // Check for jobs to retry every minute
    setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        const jobsToRetry = await prisma.refinementJob.findMany({
          where: {
            status: JobStatus.RETRYING,
            nextRetryAt: {
              lte: new Date()
            }
          },
          take: 10
        });

        for (const job of jobsToRetry) {
          this.executeJob(job.id);
        }
      } catch (error) {
        console.error('❌ Error in job queue processor:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Get scheduler status and statistics
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    scheduledJobs: number;
    runningJobs: number;
    maxConcurrentJobs: number;
    recentJobs: any[];
  }> {
    const recentJobs = await prisma.refinementJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        jobName: true,
        jobType: true,
        status: true,
        createdAt: true,
        startedAt: true,
        completedAt: true
      }
    });

    return {
      isRunning: !this.isShuttingDown,
      scheduledJobs: this.scheduledJobs.size,
      runningJobs: this.runningJobs.size,
      maxConcurrentJobs: this.maxConcurrentJobs,
      recentJobs
    };
  }

  /**
   * Stop a scheduled job
   */
  async stopScheduledJob(jobId: string): Promise<void> {
    const task = this.scheduledJobs.get(jobId);
    if (task) {
      task.stop();
      this.scheduledJobs.delete(jobId);
      
      await prisma.refinementJob.update({
        where: { id: jobId },
        data: { status: JobStatus.CANCELLED }
      });

      console.log(`⏹️ Stopped scheduled job: ${jobId}`);
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.log('🛑 Gracefully shutting down Job Scheduler...');
      this.isShuttingDown = true;

      // Stop all scheduled jobs
      for (const [jobId, task] of this.scheduledJobs) {
        task.stop();
        console.log(`⏹️ Stopped scheduled job: ${jobId}`);
      }

      // Wait for running jobs to complete
      let waitCount = 0;
      while (this.runningJobs.size > 0 && waitCount < 30) {
        console.log(`⏳ Waiting for ${this.runningJobs.size} running jobs to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitCount++;
      }

      console.log('✅ Job Scheduler shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(jobId: string): Promise<void> {
    console.log(`👤 Manually triggering job: ${jobId}`);
    await this.executeJob(jobId);
  }
} 