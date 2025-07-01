/**
 * Batch Processor
 * Core business logic for batch refinement processing
 * Replaces the original processor.js with service-based architecture
 */

import { container } from './container';
import { JobType } from '@/generated/prisma';
import { getFilePermissions, decryptEEK, checkFileRefinement } from '@/services';
import { refineFile } from '@/services';

export interface BatchProcessorConfig {
  startFileId?: number;
  endFileId?: number;
  startIndex?: number;
  endIndex?: number;
  batchSize?: number;
  priority?: number;
  jobName?: string;
  metadata?: object;
}

export interface ProcessingResult {
  jobId: string;
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  failedFiles: number;
  alreadyRefinedFiles: number;
  skippedFiles: number;
  processingTimeMs: number;
  success: boolean;
}

export class BatchProcessor {
  /**
   * Process batch by file ID range
   */
  async processByFileRange(config: BatchProcessorConfig): Promise<ProcessingResult> {
    const startTime = Date.now();

    if (!config.startFileId || !config.endFileId) {
      throw new Error('startFileId and endFileId are required for file range processing');
    }

    console.log(`🔄 Starting batch processing: Files ${config.startFileId} to ${config.endFileId}`);

         // Get services
     const { refinementJobService, fileProcessingService, batchStatisticsService, hybridConfigService } = container.getServices();

     // Get configuration from hybrid config service
     const processingConfig = await hybridConfigService.getProcessingConfig();

    // Override with provided config - ensure numbers are properly typed
    const batchSize = config.batchSize || Number(processingConfig.batchSize);
    const priority = config.priority || Number(processingConfig.defaultPriority);

    // Create refinement job
    const job = await refinementJobService.createJob({
      jobName: config.jobName || `batch-refinement-${config.startFileId}-${config.endFileId}`,
      jobType: JobType.RANGE_BASED,
      startFileId: config.startFileId,
      endFileId: config.endFileId,
      batchSize,
      priority,
      metadata: config.metadata
    });

    try {
      // Start the job
      await refinementJobService.startJob(job.id);

      // Generate file IDs to process (descending order)
      const fileIds: number[] = [];
      for (let id = config.startFileId; id >= config.endFileId; id--) {
        fileIds.push(id);
      }

      // Create processing queue
      await fileProcessingService.createQueueEntries(job.id, fileIds, priority);

      // Create batch statistics
      await batchStatisticsService.createBatchStats({
        jobId: job.id,
        batchStartFileId: config.startFileId,
        batchEndFileId: config.endFileId,
        totalFiles: fileIds.length
      });

      // Process files in batches
      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;
      let alreadyRefinedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < fileIds.length; i += batchSize) {
        const batchFileIds = fileIds.slice(i, i + batchSize);

        // Process batch in parallel
        const batchResults = await Promise.allSettled(
          batchFileIds.map(fileId => this.processFile(job.id, fileId))
        );

        // Count results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            switch (result.value.status) {
              case 'success':
                successCount++;
                processedCount++;
                break;
              case 'failed':
                failedCount++;
                processedCount++;
                break;
              case 'already_refined':
                alreadyRefinedCount++;
                break;
              case 'skipped':
                skippedCount++;
                break;
            }
          } else {
            failedCount++;
            processedCount++;
          }
        }

        console.log(`📊 Batch ${Math.floor(i / batchSize) + 1} completed: ${batchFileIds.length} files processed`);
      }

      // Aggregate final statistics
      await batchStatisticsService.aggregateFromLogs(job.id);

      // Complete the job
      await refinementJobService.completeJob(job.id, true);

      const processingTimeMs = Date.now() - startTime;

      console.log(`✅ Batch processing completed successfully in ${processingTimeMs}ms`);
      console.log(`📈 Results: ${successCount} success, ${failedCount} failed, ${alreadyRefinedCount} already refined, ${skippedCount} skipped`);

      return {
        jobId: job.id,
        totalFiles: fileIds.length,
        processedFiles: processedCount,
        successfulFiles: successCount,
        failedFiles: failedCount,
        alreadyRefinedFiles: alreadyRefinedCount,
        skippedFiles: skippedCount,
        processingTimeMs,
        success: true
      };

    } catch (error) {
      console.error(`❌ Batch processing failed:`, error);

      // Mark job as failed
      await refinementJobService.setJobError(job.id, error instanceof Error ? error.message : 'Unknown error');

      // Aggregate partial statistics
      await batchStatisticsService.aggregateFromLogs(job.id);

      throw error;
    }
  }

  /**
   * Process batch by index range
   */
  async processByIndexRange(config: BatchProcessorConfig): Promise<ProcessingResult> {
    if (!config.startIndex || !config.endIndex) {
      throw new Error('startIndex and endIndex are required for index range processing');
    }

    console.log(`🔄 Starting batch processing: Indices ${config.startIndex} to ${config.endIndex}`);

    // This would need blockchain integration to get file IDs from indices
    // For now, we'll throw an error to indicate this needs implementation
    throw new Error('Index-based processing not yet implemented. Please use file ID range processing.');
  }

  /**
   * Process a single file
   */
  private async processFile(jobId: string, fileId: number): Promise<{
    fileId: number;
    status: 'success' | 'failed' | 'already_refined' | 'skipped';
    message: string;
    processingTimeMs?: number;
  }> {
    const startTime = Date.now();
    const { fileProcessingService } = container.getServices();

    try {
      // Start processing log
      await fileProcessingService.startProcessing(jobId, fileId);

      console.log(`🔍 Checking file ${fileId}...`);

      // Step 1: Check if the file has an EEK
      const encryptedEEK = await getFilePermissions(fileId);

      if (!encryptedEEK) {
        await fileProcessingService.logSkipped(jobId, fileId, 'File has no EEK or does not exist');
        return {
          fileId,
          status: 'skipped',
          message: 'File has no EEK or does not exist'
        };
      }

      // Step 2: Check if already refined
      const isAlreadyRefined = await checkFileRefinement(fileId);
      if (isAlreadyRefined) {
        await fileProcessingService.logSkipped(jobId, fileId, 'File has already been refined');
        return {
          fileId,
          status: 'already_refined',
          message: 'File has already been refined'
        };
      }

      console.log(`🔑 Found file ${fileId} with EEK - needs refinement`);

      // Step 3: Decrypt the EEK
      const dataEncryptionKey = await decryptEEK(encryptedEEK, fileId);
      if (!dataEncryptionKey) {
        const processingTimeMs = Date.now() - startTime;
        await fileProcessingService.logFailure({
          jobId,
          fileId,
          errorMessage: 'Failed to decrypt EEK',
          processingTimeMs
        });
        return {
          fileId,
          status: 'failed',
          message: 'Failed to decrypt EEK',
          processingTimeMs
        };
      }

      console.log(`🔓 Decrypted EEK for file ${fileId}: ${dataEncryptionKey}`);

      // Step 4: Refine the file
      const refinementResult = await refineFile(fileId, dataEncryptionKey);
      const processingTimeMs = Date.now() - startTime;

      if (refinementResult) {
        // Success
        await fileProcessingService.logSuccess({
          jobId,
          fileId,
          refinementApiResponse: refinementResult,
          processingTimeMs
        });

        return {
          fileId,
          status: 'success',
          message: 'File processed successfully',
          processingTimeMs
        };
      } else {
        // Failed
        await fileProcessingService.logFailure({
          jobId,
          fileId,
          errorMessage: 'Refinement API call failed',
          processingTimeMs
        });

        return {
          fileId,
          status: 'failed',
          message: 'Refinement API call failed',
          processingTimeMs
        };
      }

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await fileProcessingService.logFailure({
        jobId,
        fileId,
        errorMessage,
        errorDetails: { error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
        processingTimeMs
      });

      return {
        fileId,
        status: 'failed',
        message: errorMessage,
        processingTimeMs
      };
    }
  }

  /**
   * Get processing status for a job
   */
  async getJobStatus(jobId: string) {
    const { refinementJobService, batchStatisticsService } = container.getServices();

    const job = await refinementJobService.getJob(jobId);
    const stats = await batchStatisticsService.getBatchStats(jobId);

    return {
      job,
      statistics: stats
    };
  }
}
