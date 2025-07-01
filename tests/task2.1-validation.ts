/**
 * Task 2.1 Validation: Core Architecture Refactor
 * Tests for service layer, dependency injection, and business logic separation
 */

import { Container, container } from '../src/core/container';
import { BatchProcessor } from '../src/core/batch-processor';
import { CliApplication } from '../src/application/cli-application';
import { connectDatabase, testConnection } from '../src/database/client';

async function validateTask2_1(): Promise<void> {
  console.log('🧪 Task 2.1 Validation: Core Architecture Refactor');
  console.log('=' .repeat(60));

  const results: Array<{ test: string; status: 'PASS' | 'FAIL'; details?: string }> = [];

  // Test 1: Service Layer Architecture
  try {
    console.log('\n1️⃣ Testing Service Layer Architecture...');
    
    // Test container initialization
    await container.initialize();
    const services = container.getServices();
    
    const serviceTests = [
      { name: 'RefinementJobService', exists: !!services.refinementJobService },
      { name: 'FileProcessingService', exists: !!services.fileProcessingService },
      { name: 'BatchStatisticsService', exists: !!services.batchStatisticsService },
      { name: 'SystemConfigService', exists: !!services.systemConfigService },
      { name: 'HybridConfigService', exists: !!services.hybridConfigService }
    ];

    let allServicesOk = true;
    for (const service of serviceTests) {
      if (service.exists) {
        console.log(`   ✅ ${service.name} initialized`);
      } else {
        console.log(`   ❌ ${service.name} missing`);
        allServicesOk = false;
      }
    }

    results.push({
      test: 'Service Layer Architecture',
      status: allServicesOk ? 'PASS' : 'FAIL',
      details: `${serviceTests.filter(s => s.exists).length}/${serviceTests.length} services initialized`
    });

  } catch (error) {
    console.log(`   ❌ Service layer initialization failed: ${error}`);
    results.push({
      test: 'Service Layer Architecture',
      status: 'FAIL',
      details: `Initialization error: ${error}`
    });
  }

  // Test 2: Dependency Injection Container
  try {
    console.log('\n2️⃣ Testing Dependency Injection Container...');
    
    // Test singleton pattern
    const container1 = Container.getInstance();
    const container2 = Container.getInstance();
    const isSingleton = container1 === container2;
    
    console.log(`   ${isSingleton ? '✅' : '❌'} Singleton pattern: ${isSingleton}`);
    
    // Test health check
    const healthCheck = await container.healthCheck();
    const isHealthy = healthCheck.status === 'healthy';
    
    console.log(`   ${isHealthy ? '✅' : '❌'} Health check: ${healthCheck.status}`);
    console.log(`   📊 Service status:`, healthCheck.services);

    results.push({
      test: 'Dependency Injection Container',
      status: (isSingleton && isHealthy) ? 'PASS' : 'FAIL',
      details: `Singleton: ${isSingleton}, Health: ${healthCheck.status}`
    });

  } catch (error) {
    console.log(`   ❌ Container test failed: ${error}`);
    results.push({
      test: 'Dependency Injection Container',
      status: 'FAIL',
      details: `Error: ${error}`
    });
  }

  // Test 3: Business Logic Separation
  try {
    console.log('\n3️⃣ Testing Business Logic Separation...');
    
    // Test batch processor can be instantiated
    const batchProcessor = new BatchProcessor();
    const hasProcessor = !!batchProcessor;
    
    console.log(`   ${hasProcessor ? '✅' : '❌'} BatchProcessor instantiation: ${hasProcessor}`);
    
    // Test CLI application separation
    const cliApp = new CliApplication();
    const hasCli = !!cliApp;
    
    console.log(`   ${hasCli ? '✅' : '❌'} CliApplication instantiation: ${hasCli}`);
    
    // Test argument parsing (without processing)
    const testArgs = ['node', 'script.js', '--start', '100', '--end', '90', '--batch', '5'];
    const parsedArgs = cliApp.parseArguments(testArgs);
    const argsParsedCorrectly = parsedArgs.startId === 100 && parsedArgs.endId === 90 && parsedArgs.batchSize === 5;
    
    console.log(`   ${argsParsedCorrectly ? '✅' : '❌'} CLI argument parsing: ${argsParsedCorrectly}`);
    console.log(`   📝 Parsed args:`, parsedArgs);

    results.push({
      test: 'Business Logic Separation',
      status: (hasProcessor && hasCli && argsParsedCorrectly) ? 'PASS' : 'FAIL',
      details: `Processor: ${hasProcessor}, CLI: ${hasCli}, Args: ${argsParsedCorrectly}`
    });

  } catch (error) {
    console.log(`   ❌ Business logic test failed: ${error}`);
    results.push({
      test: 'Business Logic Separation',
      status: 'FAIL',
      details: `Error: ${error}`
    });
  }

  // Test 4: Database Service Integration
  try {
    console.log('\n4️⃣ Testing Database Service Integration...');
    
    // Test database connection
    const dbConnected = await testConnection();
    console.log(`   ${dbConnected ? '✅' : '❌'} Database connection: ${dbConnected}`);
    
    // Test service database operations (read-only)
    const systemConfigService = container.getSystemConfigService();
    const testConfig = await systemConfigService.getConfig('processing.batch_size');
    const configExists = testConfig !== null;
    
    console.log(`   ${configExists ? '✅' : '❌'} Configuration read: ${configExists}`);
    console.log(`   📖 Sample config value: processing.batch_size = ${testConfig}`);

    results.push({
      test: 'Database Service Integration',
      status: (dbConnected && configExists) ? 'PASS' : 'FAIL',
      details: `DB: ${dbConnected}, Config: ${configExists}`
    });

  } catch (error) {
    console.log(`   ❌ Database integration test failed: ${error}`);
    results.push({
      test: 'Database Service Integration',
      status: 'FAIL',
      details: `Error: ${error}`
    });
  }

  // Summary
  console.log('\n📊 TASK 2.1 VALIDATION SUMMARY');
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
    console.log('🎉 Task 2.1: Core Architecture Refactor - SUCCESSFULLY COMPLETED!');
  } else {
    console.log('⚠️ Task 2.1 has issues that need to be addressed.');
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  validateTask2_1().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

export { validateTask2_1 }; 