/**
 * Prisma Database Client
 * Single instance of Prisma client with proper configuration
 */

import { PrismaClient, Prisma } from '@/generated/prisma';

// Global variable for Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * Create and configure Prisma client instance
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  // Add query performance monitoring in development
  if (process.env.NODE_ENV === 'development') {
    client.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();

      const duration = after - before;
      if (duration > 1000) {
        console.warn(`⚠️ Slow query detected: ${params.model}.${params.action} (${duration}ms)`);
      }

      return result;
    });
  }

  return client;
}

/**
 * Get or create Prisma client instance (singleton pattern)
 */
function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    // In production, always create a new instance
    return createPrismaClient();
  } else {
    // In development, reuse the instance to avoid connection exhaustion
    if (!global.__prisma) {
      global.__prisma = createPrismaClient();
    }
    return global.__prisma;
  }
}

// Export the singleton instance
export const prisma = getPrismaClient();

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
    throw error;
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 as test`;
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

/**
 * Get database connection info
 */
export async function getDatabaseInfo() {
  try {
    const result = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT version() as version
    `;

    return {
      connected: true,
      version: result[0]?.version || 'Unknown',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Health check for the database
 */
export async function healthCheck() {
  const startTime = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1 as health_check`;
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, closing database connections...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, closing database connections...');
  await disconnectDatabase();
  process.exit(0);
});

export default prisma;
