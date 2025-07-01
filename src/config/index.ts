/**
 * Configuration Module Exports
 * Central export point for configuration services
 */

// New configuration system
export { getEnvironmentConfig, displayEnvironmentSummary } from './environment';
export { HybridConfigService } from './hybrid-config';

// Legacy compatibility (deprecated)
export { CONFIG, validateConfig } from './legacy-adapter';

// Re-export types
export type { EnvironmentConfig } from './environment';
export type { HybridConfig } from './hybrid-config'; 