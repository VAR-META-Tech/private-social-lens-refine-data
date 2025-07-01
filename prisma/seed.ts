/**
 * Prisma Database Seeding Script
 * Populates the database with sample data for development and testing
 */

import { PrismaClient, JobStatus, JobType, ProcessingStatus, QueueStatus, ConfigDataType } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Clear existing data in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Clearing existing data...');
      await prisma.processingQueue.deleteMany();
      await prisma.fileProcessingLog.deleteMany();
      await prisma.batchStatistic.deleteMany();
      await prisma.refinementJob.deleteMany();
      await prisma.systemConfig.deleteMany();
    }

    // Seed SystemConfig
    console.log('📝 Seeding system configuration...');
    await prisma.systemConfig.createMany({
      data: [
        {
          key: 'app.version',
          value: '1.0.0',
          description: 'Application version',
          dataType: ConfigDataType.STRING,
        },
        {
          key: 'app.environment',
          value: 'development',
          description: 'Application environment',
          dataType: ConfigDataType.STRING,
        },
        {
          key: 'processing.default_batch_size',
          value: '10',
          description: 'Default batch size for processing',
          dataType: ConfigDataType.INTEGER,
        },
        {
          key: 'processing.max_concurrent_jobs',
          value: '5',
          description: 'Maximum concurrent jobs',
          dataType: ConfigDataType.INTEGER,
        },
        {
          key: 'processing.default_retry_delay',
          value: '300',
          description: 'Default retry delay in seconds',
          dataType: ConfigDataType.INTEGER,
        },
        {
          key: 'processing.max_file_id',
          value: '1000',
          description: 'Maximum file ID to process',
          dataType: ConfigDataType.INTEGER,
        },
        {
          key: 'processing.refiner_id',
          value: '7',
          description: 'Default refiner ID',
          dataType: ConfigDataType.INTEGER,
        },
        {
          key: 'cron.health_check',
          value: '*/30 * * * *',
          description: 'Health check cron schedule',
          dataType: ConfigDataType.STRING,
        },
        {
          key: 'cron.cleanup_logs',
          value: '0 2 * * *',
          description: 'Log cleanup cron schedule',
          dataType: ConfigDataType.STRING,
        },
        {
          key: 'cron.batch_processing',
          value: '0 */6 * * *',
          description: 'Batch processing cron schedule',
          dataType: ConfigDataType.STRING,
        },
        {
          key: 'api.refinement_base_url',
          value: 'https://a7df0ae43df690b889c1201546d7058ceb04d21b-8000.dstack-prod5.phala.network',
          description: 'Refinement API base URL',
          dataType: ConfigDataType.STRING,
        },
        {
          key: 'blockchain.rpc_url',
          value: 'https://rpc.moksha.vana.org',
          description: 'Blockchain RPC URL',
          dataType: ConfigDataType.STRING,
        },
        {
          key: 'monitoring.enabled',
          value: 'true',
          description: 'Enable monitoring and alerts',
          dataType: ConfigDataType.BOOLEAN,
        },
        {
          key: 'features.auto_retry',
          value: 'true',
          description: 'Enable automatic job retry',
          dataType: ConfigDataType.BOOLEAN,
        },
      ],
    });



    // Seed RefinementJobs
    console.log('🔨 Seeding refinement jobs...');
    const jobs = await prisma.refinementJob.createMany({
      data: [
        {
          jobName: 'daily-batch-refinement',
          jobType: JobType.SCHEDULED_BATCH,
          cronSchedule: '0 2 * * *', // Daily at 2 AM
          startFileId: 1000,
          endFileId: 900,
          batchSize: 10,
          status: JobStatus.PENDING,
          priority: 8,
          createdBy: 'system',
        },
        {
          jobName: 'manual-range-100-90',
          jobType: JobType.RANGE_BASED,
          startFileId: 100,
          endFileId: 90,
          batchSize: 5,
          status: JobStatus.RUNNING,
          priority: 5,
          createdBy: 'admin',
          startedAt: new Date(Date.now() - 30 * 60 * 1000), // Started 30 minutes ago
        },
        {
          jobName: 'weekly-cleanup',
          jobType: JobType.CLEANUP,
          cronSchedule: '0 0 * * 1', // Every Monday at midnight
          status: JobStatus.PENDING,
          priority: 3,
          metadata: {
            cleanup_older_than_days: 30,
            tables: ['file_processing_logs', 'batch_statistics'],
          },
          createdBy: 'system',
        },
        {
          jobName: 'health-check',
          jobType: JobType.HEALTH_CHECK,
          cronSchedule: '*/30 * * * *', // Every 30 minutes
          status: JobStatus.COMPLETED,
          priority: 10,
          metadata: {
            check_database: true,
            check_api: true,
            check_blockchain: true,
          },
          createdBy: 'system',
          completedAt: new Date(Date.now() - 10 * 60 * 1000), // Completed 10 minutes ago
        },
      ],
    });

    // Get job IDs for relations
    const allJobs = await prisma.refinementJob.findMany();
    const runningJob = allJobs.find(job => job.status === JobStatus.RUNNING);
    const completedJob = allJobs.find(job => job.status === JobStatus.COMPLETED);

    if (runningJob) {
      // Seed FileProcessingLogs for the running job
      console.log('📋 Seeding file processing logs...');
      await prisma.fileProcessingLog.createMany({
        data: [
          {
            jobId: runningJob.id,
            fileId: 95,
            status: ProcessingStatus.SUCCESS,
            message: 'File successfully refined',
            processingTimeMs: 2500,
            ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
            gasUsed: BigInt(123456),
            transactionHash: '0x1234567890abcdef1234567890abcdef12345678901234567890abcdef123456',
            processedAt: new Date(Date.now() - 20 * 60 * 1000),
          },
          {
            jobId: runningJob.id,
            fileId: 94,
            status: ProcessingStatus.FAILED,
            message: 'API timeout during refinement',
            errorDetails: {
              error_code: 'TIMEOUT',
              details: 'Connection timeout after 30 seconds',
              retry_suggested: true,
            },
            processingTimeMs: 30000,
            processedAt: new Date(Date.now() - 15 * 60 * 1000),
          },
          {
            jobId: runningJob.id,
            fileId: 93,
            status: ProcessingStatus.ALREADY_REFINED,
            message: 'File was already refined by this refiner',
            processingTimeMs: 150,
            processedAt: new Date(Date.now() - 10 * 60 * 1000),
          },
          {
            jobId: runningJob.id,
            fileId: 92,
            status: ProcessingStatus.SKIPPED,
            message: 'No EEK found for file',
            processingTimeMs: 100,
            processedAt: new Date(Date.now() - 5 * 60 * 1000),
          },
        ],
      });

      // Seed BatchStatistics for the running job
      console.log('📈 Seeding batch statistics...');
      await prisma.batchStatistic.create({
        data: {
          jobId: runningJob.id,
          batchStartFileId: 100,
          batchEndFileId: 91,
          totalFiles: 10,
          alreadyRefinedCount: 1,
          processedCount: 4,
          successCount: 1,
          failedCount: 1,
          skippedCount: 1,
          totalProcessingTimeMs: BigInt(32750),
          averageProcessingTimeMs: 8187,
          totalGasUsed: BigInt(123456),
          batchStartTime: new Date(Date.now() - 30 * 60 * 1000),
          batchEndTime: new Date(Date.now() - 5 * 60 * 1000),
        },
      });

      // Seed ProcessingQueue for the running job
      console.log('📤 Seeding processing queue...');
      await prisma.processingQueue.createMany({
        data: [
          {
            jobId: runningJob.id,
            fileId: 91,
            queuePosition: 1,
            status: QueueStatus.QUEUED,
            priority: 5,
          },
          {
            jobId: runningJob.id,
            fileId: 90,
            queuePosition: 2,
            status: QueueStatus.QUEUED,
            priority: 5,
          },
          {
            jobId: runningJob.id,
            fileId: 89,
            queuePosition: 3,
            status: QueueStatus.PROCESSING,
            priority: 5,
            startedAt: new Date(),
          },
        ],
      });
    }

    // Additional sample data for completed job
    if (completedJob) {
      await prisma.batchStatistic.create({
        data: {
          jobId: completedJob.id,
          totalFiles: 1,
          processedCount: 1,
          successCount: 1,
          failedCount: 0,
          skippedCount: 0,
          totalProcessingTimeMs: BigInt(500),
          averageProcessingTimeMs: 500,
          batchStartTime: new Date(Date.now() - 15 * 60 * 1000),
          batchEndTime: new Date(Date.now() - 10 * 60 * 1000),
        },
      });
    }

    console.log('✅ Database seeding completed successfully!');

    // Print summary
    const summary = await getSeedingSummary();
    console.log('\n📊 Seeding Summary:');
    console.log(`  System Configs: ${summary.systemConfigs}`);
    console.log(`  Refinement Jobs: ${summary.refinementJobs}`);
    console.log(`  File Processing Logs: ${summary.fileProcessingLogs}`);
    console.log(`  Batch Statistics: ${summary.batchStatistics}`);
    console.log(`  Processing Queue Items: ${summary.processingQueue}`);

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

async function getSeedingSummary() {
  const [
    systemConfigs,
    refinementJobs,
    fileProcessingLogs,
    batchStatistics,
    processingQueue,
  ] = await Promise.all([
    prisma.systemConfig.count(),
    prisma.refinementJob.count(),
    prisma.fileProcessingLog.count(),
    prisma.batchStatistic.count(),
    prisma.processingQueue.count(),
  ]);

  return {
    systemConfigs,
    refinementJobs,
    fileProcessingLogs,
    batchStatistics,
    processingQueue,
  };
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
