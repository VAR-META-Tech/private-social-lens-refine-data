/**
 * Main entry point for Batch Refinement Service
 * Refactored to use service-based architecture with dependency injection
 */

import { CliApplication } from './application/cli-application';
import { validateConfig } from './config';

/**
 * Main function
 */
async function main(): Promise<void> {
  const app = new CliApplication();

  try {
    // Parse command line arguments
    const args = app.parseArguments(process.argv);

    // Show help if requested
    if (args.showHelp) {
      app.showHelp();
      return;
    }

    // Validate arguments
    const validation = app.validateArguments(args);
    if (!validation.valid) {
      app.displayErrors(validation.errors);
      process.exit(1);
    }

    // Validate environment configuration
    validateConfig();

    // Initialize application (database, services, blockchain)
    await app.initialize();

    // Run batch processing
    await app.runBatch(args);

    console.log('🎉 Batch refinement completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Application failed:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Main function failed:', error);
    process.exit(1);
  });
}

export { main }; 