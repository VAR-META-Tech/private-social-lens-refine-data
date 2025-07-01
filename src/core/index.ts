/**
 * Core Layer Exports
 * Central export point for core application components
 */

export { Container, container } from './container';
export { BatchProcessor } from './batch-processor';

// Re-export types
export type { ServiceContainer } from './container';
export type { BatchProcessorConfig, ProcessingResult } from './batch-processor'; 