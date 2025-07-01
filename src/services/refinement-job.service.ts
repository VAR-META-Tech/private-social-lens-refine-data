/**
 * Refinement Job Service
 * Handles business logic for refinement jobs
 */

import { prisma } from '@/database/client';
import {
  RefinementJob,
  JobStatus,
  JobType,
} from '@/generated/prisma';

export interface CreateJobParams {
  jobName: string;
  jobType: JobType;
  cronSchedule?: string;
  startFileId?: number;
  endFileId?: number;
  batchSize?: number;
  priority?: number;
  metadata?: object;
  createdBy?: string;
}

export interface JobStatistics {
  totalFiles: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  alreadyRefinedCount: number;
  skippedCount: number;
  averageProcessingTimeMs: number;
  totalGasUsed: bigint;
}

export class RefinementJobService {
  /**
   * Create a new refinement job
   */
  async createJob(params: CreateJobParams): Promise<RefinementJob> {
    const job = await prisma.refinementJob.create({
      data: {
        jobName: params.jobName,
        jobType: params.jobType,
        cronSchedule: params.cronSchedule,
        startFileId: params.startFileId,
        endFileId: params.endFileId,
        batchSize: params.batchSize || 10,
        priority: params.priority || 5,
        metadata: params.metadata,
        createdBy: params.createdBy || 'system',
        status: JobStatus.PENDING
      }
    });

    console.log(`✅ Created refinement job: ${job.jobName} (ID: ${job.id})`);
    return job;
  }

  /**
   * Start a job
   */
  async startJob(jobId: string): Promise<RefinementJob> {
    const job = await prisma.refinementJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.RUNNING,
        startedAt: new Date()
      }
    });

    console.log(`🚀 Started job: ${job.jobName} (ID: ${job.id})`);
    return job;
  }

  /**
   * Complete a job
   */
  async completeJob(jobId: string, success: boolean = true): Promise<RefinementJob> {
    const status = success ? JobStatus.COMPLETED : JobStatus.FAILED;

    const job = await prisma.refinementJob.update({
      where: { id: jobId },
      data: {
        status,
        completedAt: new Date()
      }
    });

    console.log(`✅ Completed job: ${job.jobName} (Status: ${status})`);
    return job;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<RefinementJob | null> {
    return await prisma.refinementJob.findUnique({
      where: { id: jobId },
      include: {
        fileProcessingLogs: true,
        batchStatistics: true,
        processingQueue: true
      }
    });
  }

  /**
   * Get running jobs
   */
  async getRunningJobs(): Promise<RefinementJob[]> {
    return await prisma.refinementJob.findMany({
      where: { status: JobStatus.RUNNING },
      orderBy: [
        { priority: 'desc' },
        { startedAt: 'asc' }
      ]
    });
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(jobId: string): Promise<JobStatistics | null> {
    const batchStats = await prisma.batchStatistic.findFirst({
      where: { jobId }
    });

    if (!batchStats) {
      return null;
    }

    return {
      totalFiles: batchStats.totalFiles,
      processedCount: batchStats.processedCount,
      successCount: batchStats.successCount,
      failedCount: batchStats.failedCount,
      alreadyRefinedCount: batchStats.alreadyRefinedCount,
      skippedCount: batchStats.skippedCount,
      averageProcessingTimeMs: batchStats.averageProcessingTimeMs,
      totalGasUsed: batchStats.totalGasUsed
    };
  }

  /**
   * Update job retry count
   */
  async incrementRetryCount(jobId: string): Promise<RefinementJob> {
    return await prisma.refinementJob.update({
      where: { id: jobId },
      data: {
        retryCount: { increment: 1 },
        status: JobStatus.RETRYING,
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
      }
    });
  }

  /**
   * Set job error
   */
  async setJobError(jobId: string, errorMessage: string): Promise<RefinementJob> {
    return await prisma.refinementJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        errorMessage,
        completedAt: new Date()
      }
    });
  }
}
