/**
 * Legacy Configuration Adapter
 * Provides backward compatibility with the old CONFIG object
 * @deprecated Use HybridConfigService instead
 */

import { getEnvironmentConfig } from './environment';

/**
 * Legacy CONFIG object for backward compatibility
 * @deprecated Use container.getHybridConfigService() instead
 */
export const CONFIG = {
  get refinementServiceApiBaseUrl() {
    console.warn('⚠️ CONFIG.refinementServiceApiBaseUrl is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().refinementServiceApiBaseUrl;
  },

  get dlpPrivateKey() {
    console.warn('⚠️ CONFIG.dlpPrivateKey is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().dlpPrivateKey;
  },

  get dlpAddress() {
    console.warn('⚠️ CONFIG.dlpAddress is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().dlpAddress;
  },



  get batchSize() {
    console.warn('⚠️ CONFIG.batchSize is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().defaultBatchSize;
  },

  get refinerId() {
    console.warn('⚠️ CONFIG.refinerId is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().defaultRefinerId;
  },

  get rpcUrl() {
    console.warn('⚠️ CONFIG.rpcUrl is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().rpcUrl;
  },

  get dataRegistryAddress() {
    console.warn('⚠️ CONFIG.dataRegistryAddress is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().dataRegistryAddress;
  },

  get verbose() {
    console.warn('⚠️ CONFIG.verbose is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().defaultVerbose;
  },

  get logDir() {
    console.warn('⚠️ CONFIG.logDir is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().logDir;
  },

  get maxLogSize() {
    console.warn('⚠️ CONFIG.maxLogSize is deprecated. Use HybridConfigService instead.');
    return 10 * 1024 * 1024; // 10MB
  },

  get pinataApiKey() {
    console.warn('⚠️ CONFIG.pinataApiKey is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().pinataApiKey;
  },

  get pinataApiSecret() {
    console.warn('⚠️ CONFIG.pinataApiSecret is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().pinataApiSecret;
  },

  get pinataApiJwt() {
    console.warn('⚠️ CONFIG.pinataApiJwt is deprecated. Use HybridConfigService instead.');
    return getEnvironmentConfig().pinataApiJwt;
  }
};

/**
 * Legacy validateConfig function
 * @deprecated Use HybridConfigService.validateConfig() instead
 */
export function validateConfig(): void {
  console.warn('⚠️ validateConfig() is deprecated. Use HybridConfigService.validateConfig() instead.');
  
  const envConfig = getEnvironmentConfig();
  
  if (!envConfig.dlpPrivateKey || !envConfig.dlpAddress) {
    throw new Error("DLP_PRIVATE_KEY and DLP_ADDRESS environment variables must be set");
  }

  if (!envConfig.dataRegistryAddress) {
    throw new Error("DATA_REGISTRY_ADDRESS environment variable must be set");
  }
} 