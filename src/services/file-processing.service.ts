/**
 * File Processing Service
 * Handles individual file processing and logging
 */

import { prisma } from '@/database/client';
import {
  FileProcessingLog,
  ProcessingStatus,
  ProcessingQueue,
  QueueStatus
} from '@/generated/prisma';
import { logger, LogContext } from './logging.service';

export interface ProcessFileParams {
  jobId: string;
  fileId: number;
  ipfsHash?: string;
  gasUsed?: bigint;
  transactionHash?: string;
  refinementApiResponse?: object;
  processingTimeMs?: number;
}

export interface ProcessFileError {
  jobId: string;
  fileId: number;
  errorMessage: string;
  errorDetails?: object;
  processingTimeMs?: number;
}

export class FileProcessingService {
  /**
   * Start processing a file
   */
  async startProcessing(jobId: string, fileId: number): Promise<FileProcessingLog> {
    // Update queue status
    await this.updateQueueStatus(jobId, fileId, QueueStatus.PROCESSING);

    // Create processing log
    const log = await prisma.fileProcessingLog.create({
      data: {
        jobId,
        fileId,
        status: ProcessingStatus.PROCESSING,
        message: 'Starting file processing',
        createdAt: new Date()
      }
    });

    const logContext: LogContext = {
      jobId,
      fileId,
      operation: 'file-processing'
    };

    logger.info('Started processing file', logContext, 'FileProcessor');
    return log;
  }

  /**
   * Log successful file processing
   */
  async logSuccess(params: ProcessFileParams): Promise<FileProcessingLog> {
    // Update queue status
    await this.updateQueueStatus(params.jobId, params.fileId, QueueStatus.COMPLETED);

    // Find existing log
    const existingLog = await prisma.fileProcessingLog.findFirst({
      where: {
        jobId: params.jobId,
        fileId: params.fileId
      }
    });

    if (!existingLog) {
      throw new Error(`No processing log found for job ${params.jobId}, file ${params.fileId}`);
    }

    // Update processing log
    const log = await prisma.fileProcessingLog.update({
      where: {
        id: existingLog.id
      },
      data: {
        status: ProcessingStatus.SUCCESS,
        message: 'File processed successfully',
        ipfsHash: params.ipfsHash,
        gasUsed: params.gasUsed,
        transactionHash: params.transactionHash,
        refinementApiResponse: params.refinementApiResponse,
        processingTimeMs: params.processingTimeMs,
        processedAt: new Date()
      }
    });

    const logContext: LogContext = {
      jobId: params.jobId,
      fileId: params.fileId,
      duration: params.processingTimeMs,
      operation: 'file-processing'
    };

    logger.info('Successfully processed file', logContext, 'FileProcessor');
    return log;
  }

  /**
   * Log file processing failure
   */
  async logFailure(params: ProcessFileError): Promise<FileProcessingLog> {
    // Update queue status
    await this.updateQueueStatus(params.jobId, params.fileId, QueueStatus.FAILED);

    // Find existing log
    const existingLog = await prisma.fileProcessingLog.findFirst({
      where: {
        jobId: params.jobId,
        fileId: params.fileId
      }
    });

    if (!existingLog) {
      throw new Error(`No processing log found for job ${params.jobId}, file ${params.fileId}`);
    }

    // Update processing log
    const log = await prisma.fileProcessingLog.update({
      where: {
        id: existingLog.id
      },
      data: {
        status: ProcessingStatus.FAILED,
        message: params.errorMessage,
        errorDetails: params.errorDetails,
        processingTimeMs: params.processingTimeMs,
        processedAt: new Date()
      }
    });

    const logContext: LogContext = {
      jobId: params.jobId,
      fileId: params.fileId,
      duration: params.processingTimeMs,
      errorCode: 'PROCESSING_FAILED',
      operation: 'file-processing'
    };

    logger.error('Failed to process file', new Error(params.errorMessage), logContext, 'FileProcessor');
    return log;
  }

  /**
   * Log skipped file (already refined)
   */
  async logSkipped(jobId: string, fileId: number, reason: string): Promise<FileProcessingLog> {
    // Update queue status
    await this.updateQueueStatus(jobId, fileId, QueueStatus.COMPLETED);

    // Check if log already exists
    const existingLog = await prisma.fileProcessingLog.findFirst({
      where: {
        jobId,
        fileId
      }
    });

    const logContext: LogContext = {
      jobId,
      fileId,
      operation: 'file-processing'
    };

    if (existingLog) {
      // Update existing log
      const newStatus = reason.includes('already been refined') ? ProcessingStatus.ALREADY_REFINED : ProcessingStatus.SKIPPED;
      const log = await prisma.fileProcessingLog.update({
        where: { id: existingLog.id },
        data: {
          status: newStatus,
          message: reason,
          processedAt: new Date()
        }
      });
      logger.info(`Skipped file: ${reason}`, logContext, 'FileProcessor');
      return log;
    } else {
      // Create new log
      const log = await prisma.fileProcessingLog.create({
        data: {
          jobId,
          fileId,
          status: ProcessingStatus.SKIPPED,
          message: reason,
          processedAt: new Date()
        }
      });
      logger.info(`Skipped file: ${reason}`, logContext, 'FileProcessor');
      return log;
    }
  }

  /**
   * Get processing logs for a job
   */
  async getJobLogs(jobId: string): Promise<FileProcessingLog[]> {
    return await prisma.fileProcessingLog.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get failed files for retry
   */
  async getFailedFiles(jobId: string): Promise<FileProcessingLog[]> {
    return await prisma.fileProcessingLog.findMany({
      where: {
        jobId,
        status: ProcessingStatus.FAILED
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Update queue status
   */
  private async updateQueueStatus(
    jobId: string,
    fileId: number,
    status: QueueStatus
  ): Promise<void> {
    try {
      await prisma.processingQueue.updateMany({
        where: {
          jobId,
          fileId
        },
        data: {
          status,
          ...(status === QueueStatus.PROCESSING && { startedAt: new Date() }),
          ...(status === QueueStatus.COMPLETED && { completedAt: new Date() })
        }
      });
    } catch (error) {
      console.warn(`Warning: Could not update queue status for file ${fileId}:`, error);
    }
  }

  /**
   * Create processing queue entries for a job
   */
  async createQueueEntries(
    jobId: string,
    fileIds: number[],
    priority: number = 5
  ): Promise<void> {
    const queueEntries = fileIds.map((fileId, index) => ({
      jobId,
      fileId,
      queuePosition: index + 1,
      status: QueueStatus.QUEUED,
      priority,
      scheduledAt: new Date()
    }));

    await prisma.processingQueue.createMany({
      data: queueEntries,
      skipDuplicates: true
    });

    const logContext: LogContext = {
      jobId,
      metadata: { queueEntries: queueEntries.length },
      operation: 'queue-management'
    };

    logger.info(`Created ${queueEntries.length} queue entries for job`, logContext, 'FileProcessor');
  }

  /**
   * Get next files to process from queue
   */
  async getNextFilesToProcess(limit: number = 10): Promise<ProcessingQueue[]> {
    return await prisma.processingQueue.findMany({
      where: {
        status: QueueStatus.QUEUED,
        refinementJob: {
          status: 'RUNNING'
        }
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledAt: 'asc' }
      ],
      take: limit,
      include: {
        refinementJob: true
      }
    });
  }
}
