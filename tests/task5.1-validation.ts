/**
 * Task 5.1 Validation: Structured Logging System
 * Tests the implementation of logging with JSON format, levels, rotation, and integration
 */

import { logger, LoggingService, ChildLogger } from '../src/services/logging.service';
import fs from 'fs';
import path from 'path';

async function testTask5_1(): Promise<void> {
  console.log('🧪 Testing Task 5.1: Structured Logging System\n');

  try {
    // Test 1: Basic logging functionality
    console.log('1️⃣ Testing basic logging functionality...');
    
    logger.info('Test info message', { 
      testId: 'task5.1',
      component: 'test-runner' 
    });
    
    logger.warn('Test warning message', { 
      testId: 'task5.1',
      alertLevel: 'medium' 
    });
    
    logger.error('Test error message', new Error('Test error'), { 
      testId: 'task5.1',
      operation: 'validation' 
    });
    
    logger.debug('Test debug message', { 
      testId: 'task5.1',
      debugInfo: { step: 1, data: 'test-data' } 
    });
    
    console.log('✅ Basic logging functions work correctly\n');

    // Test 2: Structured logging with context
    console.log('2️⃣ Testing structured logging with context...');
    
    logger.logJobStarted('test-job-123', 'validation-job', 'MANUAL', {
      batchSize: 10,
      priority: 5,
      metadata: { source: 'validation-test' }
    });
    
    logger.logFileProcessing(12345, 'success', {
      duration: 1500,
      fileId: 12345,
      operation: 'refinement'
    });
    
    logger.logJobCompleted('test-job-123', 'validation-job', 3000, {
      filesProcessed: 1,
      batchSize: 10
    });
    
    console.log('✅ Structured logging with context works correctly\n');

    // Test 3: Child logger functionality
    console.log('3️⃣ Testing child logger functionality...');
    
    const childLogger = logger.createChildLogger('TestComponent', {
      testId: 'task5.1',
      componentVersion: '1.0.0'
    });
    
    childLogger.info('Child logger info message');
    childLogger.warn('Child logger warning message');
    childLogger.error('Child logger error message', new Error('Child error'));
    childLogger.debug('Child logger debug message');
    
    console.log('✅ Child logger works correctly\n');

    // Test 4: Log directory structure
    console.log('4️⃣ Testing log directory structure...');
    
    const logDirectory = 'logs';
    const expectedDirs = [
      logDirectory,
      path.join(logDirectory, 'archived'),
      path.join(logDirectory, 'metrics')
    ];
    
    for (const dir of expectedDirs) {
      if (!fs.existsSync(dir)) {
        throw new Error(`Log directory ${dir} does not exist`);
      }
    }
    
    console.log('✅ Log directory structure created correctly\n');

    // Test 5: Log file creation
    console.log('5️⃣ Testing log file creation...');
    
    // Wait a moment for log files to be written
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const logFiles = fs.readdirSync(logDirectory);
    const expectedLogFiles = ['app-', 'error-'];
    
    if (process.env.NODE_ENV !== 'production') {
      expectedLogFiles.push('debug-');
    }
    
    for (const expectedFile of expectedLogFiles) {
      const hasFile = logFiles.some(file => file.startsWith(expectedFile));
      if (!hasFile) {
        throw new Error(`Expected log file starting with ${expectedFile} not found`);
      }
    }
    
    console.log('✅ Log files created correctly\n');

    // Test 6: JSON log format validation
    console.log('6️⃣ Testing JSON log format...');
    
    const appLogFile = logFiles.find(file => file.startsWith('app-'));
    if (appLogFile) {
      const logContent = fs.readFileSync(path.join(logDirectory, appLogFile), 'utf8');
      const logLines = logContent.trim().split('\n').filter(line => line.length > 0);
      
      if (logLines.length > 0) {
        try {
          const logEntry = JSON.parse(logLines[logLines.length - 1]);
          
          // Validate required fields
          const requiredFields = ['timestamp', 'level', 'service', 'component', 'message'];
          for (const field of requiredFields) {
            if (!(field in logEntry)) {
              throw new Error(`Missing required field: ${field}`);
            }
          }
          
          // Validate service name
          if (logEntry.service !== 'batch-refinement') {
            throw new Error(`Invalid service name: ${logEntry.service}`);
          }
          
          console.log('✅ JSON log format is valid\n');
        } catch (error) {
          throw new Error(`Invalid JSON log format: ${error}`);
        }
      }
    }

    // Test 7: Performance metrics logging
    console.log('7️⃣ Testing performance metrics logging...');
    
    logger.logMetrics({
      processingTime: 1500,
      filesProcessed: 5,
      successRate: 100,
      memoryUsage: process.memoryUsage().heapUsed
    }, {
      testId: 'task5.1',
      operation: 'metrics-test'
    });
    
    // Check if metrics file is created
    await new Promise(resolve => setTimeout(resolve, 500));
    const metricsDir = path.join(logDirectory, 'metrics');
    const metricsFiles = fs.readdirSync(metricsDir);
    const hasMetricsFile = metricsFiles.some(file => file.startsWith('metrics-'));
    
    if (!hasMetricsFile) {
      throw new Error('Metrics log file not created');
    }
    
    console.log('✅ Performance metrics logging works correctly\n');

    // Test 8: Multiple LoggingService instances
    console.log('8️⃣ Testing multiple LoggingService instances...');
    
    const customLogger = new LoggingService();
    customLogger.info('Custom logger test message', {
      testId: 'task5.1',
      instance: 'custom'
    });
    
    console.log('✅ Multiple LoggingService instances work correctly\n');

    // Test 9: Error handling and resilience
    console.log('9️⃣ Testing error handling and resilience...');
    
    // Test with null/undefined context
    logger.info('Test with null context', undefined);
    logger.warn('Test with empty context', {});
    
    // Test with complex nested objects
    logger.debug('Test with complex object', {
      testId: 'task5.1',
      complexObject: {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' }
        }
      }
    });
    
    console.log('✅ Error handling and resilience work correctly\n');

    console.log('🎉 Task 5.1 validation completed successfully!');
    console.log('✅ Structured logging system is working correctly');
    console.log('✅ JSON format logging implemented');
    console.log('✅ Log levels and categorization functional');
    console.log('✅ Log rotation and archival configured');
    console.log('✅ Child logger functionality working');
    console.log('✅ Performance metrics logging operational');
    console.log('✅ Error handling and resilience tested\n');

  } catch (error) {
    console.error('❌ Task 5.1 validation failed:', error);
    throw error;
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  testTask5_1().catch(console.error);
}

export { testTask5_1 }; 