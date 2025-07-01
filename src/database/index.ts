/**
 * Database Module Re-exports
 * Provides clean access to database client and connection pool
 */

// Client exports
export { 
  prisma,
  connectDatabase,
  disconnectDatabase,
  testConnection,
  getDatabaseInfo,
  healthCheck
} from './client'

// Default export for prisma client
export { default as prismaClient } from './client'

// Connection pool exports
export { PrismaConnectionPool, connectionPool } from './connection-pool' 