/**
 * Environment Configuration
 * Handles environment variable loading and validation
 */

import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../services/logging.service';

// Load environment variables
dotenv.config();

export interface EnvironmentConfig {
  // Application
  nodeEnv: string;
  port: number;
  
  // Database
  databaseUrl: string;
  
  // DLP (Decentralized Learning Protocol)
  dlpPrivateKey: string;
  dlpAddress: string;
  
  // Blockchain
  rpcUrl: string;
  dataRegistryAddress: string;
  networkName: string;
  networkChainId: number;
  
  // API
  refinementServiceApiBaseUrl: string;
  
  // IPFS / Pinata
  pinataApiJwt?: string;
  
  // Logging
  logLevel: string;
  logDir: string;
  
  // Processing defaults (can be overridden by database config)
  defaultBatchSize: number;
  defaultRefinerId: number;
  defaultVerbose: boolean;
}

/**
 * Load and validate environment configuration
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  const config: EnvironmentConfig = {
    // Application
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    
    // Database
    databaseUrl: process.env.DATABASE_URL || '',
    
    // DLP
    dlpPrivateKey: process.env.DLP_PRIVATE_KEY || '',
    dlpAddress: process.env.DLP_ADDRESS || '',
    
    // Blockchain
    rpcUrl: process.env.RPC_URL || 'https://rpc.moksha.vana.org',
    dataRegistryAddress: process.env.DATA_REGISTRY_ADDRESS || '',
    networkName: process.env.NETWORK_NAME || 'vana-moksha',
    networkChainId: parseInt(process.env.NETWORK_CHAIN_ID || '14800', 10),
    
    // API
    refinementServiceApiBaseUrl: process.env.REFINEMENT_SERVICE_API_BASE_URL || 
      'https://a7df0ae43df690b889c1201546d7058ceb04d21b-8000.dstack-prod5.phala.network',
    
    // IPFS / Pinata
    pinataApiJwt: process.env.PINATA_API_JWT,
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    logDir: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
    
    // Processing defaults
    defaultBatchSize: parseInt(process.env.BATCH_SIZE || '10', 10),
    defaultRefinerId: parseInt(process.env.REFINER_ID || '7', 10),
    defaultVerbose: process.env.VERBOSE === 'true'
  };

  return config;
}

/**
 * Validate required environment variables
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  const requiredFields: Array<{ key: keyof EnvironmentConfig; message: string }> = [
    { key: 'databaseUrl', message: 'DATABASE_URL is required' },
    { key: 'dlpPrivateKey', message: 'DLP_PRIVATE_KEY is required' },
    { key: 'dlpAddress', message: 'DLP_ADDRESS is required' },
    { key: 'dataRegistryAddress', message: 'DATA_REGISTRY_ADDRESS is required' }
  ];
  
  for (const field of requiredFields) {
    if (!config[field.key]) {
      errors.push(field.message);
    }
  }
  
  // Validate port
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    errors.push('PORT must be a valid port number (1-65535)');
  }
  
  // Validate batch size
  if (config.defaultBatchSize < 1 || config.defaultBatchSize > 1000) {
    errors.push('BATCH_SIZE must be between 1 and 1000');
  }
  

  
  // Validate refiner ID
  if (config.defaultRefinerId < 0) {
    errors.push('REFINER_ID must be greater than or equal to 0');
  }
  
  // Validate URLs
  try {
    new URL(config.rpcUrl);
  } catch {
    errors.push('RPC_URL must be a valid URL');
  }
  
  try {
    new URL(config.refinementServiceApiBaseUrl);
  } catch {
    errors.push('REFINEMENT_SERVICE_API_BASE_URL must be a valid URL');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get environment configuration (singleton)
 */
let environmentConfig: EnvironmentConfig | null = null;

export function getEnvironmentConfig(): EnvironmentConfig {
  if (!environmentConfig) {
    environmentConfig = loadEnvironmentConfig();
    
    const validation = validateEnvironmentConfig(environmentConfig);
    if (!validation.valid) {
      console.error('❌ Environment configuration validation failed:');
      validation.errors.forEach(error => console.error(`  • ${error}`));
      throw new Error('Invalid environment configuration');
    }
  }
  
  return environmentConfig;
}

/**
 * Display environment configuration summary (without sensitive data)
 */
export function displayEnvironmentSummary(config: EnvironmentConfig): void {
  // Display configuration summary
  logger.info('🔧 Environment Configuration:');
  logger.info(`  • Node Environment: ${config.nodeEnv}`);
  logger.info(`  • Port: ${config.port}`);
  logger.info(`  • Database: ${config.databaseUrl.includes('localhost') ? 'Local' : 'Remote'}`);
  logger.info(`  • RPC URL: ${config.rpcUrl}`);
  logger.info(`  • DLP Address: ${config.dlpAddress}`);
  logger.info(`  • Data Registry: ${config.dataRegistryAddress}`);
  logger.info(`  • Refinement Service: ${config.refinementServiceApiBaseUrl}`);
  logger.info(`  • Log Level: ${config.logLevel}`);
  logger.info(`  • Log Directory: ${config.logDir}`);
  logger.info(`  • Default Batch Size: ${config.defaultBatchSize}`);
  logger.info(`  • Default Refiner ID: ${config.defaultRefinerId}`);
  logger.info(`  • IPFS Configured: ${config.pinataApiJwt ? 'Yes' : 'No'}`);
} 