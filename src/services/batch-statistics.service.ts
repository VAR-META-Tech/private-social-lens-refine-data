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
  async getPerformanceMetrics(
    jobIdOrStartDate?: string | Date, 
    endDate?: Date, 
    granularity?: string
  ): Promise<any> {
    // Legacy single parameter call (jobId)
    if (typeof jobIdOrStartDate === 'string' || jobIdOrStartDate === undefined) {
      const jobId = jobIdOrStartDate as string | undefined;
      const where: any = {};
      if (jobId) {
        where.jobId = jobId;
      }

      const stats = await prisma.batchStatistic.aggregate({
        where,
        _sum: {
          processedCount: true,
          successCount: true,
          failedCount: true,
          totalProcessingTimeMs: true,
          totalGasUsed: true
        },
        _avg: {
          averageProcessingTimeMs: true
        },
        _count: {
          id: true
        }
      });

      const totalJobs = stats._count.id || 0;
      const totalFilesProcessed = stats._sum.processedCount || 0;
      const totalSuccessful = stats._sum.successCount || 0;
      const totalFailed = stats._sum.failedCount || 0;
      const averageProcessingTime = stats._avg.averageProcessingTimeMs || 0;
      const totalGasUsed = stats._sum.totalGasUsed?.toString() || '0';

      return {
        totalJobs,
        totalFilesProcessed,
        totalSuccessful,
        totalFailed,
        averageProcessingTime,
        totalGasUsed,
        successRate: totalFilesProcessed > 0 ? (totalSuccessful / totalFilesProcessed) * 100 : 0
      };
    }

    // New three parameter call (startDate, endDate, granularity)
    const startDate = jobIdOrStartDate as Date;
    const granularityValue = granularity || 'daily';
    const endDateValue = endDate || new Date();

    // Create date truncation based on granularity
    let dateTrunc: string;
    switch (granularityValue) {
      case 'hourly':
        dateTrunc = 'hour';
        break;
      case 'daily':
        dateTrunc = 'day';
        break;
      case 'weekly':
        dateTrunc = 'week';
        break;
      default:
        dateTrunc = 'day';
    }

    const result = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${dateTrunc}, b.batch_start_time) as period,
        SUM(b.processed_count) as total_processed,
        SUM(b.success_count) as total_success,
        SUM(b.failed_count) as total_failed,
        AVG(b.average_processing_time_ms) as avg_processing_time,
        SUM(b.total_gas_used) as total_gas
      FROM batch_statistics b
      INNER JOIN refinement_jobs j ON b.job_id = j.id
      WHERE j.created_at >= ${startDate} AND j.created_at <= ${endDateValue}
      GROUP BY DATE_TRUNC(${dateTrunc}, b.batch_start_time)
      ORDER BY period ASC
    `;

    return result;
  }

  /**
   * Get processing statistics since a date
   */
  async getProcessingStatistics(since: Date): Promise<{
    totalFiles: number;
    successFiles: number;
    failedFiles: number;
    averageProcessingTime: number;
  }> {
    const stats = await prisma.fileProcessingLog.aggregate({
      where: {
        createdAt: { gte: since }
      },
      _count: {
        id: true
      },
      _avg: {
        processingTimeMs: true
      }
    });

    const statusCounts = await prisma.fileProcessingLog.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: since }
      },
      _count: {
        status: true
      }
    });

    const totalFiles = stats._count.id || 0;
    const successFiles = statusCounts.find(s => s.status === 'SUCCESS')?._count.status || 0;
    const failedFiles = statusCounts.find(s => s.status === 'FAILED')?._count.status || 0;
    const averageProcessingTime = stats._avg.processingTimeMs || 0;

    return {
      totalFiles,
      successFiles,
      failedFiles,
      averageProcessingTime
    };
  }

  /**
   * Get performance statistics since a date
   */
  async getPerformanceStatistics(since: Date): Promise<{
    totalGasUsed: bigint;
    averageGasPerFile: bigint;
    throughputPerHour: number;
    totalProcessingTime: number;
  }> {
    const stats = await prisma.fileProcessingLog.aggregate({
      where: {
        createdAt: { gte: since }
      },
      _sum: {
        gasUsed: true,
        processingTimeMs: true
      },
      _count: {
        id: true
      }
    });

    const totalFiles = stats._count.id || 0;
    const totalGasUsed = stats._sum.gasUsed || BigInt(0);
    const totalProcessingTime = stats._sum.processingTimeMs || 0;
    const hoursSince = (Date.now() - since.getTime()) / (1000 * 60 * 60);

    return {
      totalGasUsed,
      averageGasPerFile: totalFiles > 0 ? totalGasUsed / BigInt(totalFiles) : BigInt(0),
      throughputPerHour: hoursSince > 0 ? totalFiles / hoursSince : 0,
      totalProcessingTime
    };
  }

  /**
   * Get job statistics by period
   */
  async getJobStatisticsByPeriod(startDate: Date, endDate: Date, period: string): Promise<any[]> {
    // Create date truncation based on period
    let dateTrunc: string;
    switch (period) {
      case 'hour':
        dateTrunc = 'hour';
        break;
      case 'day':
        dateTrunc = 'day';
        break;
      case 'week':
        dateTrunc = 'week';
        break;
      case 'month':
        dateTrunc = 'month';
        break;
      default:
        dateTrunc = 'day';
    }

    const result = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${dateTrunc}, created_at) as period,
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_jobs,
        COUNT(CASE WHEN status = 'RUNNING' THEN 1 END) as running_jobs,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_jobs
      FROM refinement_jobs 
      WHERE created_at >= ${startDate} AND created_at <= ${endDate}
      GROUP BY DATE_TRUNC(${dateTrunc}, created_at)
      ORDER BY period ASC
    `;

    return result as any[];
  }

  /**
   * Get file processing statistics
   */
  async getFileProcessingStatistics(startDate: Date, endDate: Date, groupBy: string): Promise<any[]> {
    if (groupBy === 'status') {
          const result = await prisma.fileProcessingLog.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: {
        status: true
      },
      _avg: {
        processingTimeMs: true
      }
    });
    return result as any[];
    } else if (groupBy === 'hour' || groupBy === 'day') {
      const dateTrunc = groupBy === 'hour' ? 'hour' : 'day';
      const result = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC(${dateTrunc}, created_at) as period,
          status,
          COUNT(*) as count,
          AVG(processing_time_ms) as avg_processing_time
        FROM file_processing_logs 
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        GROUP BY DATE_TRUNC(${dateTrunc}, created_at), status
        ORDER BY period ASC, status
      `;
      return result as any[];
    }

    return [];
  }

  /**
   * Get error statistics
   */
  async getErrorStatistics(startDate: Date, endDate: Date, limit: number): Promise<any[]> {
    const result = await prisma.$queryRaw`
      SELECT 
        error_details->>'message' as error_message,
        COUNT(*) as occurrences,
        MAX(created_at) as last_occurrence
      FROM file_processing_logs 
      WHERE created_at >= ${startDate} 
        AND created_at <= ${endDate}
        AND status = 'FAILED'
        AND error_details IS NOT NULL
      GROUP BY error_details->>'message'
      ORDER BY occurrences DESC
      LIMIT ${limit}
    `;

    return result as any[];
  }

  /**
   * Get trend analysis
   */
  async getTrendAnalysis(metric: string, startDate: Date, endDate: Date): Promise<any> {
    let result: any;

    switch (metric) {
      case 'throughput':
        result = await prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('day', created_at) as date,
            COUNT(*) as value
          FROM file_processing_logs 
          WHERE created_at >= ${startDate} AND created_at <= ${endDate}
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY date ASC
        `;
        break;

      case 'success_rate':
        result = await prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('day', created_at) as date,
            (COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) * 100.0 / COUNT(*)) as value
          FROM file_processing_logs 
          WHERE created_at >= ${startDate} AND created_at <= ${endDate}
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY date ASC
        `;
        break;

      case 'processing_time':
        result = await prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('day', created_at) as date,
            AVG(processing_time_ms) as value
          FROM file_processing_logs 
          WHERE created_at >= ${startDate} 
            AND created_at <= ${endDate}
            AND processing_time_ms IS NOT NULL
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY date ASC
        `;
        break;

      case 'gas_usage':
        result = await prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('day', created_at) as date,
            AVG(gas_used) as value
          FROM file_processing_logs 
          WHERE created_at >= ${startDate} 
            AND created_at <= ${endDate}
            AND gas_used IS NOT NULL
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY date ASC
        `;
        break;

      default:
        result = [];
    }

    return {
      metric,
      data: result,
      trend: this.calculateTrend(result as any[])
    };
  }

  /**
   * Export statistics to CSV
   */
  async exportStatistics(type: string, startDate: Date, endDate: Date): Promise<string> {
    let data: any[] = [];
    let headers: string[] = [];

    switch (type) {
      case 'jobs':
        data = await prisma.refinementJob.findMany({
          where: {
            createdAt: { gte: startDate, lte: endDate }
          },
          select: {
            id: true,
            jobName: true,
            jobType: true,
            status: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            batchSize: true,
            priority: true
          }
        });
        headers = ['id', 'jobName', 'jobType', 'status', 'createdAt', 'startedAt', 'completedAt', 'batchSize', 'priority'];
        break;

      case 'processing':
        data = await prisma.fileProcessingLog.findMany({
          where: {
            createdAt: { gte: startDate, lte: endDate }
          },
          select: {
            id: true,
            jobId: true,
            fileId: true,
            status: true,
            processingTimeMs: true,
            gasUsed: true,
            createdAt: true,
            processedAt: true
          }
        });
        headers = ['id', 'jobId', 'fileId', 'status', 'processingTimeMs', 'gasUsed', 'createdAt', 'processedAt'];
        break;

      case 'performance':
        data = await prisma.batchStatistic.findMany({
          where: {
            createdAt: { gte: startDate, lte: endDate }
          }
        });
        headers = ['jobId', 'totalFiles', 'processedCount', 'successCount', 'failedCount', 'averageProcessingTimeMs', 'totalGasUsed', 'batchStartTime', 'batchEndTime'];
        break;

      case 'errors':
        data = await prisma.fileProcessingLog.findMany({
          where: {
            createdAt: { gte: startDate, lte: endDate },
            status: 'FAILED'
          },
          select: {
            id: true,
            jobId: true,
            fileId: true,
            errorDetails: true,
            createdAt: true
          }
        });
        headers = ['id', 'jobId', 'fileId', 'errorDetails', 'createdAt'];
        break;

      default:
        throw new Error(`Unsupported export type: ${type}`);
    }

    return this.convertToCSV(data, headers);
  }

  /**
   * Calculate trend from time series data
   */
  private calculateTrend(data: any[]): { direction: string; change: number } {
    if (data.length < 2) {
      return { direction: 'stable', change: 0 };
    }

    const first = Number(data[0].value) || 0;
    const last = Number(data[data.length - 1].value) || 0;
    const change = last - first;
    const percentChange = first > 0 ? (change / first) * 100 : 0;

    let direction = 'stable';
    if (Math.abs(percentChange) > 5) {
      direction = percentChange > 0 ? 'up' : 'down';
    }

    return { direction, change: percentChange };
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any[], headers: string[]): string {
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => 
      headers.map(header => {
        let value = row[header];
        if (value === null || value === undefined) {
          value = '';
        } else if (typeof value === 'object') {
          value = JSON.stringify(value);
        } else if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value;
      }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  }
} 