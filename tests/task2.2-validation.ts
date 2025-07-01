/**
 * Task 2.2 Validation: Configuration Management
 * Tests for environment-based configuration, database configuration, and hybrid config system
 */

import { container } from '../src/core/container';
import { getEnvironmentConfig, validateEnvironmentConfig } from '../src/config/environment';
import { HybridConfigService } from '../src/config/hybrid-config';
import { CONFIG, validateConfig } from '../src/config/legacy-adapter';

async function validateTask2_2(): Promise<void> {
  console.log('🧪 Task 2.2 Validation: Configuration Management');
  console.log('=' .repeat(60));

  const results: Array<{ test: string; status: 'PASS' | 'FAIL'; details?: string }> = [];

  // Test 1: Environment Configuration System
  try {
    console.log('\n1️⃣ Testing Environment Configuration System...');
    
    // Test environment config loading
    const envConfig = getEnvironmentConfig();
    const hasRequiredFields = !!(envConfig.databaseUrl && envConfig.rpcUrl && envConfig.refinementServiceApiBaseUrl);
    
    console.log(`   ${hasRequiredFields ? '✅' : '❌'} Environment config loaded: ${hasRequiredFields}`);
    console.log(`   📝 Node environment: ${envConfig.nodeEnv}`);
    console.log(`   📝 Database URL: ${envConfig.databaseUrl ? 'Set' : 'Missing'}`);
    console.log(`   📝 RPC URL: ${envConfig.rpcUrl}`);
    
    // Test environment validation
    const validation = validateEnvironmentConfig(envConfig);
    const isValid = validation.valid;
    
    console.log(`   ${isValid ? '✅' : '❌'} Environment validation: ${isValid ? 'PASSED' : 'FAILED'}`);
    if (!isValid) {
      console.log(`   ⚠️ Validation errors:`, validation.errors);
    }

    results.push({
      test: 'Environment Configuration System',
      status: (hasRequiredFields && isValid) ? 'PASS' : 'FAIL',
      details: `Required fields: ${hasRequiredFields}, Validation: ${isValid}`
    });

  } catch (error) {
    console.log(`   ❌ Environment config test failed: ${error}`);
    results.push({
      test: 'Environment Configuration System',
      status: 'FAIL',
      details: `Error: ${error}`
    });
  }

  // Test 2: Database Configuration Storage
  try {
    console.log('\n2️⃣ Testing Database Configuration Storage...');
    
    // Initialize container to get services
    await container.initialize();
    const systemConfigService = container.getSystemConfigService();
    
    // Test reading database config
    const batchSize = await systemConfigService.getConfig('processing.batch_size');
    const cronSchedule = await systemConfigService.getConfig('cron.batch_processing');
    const hasDbConfig = !!(batchSize && cronSchedule);
    
    console.log(`   ${hasDbConfig ? '✅' : '❌'} Database config read: ${hasDbConfig}`);
    console.log(`   📝 Batch size: ${batchSize}`);
    console.log(`   📝 Cron schedule: ${cronSchedule}`);
    
    // Test typed config reading
    const typedBatchSize = await systemConfigService.getConfigTyped('processing.batch_size', 10);
    const typedAutoRetry = await systemConfigService.getConfigTyped('features.auto_retry', false);
    const hasTypedConfig = (typeof typedBatchSize === 'number') && (typeof typedAutoRetry === 'boolean');
    
    console.log(`   ${hasTypedConfig ? '✅' : '❌'} Typed config reading: ${hasTypedConfig}`);
    console.log(`   📝 Typed batch size: ${typedBatchSize} (${typeof typedBatchSize})`);
    console.log(`   📝 Typed auto retry: ${typedAutoRetry} (${typeof typedAutoRetry})`);
    
    // Test config validation
    const configValidation = await systemConfigService.validateConfig();
    const configValid = configValidation.valid;
    
    console.log(`   ${configValid ? '✅' : '❌'} Config validation: ${configValid ? 'PASSED' : 'FAILED'}`);
    if (!configValid) {
      console.log(`   ⚠️ Config errors:`, configValidation.errors);
    }

    results.push({
      test: 'Database Configuration Storage',
      status: (hasDbConfig && hasTypedConfig && configValid) ? 'PASS' : 'FAIL',
      details: `DB Config: ${hasDbConfig}, Typed: ${hasTypedConfig}, Valid: ${configValid}`
    });

  } catch (error) {
    console.log(`   ❌ Database config test failed: ${error}`);
    results.push({
      test: 'Database Configuration Storage',
      status: 'FAIL',
      details: `Error: ${error}`
    });
  }

  // Test 3: Hybrid Configuration System
  try {
    console.log('\n3️⃣ Testing Hybrid Configuration System...');
    
    const hybridConfigService = container.getHybridConfigService();
    
    // Test hybrid config loading
    const hybridConfig = await hybridConfigService.getConfig();
    const hasHybridConfig = !!(hybridConfig.environment && hybridConfig.processing && hybridConfig.cron);
    
    console.log(`   ${hasHybridConfig ? '✅' : '❌'} Hybrid config loaded: ${hasHybridConfig}`);
    console.log(`   📝 Environment node env: ${hybridConfig.environment.nodeEnv}`);
    console.log(`   📝 Processing batch size: ${hybridConfig.processing.batchSize}`);
    console.log(`   📝 Cron batch processing: ${hybridConfig.cron.batchProcessing}`);
    
    // Test config summary
    const configSummary = await hybridConfigService.getConfigSummary();
    const hasSummary = !!(configSummary.environment && configSummary.database && configSummary.validation);
    
    console.log(`   ${hasSummary ? '✅' : '❌'} Config summary generation: ${hasSummary}`);
    console.log(`   📊 Summary validation: ${configSummary.validation.valid ? 'PASSED' : 'FAILED'}`);
    
    // Test hot reload capability
    const reloadedConfig = await hybridConfigService.hotReload();
    const hotReloadWorks = !!reloadedConfig;
    
    console.log(`   ${hotReloadWorks ? '✅' : '❌'} Hot reload functionality: ${hotReloadWorks}`);

    results.push({
      test: 'Hybrid Configuration System',
      status: (hasHybridConfig && hasSummary && hotReloadWorks) ? 'PASS' : 'FAIL',
      details: `Hybrid: ${hasHybridConfig}, Summary: ${hasSummary}, Reload: ${hotReloadWorks}`
    });

  } catch (error) {
    console.log(`   ❌ Hybrid config test failed: ${error}`);
    results.push({
      test: 'Hybrid Configuration System',
      status: 'FAIL',
      details: `Error: ${error}`
    });
  }

  // Test 4: Legacy Configuration Compatibility
  try {
    console.log('\n4️⃣ Testing Legacy Configuration Compatibility...');
    
    // Test legacy CONFIG object (should show deprecation warnings)
    console.log('   📢 Testing legacy CONFIG access (expect deprecation warnings):');
    const legacyBatchSize = CONFIG.batchSize;
    const legacyRpcUrl = CONFIG.rpcUrl;
    const legacyApiUrl = CONFIG.refinementServiceApiBaseUrl;
    
    const legacyConfigWorks = !!(legacyBatchSize && legacyRpcUrl && legacyApiUrl);
    
    console.log(`   ${legacyConfigWorks ? '✅' : '❌'} Legacy CONFIG access: ${legacyConfigWorks}`);
    console.log(`   📝 Legacy batch size: ${legacyBatchSize}`);
    
    // Test legacy validateConfig function
    let legacyValidationWorks = false;
    try {
      validateConfig(); // Should show deprecation warning
      legacyValidationWorks = true;
    } catch (error) {
      console.log(`   ⚠️ Legacy validation error: ${error}`);
    }
    
    console.log(`   ${legacyValidationWorks ? '✅' : '❌'} Legacy validation: ${legacyValidationWorks}`);

    results.push({
      test: 'Legacy Configuration Compatibility',
      status: (legacyConfigWorks && legacyValidationWorks) ? 'PASS' : 'FAIL',
      details: `Legacy access: ${legacyConfigWorks}, Validation: ${legacyValidationWorks}`
    });

  } catch (error) {
    console.log(`   ❌ Legacy compatibility test failed: ${error}`);
    results.push({
      test: 'Legacy Configuration Compatibility',
      status: 'FAIL',
      details: `Error: ${error}`
    });
  }

  // Summary
  console.log('\n📊 TASK 2.2 VALIDATION SUMMARY');
  console.log('=' .repeat(40));
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const totalCount = results.length;
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.status}`);
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
  });
  
  const overallStatus = passCount === totalCount ? 'COMPLETED' : 'NEEDS ATTENTION';
  console.log(`\n🎯 Overall Status: ${overallStatus} (${passCount}/${totalCount} tests passed)`);
  
  if (overallStatus === 'COMPLETED') {
    console.log('🎉 Task 2.2: Configuration Management - SUCCESSFULLY COMPLETED!');
  } else {
    console.log('⚠️ Task 2.2 has issues that need to be addressed.');
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  validateTask2_2().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

export { validateTask2_2 }; 