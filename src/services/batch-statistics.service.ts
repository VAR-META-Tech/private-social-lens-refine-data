/**
 * Batch Statistics Service
 * Handles batch processing statistics collection and aggregation
 */

import { prisma } from '../database/client';
import { BatchStatistic, ProcessingStatus } from '../generated/prisma';

export interface BatchStatsParams {
  jobId: string;
  batchStartFileId?: number;
  batchEndFileId?: number;
  batchStartIndex?: number;
  batchEndIndex?: number;
  totalFiles: number;
}

export interface BatchStatsUpdate {
  alreadyRefinedCount?: number;
  processedCount?: number;
  successCount?: number;
  failedCount?: number;
  skippedCount?: number;
  totalProcessingTimeMs?: bigint;
  averageProcessingTimeMs?: number;
  totalGasUsed?: bigint;
  batchEndTime?: Date;
}

export class BatchStatisticsService {
  /**
   * Create initial batch statistics
   */
  async createBatchStats(params: BatchStatsParams): Promise<BatchStatistic> {
    const stats = await prisma.batchStatistic.create({
      data: {
        jobId: params.jobId,
        batchStartFileId: params.batchStartFileId,
        batchEndFileId: params.batchEndFileId,
        batchStartIndex: params.batchStartIndex,
        batchEndIndex: params.batchEndIndex,
        totalFiles: params.totalFiles,
        batchStartTime: new Date()
      }
    });

    console.log(`📊 Created batch statistics for job ${params.jobId}`);
    return stats;
  }

  /**
   * Update batch statistics
   */
  async updateBatchStats(jobId: string, updates: BatchStatsUpdate): Promise<BatchStatistic | null> {
    const stats = await prisma.batchStatistic.findFirst({
      where: { jobId }
    });

    if (!stats) {
      console.warn(`No batch statistics found for job ${jobId}`);
      return null;
    }

    const updatedStats = await prisma.batchStatistic.update({
      where: { id: stats.id },
      data: updates
    });

    return updatedStats;
  }

  /**
   * Aggregate statistics from file processing logs
   */
  async aggregateFromLogs(jobId: string): Promise<BatchStatistic | null> {
    // Get processing logs for the job
    const logs = await prisma.fileProcessingLog.findMany({
      where: { jobId },
      select: {
        status: true,
        processingTimeMs: true,
        gasUsed: true
      }
    });

    if (logs.length === 0) {
      console.warn(`No processing logs found for job ${jobId}`);
      return null;
    }

    // Calculate aggregated statistics
    const stats = logs.reduce(
      (acc, log) => {
        switch (log.status) {
          case ProcessingStatus.SUCCESS:
            acc.successCount++;
            acc.processedCount++;
            break;
          case ProcessingStatus.FAILED:
            acc.failedCount++;
            acc.processedCount++;
            break;
          case ProcessingStatus.ALREADY_REFINED:
            acc.alreadyRefinedCount++;
            break;
          case ProcessingStatus.SKIPPED:
            acc.skippedCount++;
            break;
        }

        if (log.processingTimeMs) {
          acc.totalProcessingTimeMs += BigInt(log.processingTimeMs);
        }

        if (log.gasUsed) {
          acc.totalGasUsed += log.gasUsed;
        }

        return acc;
      },
      {
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        alreadyRefinedCount: 0,
        skippedCount: 0,
        totalProcessingTimeMs: BigInt(0),
        totalGasUsed: BigInt(0)
      }
    );

    // Calculate average processing time
    const averageProcessingTimeMs = stats.processedCount > 0 
      ? Number(stats.totalProcessingTimeMs) / stats.processedCount 
      : 0;

    // Update batch statistics
    const updatedStats = await this.updateBatchStats(jobId, {
      processedCount: stats.processedCount,
      successCount: stats.successCount,
      failedCount: stats.failedCount,
      alreadyRefinedCount: stats.alreadyRefinedCount,
      skippedCount: stats.skippedCount,
      totalProcessingTimeMs: stats.totalProcessingTimeMs,
      averageProcessingTimeMs: Math.round(averageProcessingTimeMs),
      totalGasUsed: stats.totalGasUsed,
      batchEndTime: new Date()
    });

    console.log(`📈 Aggregated statistics for job ${jobId}:`, {
      processed: stats.processedCount,
      success: stats.successCount,
      failed: stats.failedCount,
      alreadyRefined: stats.alreadyRefinedCount,
      skipped: stats.skippedCount,
      avgTime: Math.round(averageProcessingTimeMs),
      totalGas: stats.totalGasUsed.toString()
    });

    return updatedStats;
  }

  /**
   * Get batch statistics for a job
   */
  async getBatchStats(jobId: string): Promise<BatchStatistic | null> {
    return await prisma.batchStatistic.findFirst({
      where: { jobId },
      include: {
        refinementJob: {
          select: {
            jobName: true,
            jobType: true,
            status: true,
            createdAt: true,
            startedAt: true,
            completedAt: true
          }
        }
      }
    });
  }

  /**
   * Get statistics for multiple jobs
   */
  async getJobsStats(jobIds: string[]): Promise<BatchStatistic[]> {
    return await prisma.batchStatistic.findMany({
      where: {
        jobId: { in: jobIds }
      },
      include: {
        refinementJob: {
          select: {
            jobName: true,
            jobType: true,
            status: true,
            createdAt: true,
            startedAt: true,
            completedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get recent batch statistics
   */
  async getRecentStats(limit: number = 10): Promise<BatchStatistic[]> {
    return await prisma.batchStatistic.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        refinementJob: {
          select: {
            jobName: true,
            jobType: true,
            status: true,
            createdAt: true,
            startedAt: true,
            completedAt: true
          }
        }
      }
    });
  }

  /**
   * Get processing performance metrics
   */
  async getPerformanceMetrics(jobId?: string): Promise<{
    totalJobs: number;
    totalFilesProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
    averageProcessingTime: number;
    totalGasUsed: string;
    successRate: number;
  }> {
    const where = jobId ? { jobId } : {};
    
    const stats = await prisma.batchStatistic.aggregate({
      where,
      _count: { id: true },
      _sum: {
        processedCount: true,
        successCount: true,
        failedCount: true,
        totalGasUsed: true,
        totalProcessingTimeMs: true
      },
      _avg: {
        averageProcessingTimeMs: true
      }
    });

    const totalJobs = stats._count.id || 0;
    const totalFilesProcessed = stats._sum.processedCount || 0;
    const totalSuccessful = stats._sum.successCount || 0;
    const totalFailed = stats._sum.failedCount || 0;
    const averageProcessingTime = Math.round(stats._avg.averageProcessingTimeMs || 0);
    const totalGasUsed = (stats._sum.totalGasUsed || BigInt(0)).toString();
    const successRate = totalFilesProcessed > 0 
      ? Math.round((totalSuccessful / totalFilesProcessed) * 100 * 100) / 100 
      : 0;

    return {
      totalJobs,
      totalFilesProcessed,
      totalSuccessful,
      totalFailed,
      averageProcessingTime,
      totalGasUsed,
      successRate
    };
  }
} 