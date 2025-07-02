/**
 * Service Layer Exports
 * Central export point for all service classes
 */

export { RefinementJobService } from './refinement-job.service';
export { FileProcessingService } from './file-processing.service';
export { BatchStatisticsService } from './batch-statistics.service';
export { SystemConfigService } from './system-config.service';
export { JobSchedulerService } from './job-scheduler.service';
export { LoggingService, ChildLogger, logger } from './logging.service';
export { HealthMonitoringService } from './health-monitoring.service';
export { ApiKeyService } from './api-key.service';

// External API and Blockchain services
export { refineFile } from './refinement-api.service';
export { 
  initializeContract, 
  getFileAtIndex, 
  decryptEEK, 
  getFilePermissions, 
  checkFileRefinement, 
  getProvider, 
  isContractInitialized 
} from './blockchain.service';

// Re-export types
export type { CreateJobParams, JobStatistics } from './refinement-job.service';
export type { ProcessFileParams, ProcessFileError } from './file-processing.service';
export type { BatchStatsParams, BatchStatsUpdate } from './batch-statistics.service';
export type { ConfigValue } from './system-config.service';
export type { ScheduledJobConfig, JobExecutionContext } from './job-scheduler.service';
export type { LogContext, LogMetrics } from './logging.service';
export type { HealthCheckResult, SystemMetrics, AlertConfig } from './health-monitoring.service'; 
export type { CreateApiKeyDto, ApiKeyResponse } from './api-key.service';