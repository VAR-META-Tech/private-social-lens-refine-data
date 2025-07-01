/**
 * API Server Entry Point
 * Starts the REST API server for batch refinement service
 */

import 'dotenv/config';
import { logger } from '@/services';
import {ApiServer} from "@/api";

async function startApiServer() {
  try {
    const port = parseInt(process.env.API_PORT || '3000', 10);
    const apiServer = new ApiServer(port);

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down API server gracefully...', {}, 'ApiServer');
      await apiServer.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down API server gracefully...', {}, 'ApiServer');
      await apiServer.stop();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in API server', error, {}, 'ApiServer');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection in API server', new Error(String(reason)), {
        operation: 'unhandled-rejection',
        metadata: {
          promise: promise.toString()
        }
      }, 'ApiServer');
      process.exit(1);
    });

    // Start the server
    await apiServer.start();

  } catch (error) {
    logger.error('Failed to start API server', error as Error, {}, 'ApiServer');
    process.exit(1);
  }
}

// Start if this file is run directly
if (process.argv[1] && process.argv[1].endsWith('index-api.js')) {
  startApiServer();
}

export { startApiServer };
