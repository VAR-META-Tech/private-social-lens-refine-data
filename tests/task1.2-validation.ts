/**
 * Task 1.2 Validation Script: Prisma Infrastructure Setup
 * Tests all infrastructure components for Prisma
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { connectionPool } from '../src/database/connection-pool';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

async function runInfrastructureTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  console.log('🧪 Starting Task 1.2 infrastructure validation tests...\n');

  // Test 1: Migration Files Structure
  try {
    console.log('1️⃣ Testing Migration Files Structure...');
    
    const migrationDir = join(process.cwd(), 'prisma', 'migrations');
    const lockFile = join(process.cwd(), 'prisma', 'migrations', 'migration_lock.toml');
    const initialMigration = join(process.cwd(), 'prisma', 'migrations', '20241231000000_initial_schema', 'migration.sql');
    
    const dirExists = await fs.access(migrationDir).then(() => true).catch(() => false);
    const lockExists = await fs.access(lockFile).then(() => true).catch(() => false);
    const migrationExists = await fs.access(initialMigration).then(() => true).catch(() => false);
    
    let lockContent = '';
    if (lockExists) {
      lockContent = await fs.readFile(lockFile, 'utf8');
    }
    
    const structureValid = dirExists && lockExists && migrationExists && 
                          lockContent.includes('provider = "postgresql"');
    
    results.push({
      name: 'Migration Files Structure',
      passed: structureValid,
      details: {
        migrationDirExists: dirExists,
        lockFileExists: lockExists,
        initialMigrationExists: migrationExists,
        lockFileContent: lockContent.trim(),
      }
    });
    console.log(structureValid ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Migration Files Structure',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 2: Migration SQL Content Validation
  try {
    console.log('\n2️⃣ Testing Migration SQL Content...');
    
    const migrationFile = join(process.cwd(), 'prisma', 'migrations', '20241231000000_initial_schema', 'migration.sql');
    const sqlContent = await fs.readFile(migrationFile, 'utf8');
    
    const expectedTables = [
      'refinement_jobs',
      'file_processing_logs',
      'batch_statistics',
      'processing_queue',
      'system_config',
      'schema_version'
    ];
    
    const expectedEnums = [
      'JobStatus',
      'JobType',
      'ProcessingStatus',
      'QueueStatus',
      'ConfigDataType'
    ];
    
    const expectedIndexes = [
      'refinement_jobs_status_idx',
      'file_processing_logs_jobId_idx',
      'batch_statistics_jobId_idx'
    ];
    
    const tablesPresent = expectedTables.every(table => 
      sqlContent.includes(`CREATE TABLE "${table}"`)
    );
    
    const enumsPresent = expectedEnums.every(enumType => 
      sqlContent.includes(`CREATE TYPE "${enumType}"`)
    );
    
    const indexesPresent = expectedIndexes.every(index => 
      sqlContent.includes(`CREATE INDEX "${index}"`)
    );
    
    const foreignKeysPresent = sqlContent.includes('ADD CONSTRAINT') && 
                              sqlContent.includes('FOREIGN KEY');
    
    const contentValid = tablesPresent && enumsPresent && indexesPresent && foreignKeysPresent;
    
    results.push({
      name: 'Migration SQL Content',
      passed: contentValid,
      details: {
        tablesPresent,
        enumsPresent,
        indexesPresent,
        foreignKeysPresent,
        expectedTables: expectedTables.length,
        expectedEnums: expectedEnums.length,
        expectedIndexes: expectedIndexes.length,
      }
    });
    console.log(contentValid ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Migration SQL Content',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 3: Connection Pool Configuration
  try {
    console.log('\n3️⃣ Testing Connection Pool Configuration...');
    
    const poolConfig = connectionPool.getConfig();
    const configValid = poolConfig.maxConnections > 0 && 
                       poolConfig.connectionTimeout > 0 &&
                       poolConfig.idleTimeout > 0;
    
    results.push({
      name: 'Connection Pool Configuration',
      passed: configValid,
      details: poolConfig
    });
    console.log(configValid ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Connection Pool Configuration',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 4: Database Seeding Setup
  try {
    console.log('\n4️⃣ Testing Database Seeding Setup...');
    
    const seedFile = join(process.cwd(), 'prisma', 'seed.ts');
    const packageJson = join(process.cwd(), 'package.json');
    
    const seedExists = await fs.access(seedFile).then(() => true).catch(() => false);
    
    let packageContent = '';
    let seedConfigured = false;
    
    if (await fs.access(packageJson).then(() => true).catch(() => false)) {
      packageContent = await fs.readFile(packageJson, 'utf8');
      const parsed = JSON.parse(packageContent);
      seedConfigured = parsed.prisma && parsed.prisma.seed;
    }
    
    let seedContent = '';
    if (seedExists) {
      seedContent = await fs.readFile(seedFile, 'utf8');
    }
    
    const seedHasContent = seedContent.includes('SystemConfig') && 
                          seedContent.includes('RefinementJob') &&
                          seedContent.includes('prisma.') &&
                          seedContent.includes('createMany');
    
    const seedingValid = seedExists && seedConfigured && seedHasContent;
    
    results.push({
      name: 'Database Seeding Setup',
      passed: seedingValid,
      details: {
        seedFileExists: seedExists,
        seedConfiguredInPackage: seedConfigured,
        seedHasContent: seedHasContent,
      }
    });
    console.log(seedingValid ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Database Seeding Setup',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 5: NPM Scripts Configuration
  try {
    console.log('\n5️⃣ Testing NPM Scripts Configuration...');
    
    const packageFile = join(process.cwd(), 'package.json');
    const packageContent = await fs.readFile(packageFile, 'utf8');
    const parsed = JSON.parse(packageContent);
    
    const expectedScripts = [
      'db:migrate',
      'db:generate',
      'db:studio', 
      'db:seed',
      'db:reset',
      'db:deploy',
      'db:status'
    ];
    
    const scriptsPresent = expectedScripts.every(script => 
      parsed.scripts && parsed.scripts[script]
    );
    
    results.push({
      name: 'NPM Scripts Configuration',
      passed: scriptsPresent,
      details: {
        scriptsConfigured: expectedScripts.filter(script => 
          parsed.scripts && parsed.scripts[script]
        ),
        missingScripts: expectedScripts.filter(script => 
          !parsed.scripts || !parsed.scripts[script]
        ),
      }
    });
    console.log(scriptsPresent ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'NPM Scripts Configuration',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  // Test 6: Prisma Dependencies
  try {
    console.log('\n6️⃣ Testing Prisma Dependencies...');
    
    const packageFile = join(process.cwd(), 'package.json');
    const packageContent = await fs.readFile(packageFile, 'utf8');
    const parsed = JSON.parse(packageContent);
    
    const hasPrisma = parsed.dependencies && parsed.dependencies['prisma'];
    const hasPrismaClient = parsed.dependencies && parsed.dependencies['@prisma/client'];
    const hasNodeCron = parsed.dependencies && parsed.dependencies['node-cron'];
    const hasTsx = parsed.dependencies && parsed.dependencies['tsx'];
    
    const depsValid = hasPrisma && hasPrismaClient && hasNodeCron && hasTsx;
    
    results.push({
      name: 'Prisma Dependencies',
      passed: depsValid,
      details: {
        hasPrisma,
        hasPrismaClient,
        hasNodeCron,
        hasTsx,
        prismaVersion: parsed.dependencies?.['prisma'],
        clientVersion: parsed.dependencies?.['@prisma/client'],
      }
    });
    console.log(depsValid ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    results.push({
      name: 'Prisma Dependencies',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('❌ FAIL');
  }

  return results;
}

async function main() {
  try {
    const results = await runInfrastructureTests();
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 TASK 1.2 VALIDATION SUMMARY');
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
      { name: 'Prisma migrations initialized', met: results[0]?.passed ?? false },
      { name: 'Migration SQL properly structured', met: results[1]?.passed ?? false },
      { name: 'Connection pooling configured', met: results[2]?.passed ?? false },
      { name: 'Database seeding setup', met: results[3]?.passed ?? false },
      { name: 'NPM scripts configured', met: results[4]?.passed ?? false },
      { name: 'All dependencies installed', met: results[5]?.passed ?? false },
    ];

    criteria.forEach(criterion => {
      console.log(`  ${criterion.met ? '✅' : '❌'} ${criterion.name}`);
    });

    const allCriteriaMet = criteria.every(c => c.met);
    console.log(`\n🏆 Task 1.2 Status: ${allCriteriaMet ? 'COMPLETED' : 'INCOMPLETE'}`);

    if (allCriteriaMet) {
      console.log('\n🎉 Task 1.2: Prisma Infrastructure Setup is COMPLETE!');
      console.log('✅ Ready to proceed to Phase 2: Core Service Refactoring');
    } else {
      console.log('\n⚠️ Task 1.2 needs attention before proceeding to Phase 2');
    }

  } catch (error) {
    console.error('❌ Infrastructure validation failed:', error);
    process.exit(1);
  }
}

// Run validation if called directly
if (require.main === module) {
  main();
}

export { runInfrastructureTests }; 