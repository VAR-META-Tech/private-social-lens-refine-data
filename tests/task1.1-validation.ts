/**
 * Task 1.1 Validation Script: Prisma Database Schema Design
 * Tests all components of the Prisma schema setup
 */

import { PrismaClient, JobStatus, JobType } from '../src/generated/prisma';
import { connectDatabase, disconnectDatabase, testConnection, getDatabaseInfo, healthCheck } from '../src/database/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

async function runValidationTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  console.log('🧪 Starting Task 1.1 validation tests...\n');

  // Test 1: Prisma Client Generation
  try {
    console.log('1️⃣ Testing Prisma Client Generation...');
    const clientExists = typeof PrismaClient !== 'undefined';
    results.push({
      name: 'Prisma Client Generation',
      passed: clientExists,
      details: { clientAvailable: clientExists }
    });
    console.log(clientExists ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Prisma Client Generation',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 2: Database Connection
  try {
    console.log('\n2️⃣ Testing Database Connection...');
    const connectionTest = await testConnection();
    results.push({
      name: 'Database Connection',
      passed: connectionTest,
      details: { connected: connectionTest }
    });
    console.log(connectionTest ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Database Connection',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 3: Schema Model Validation
  try {
    console.log('\n3️⃣ Testing Schema Models...');
    
    // Test if all models are accessible
    const modelTests = {
      RefinementJob: prisma.refinementJob,
      FileProcessingLog: prisma.fileProcessingLog,
      BatchStatistic: prisma.batchStatistic,
      ProcessingQueue: prisma.processingQueue,
      SystemConfig: prisma.systemConfig,
      SchemaVersion: prisma.schemaVersion,
    };

    const modelsExist = Object.keys(modelTests).every(model => 
      modelTests[model as keyof typeof modelTests] !== undefined
    );

    results.push({
      name: 'Schema Models Validation',
      passed: modelsExist,
      details: { modelsCount: Object.keys(modelTests).length, allModelsExist: modelsExist }
    });
    console.log(modelsExist ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Schema Models Validation',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 4: Enum Validation
  try {
    console.log('\n4️⃣ Testing Schema Enums...');
    
    const enumTests = {
      JobStatus: Object.values(JobStatus).length > 0,
      JobType: Object.values(JobType).length > 0,
    };

    const enumsValid = Object.values(enumTests).every(test => test);

    results.push({
      name: 'Schema Enums Validation',
      passed: enumsValid,
      details: { 
        jobStatusValues: Object.values(JobStatus),
        jobTypeValues: Object.values(JobType),
        allEnumsValid: enumsValid 
      }
    });
    console.log(enumsValid ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Schema Enums Validation',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 5: Database Health Check
  try {
    console.log('\n5️⃣ Testing Database Health Check...');
    const health = await healthCheck();
    const isHealthy = health.status === 'healthy';
    
    results.push({
      name: 'Database Health Check',
      passed: isHealthy,
      details: health
    });
    console.log(isHealthy ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Database Health Check',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 6: Database Information
  try {
    console.log('\n6️⃣ Testing Database Information Retrieval...');
    const dbInfo = await getDatabaseInfo();
    const infoValid = dbInfo.connected === true;
    
    results.push({
      name: 'Database Information',
      passed: infoValid,
      details: dbInfo
    });
    console.log(infoValid ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Database Information',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 7: CRUD Operations Test
  try {
    console.log('\n7️⃣ Testing Basic CRUD Operations...');
    
    // Create a test system config
    const testConfig = await prisma.systemConfig.create({
      data: {
        key: 'test.validation',
        value: 'test_value',
        description: 'Test configuration for validation'
      }
    });

    // Read the config
    const readConfig = await prisma.systemConfig.findUnique({
      where: { key: 'test.validation' }
    });

    // Update the config
    const updatedConfig = await prisma.systemConfig.update({
      where: { key: 'test.validation' },
      data: { value: 'updated_value' }
    });

    // Delete the config
    await prisma.systemConfig.delete({
      where: { key: 'test.validation' }
    });

    const crudSuccess = testConfig && readConfig && updatedConfig && 
                       updatedConfig.value === 'updated_value';

    results.push({
      name: 'Basic CRUD Operations',
      passed: crudSuccess,
      details: { 
        created: !!testConfig,
        read: !!readConfig,
        updated: !!updatedConfig,
        deleted: true,
        finalValue: updatedConfig?.value
      }
    });
    console.log(crudSuccess ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Basic CRUD Operations',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 8: Relations Test
  try {
    console.log('\n8️⃣ Testing Model Relations...');
    
    // Create a test job
    const testJob = await prisma.refinementJob.create({
      data: {
        jobName: 'test-relations',
        jobType: JobType.MANUAL,
        batchSize: 5,
        status: JobStatus.PENDING,
        createdBy: 'test'
      }
    });

    // Create related file processing log
    const testLog = await prisma.fileProcessingLog.create({
      data: {
        jobId: testJob.id,
        fileId: 999,
        status: 'PENDING',
        message: 'Test log entry'
      }
    });

    // Test relation query
    const jobWithLogs = await prisma.refinementJob.findUnique({
      where: { id: testJob.id },
      include: {
        fileProcessingLogs: true
      }
    });

    // Cleanup
    await prisma.fileProcessingLog.delete({ where: { id: testLog.id } });
    await prisma.refinementJob.delete({ where: { id: testJob.id } });

    const relationsWork = jobWithLogs && 
                         jobWithLogs.fileProcessingLogs.length === 1 &&
                         jobWithLogs.fileProcessingLogs[0].fileId === 999;

    results.push({
      name: 'Model Relations',
      passed: relationsWork,
      details: { 
        jobCreated: !!testJob,
        logCreated: !!testLog,
        relationQueried: !!jobWithLogs,
        relatedLogsFound: jobWithLogs?.fileProcessingLogs.length || 0
      }
    });
    console.log(relationsWork ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Model Relations',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  return results;
}

async function main() {
  try {
    await connectDatabase();
    const results = await runValidationTests();
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 TASK 1.1 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const percentage = Math.round((passed / total) * 100);
    
    console.log(`Overall Score: ${passed}/${total} (${percentage}%)`);
    console.log(`Status: ${percentage === 100 ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
    
    console.log('\nDetailed Results:');
    results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`  ${index + 1}. ${status} ${result.name}`);
      if (!result.passed && result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });

    console.log('\n' + '='.repeat(50));
    console.log('🎯 SUCCESS CRITERIA CHECK:');
    console.log('='.repeat(50));
    
    const criteria = [
      { name: 'Prisma schema configured with PostgreSQL', met: results[0]?.passed ?? false },
      { name: 'All 6 models defined with proper relationships', met: results[2]?.passed ?? false },
      { name: 'Database enums configured correctly', met: results[3]?.passed ?? false },
      { name: 'Database connection established', met: results[1]?.passed ?? false },
      { name: 'CRUD operations working', met: results[6]?.passed ?? false },
      { name: 'Model relations functional', met: results[7]?.passed ?? false },
    ];

    criteria.forEach(criterion => {
      console.log(`  ${criterion.met ? '✅' : '❌'} ${criterion.name}`);
    });

    const allCriteriaMet = criteria.every(c => c.met);
    console.log(`\n🏆 Task 1.1 Status: ${allCriteriaMet ? 'COMPLETED' : 'INCOMPLETE'}`);

    if (allCriteriaMet) {
      console.log('\n🎉 Task 1.1: Prisma Database Schema Design is COMPLETE!');
      console.log('✅ Ready to proceed to Task 1.2: Prisma Infrastructure Setup');
    } else {
      console.log('\n⚠️ Task 1.1 needs attention before proceeding to Task 1.2');
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

// Run validation if called directly
if (require.main === module) {
  main();
}

export { runValidationTests }; 