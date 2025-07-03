#!/usr/bin/env node
/**
 * Service Entry Point
 * Starts the Batch Refinement Service as a long-running process
 * Usage: npm run service or node dist/index-service.js
 */

import { ServiceApplication } from '@/application';
import { logger } from './services/logging.service';

/**
 * Main service function
 */
async function main() {
  logger.info('🌟 Batch Refinement Service', {});
  logger.info('==========================', {});

  const service = new ServiceApplication();

  // Handle command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'start':
      case undefined:
        // Default action: start the service
        logger.info('🚀 Starting service in daemon mode...', {});
        await service.start();
        break;

      case 'status':
        logger.info('📊 Checking service status...', {});
        await service.start();
        const status = await service.getStatus();
        logger.info(`Service Status: ${status}`);
        process.exit(0);
        break;

      case 'health':
        logger.info('🏥 Running health check...', {});
        await service.start();
        await service.runHealthCheck();
        process.exit(0);
        break;

      case 'jobs':
        logger.info('📋 Listing scheduled jobs...', {});
        await service.start();
        await service.listScheduledJobs();
        process.exit(0);
        break;

      case 'create-examples':
        logger.info('📅 Creating example scheduled jobs...', {});
        await service.start();
        await service.createExampleJobs();
        logger.info('✅ Example jobs created. Service will continue running...', {});
        break;

      case 'schedule':
        // Schedule a one-time job
        const jobType = args[1];
        const startFileId = parseInt(args[2]);
        const endFileId = parseInt(args[3]);

        if (!jobType) {
          console.error('❌ Usage: npm run service schedule <RANGE_BASED|CLEANUP|HEALTH_CHECK> <startFileId> <endFileId>');
          console.error('Note: SCHEDULED_BATCH jobs should be created via API with metadata configuration');
          process.exit(1);
        }

        if (jobType === 'SCHEDULED_BATCH') {
          console.error('❌ SCHEDULED_BATCH jobs cannot be created via command line.');
          console.error('Use the API with proper metadata configuration:');
          console.error('  { batchIncrement: 100, initialStartFileId: 100 }');
          process.exit(1);
        }

        if (!startFileId || !endFileId) {
          console.error('❌ Usage: npm run service schedule <RANGE_BASED|CLEANUP|HEALTH_CHECK> <startFileId> <endFileId>');
          process.exit(1);
        }

        logger.info(`🎯 Scheduling one-time ${jobType} job...`, {});
        await service.start();

        const jobId = await service.scheduleOneTimeJob({
          jobName: `manual-${jobType.toLowerCase()}-${Date.now()}`,
          jobType: jobType as any,
          startFileId,
          endFileId,
          priority: 9,
          metadata: { manual: true, scheduledAt: new Date() }
        });

        logger.info(`✅ Job scheduled with ID: ${jobId}`, {});
        logger.info('Service will continue running to execute the job...', {});
        break;

      case 'help':
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;

      default:
        logger.error(`❌ Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }

  } catch (error) {
    logger.error('❌ Service failed:', error as Error);
    process.exit(1);
  }
}

/**
 * Print help information
 */
function printHelp() {
  logger.info(`
🌟 Batch Refinement Service Commands:

  npm run service [start]              Start the service (default)
  npm run service status               Show service status
  npm run service health               Run health check
  npm run service jobs                 List all scheduled jobs
  npm run service create-examples      Create example scheduled jobs
  npm run service schedule <type> <start> <end>   Schedule one-time job
  npm run service help                 Show this help

Examples:
  npm run service                      # Start service
  npm run service status               # Check status
  npm run service schedule RANGE_BASED 1000 900   # Process files 1000-900
  npm run service schedule CLEANUP 0 0 # Run cleanup
  npm run service create-examples      # Create SCHEDULED_BATCH with auto-increment

Job Types:
  - SCHEDULED_BATCH: Automated batch processing with auto-incrementing ranges
  - RANGE_BASED: Process specific file range (manual or created by SCHEDULED_BATCH)
  - CLEANUP: Clean old logs and data
  - HEALTH_CHECK: System health monitoring
  - MANUAL: One-time manual execution

The service runs indefinitely and executes jobs based on cron schedules.
Use Ctrl+C to stop the service gracefully.
`);
}

// Start the service
main().catch((error) => {
  logger.error('❌ Fatal error:', error as Error);
  process.exit(1);
});
