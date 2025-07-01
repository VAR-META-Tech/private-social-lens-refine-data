/**
 * Prisma Connection Pool Configuration
 * Manages database connections with pooling, monitoring, and health checks
 */

import { PrismaClient } from '../generated/prisma';

interface ConnectionPoolConfig {
  maxConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
  acquireTimeoutMs: number;
}

interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  lastChecked: Date;
}

class PrismaConnectionPool {
  private prisma: PrismaClient | null = null;
  private config: ConnectionPoolConfig;
  private isInitialized = false;
  private stats: PoolStats;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ConnectionPoolConfig>) {
    this.config = {
      maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10', 10),
      connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '20000', 10),
      idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '600000', 10), // 10 minutes
      maxLifetime: parseInt(process.env.DATABASE_MAX_LIFETIME || '3600000', 10), // 1 hour
      acquireTimeoutMs: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT || '60000', 10), // 1 minute
      ...config,
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      pendingRequests: 0,
      lastChecked: new Date(),
    };
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Connection pool already initialized');
      return;
    }

    try {
      // Construct database URL with connection pool parameters
      const baseUrl = process.env.DATABASE_URL || '';
      const pooledUrl = this.addPoolingParameters(baseUrl);

      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: pooledUrl,
          },
        },
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
        errorFormat: 'pretty',
      });

      // Test connection
      await this.prisma.$connect();
      console.log('✅ Prisma connection pool initialized successfully');

      // Start health check monitoring
      this.startHealthCheck();

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Prisma connection pool:', error);
      throw error;
    }
  }

  /**
   * Add connection pooling parameters to database URL
   */
  private addPoolingParameters(url: string): string {
    if (!url) return url;

    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    // Add pooling parameters
    params.set('connection_limit', this.config.maxConnections.toString());
    params.set('pool_timeout', Math.floor(this.config.connectionTimeout / 1000).toString());
    params.set('connect_timeout', Math.floor(this.config.connectionTimeout / 1000).toString());

    // PostgreSQL specific parameters
    if (url.startsWith('postgresql://')) {
      params.set('sslmode', process.env.DATABASE_SSL_MODE || 'prefer');
      params.set('statement_timeout', '30s');
      params.set('idle_in_transaction_session_timeout', '60s');
    }

    urlObj.search = params.toString();
    return urlObj.toString();
  }

  /**
   * Get Prisma client instance
   */
  getClient(): PrismaClient {
    if (!this.isInitialized || !this.prisma) {
      throw new Error('Connection pool not initialized. Call initialize() first.');
    }
    return this.prisma;
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.updatePoolStats();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Update connection pool statistics
   */
  async updatePoolStats(): Promise<void> {
    if (!this.prisma) return;

    try {
      // Simple health check query
      await this.prisma.$queryRaw`SELECT 1 as health_check`;
      
      // Update stats (these would be more accurate with actual pool metrics)
      this.stats = {
        totalConnections: this.config.maxConnections,
        activeConnections: Math.floor(Math.random() * this.config.maxConnections), // Mock data
        idleConnections: Math.floor(Math.random() * this.config.maxConnections), // Mock data
        pendingRequests: 0,
        lastChecked: new Date(),
      };
    } catch (error) {
      console.error('Health check failed:', error);
      this.stats.lastChecked = new Date();
    }
  }

  /**
   * Get connection pool statistics
   */
  getStats(): PoolStats {
    return { ...this.stats };
  }

  /**
   * Get connection pool configuration
   */
  getConfig(): ConnectionPoolConfig {
    return { ...this.config };
  }

  /**
   * Health check for the connection pool
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      config: ConnectionPoolConfig;
      stats: PoolStats;
      lastError?: string;
    };
  }> {
    if (!this.prisma) {
      return {
        status: 'unhealthy',
        details: {
          config: this.config,
          stats: this.stats,
          lastError: 'Connection pool not initialized',
        },
      };
    }

    try {
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1 as health_check`;
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 5000 ? 'healthy' : 'unhealthy',
        details: {
          config: this.config,
          stats: {
            ...this.stats,
            lastChecked: new Date(),
          },
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          config: this.config,
          stats: this.stats,
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Gracefully close the connection pool
   */
  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }

    this.isInitialized = false;
    console.log('✅ Prisma connection pool closed successfully');
  }

  /**
   * Execute a database operation with automatic retry
   */
  async executeWithRetry<T>(
    operation: (client: PrismaClient) => Promise<T>,
    maxRetries = 3,
    retryDelay = 1000
  ): Promise<T> {
    if (!this.prisma) {
      throw new Error('Connection pool not initialized');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation(this.prisma);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          break;
        }

        console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, lastError.message);
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
      }
    }

    throw lastError;
  }

  /**
   * Execute multiple operations in a transaction
   */
  async transaction<T>(operations: (client: PrismaClient) => Promise<T>): Promise<T> {
    if (!this.prisma) {
      throw new Error('Connection pool not initialized');
    }

    return await this.prisma.$transaction(async (tx) => {
      return await operations(tx as PrismaClient);
    });
  }
}

// Export singleton instance
export const connectionPool = new PrismaConnectionPool();

// Export class for custom instances
export { PrismaConnectionPool };

// Export types
export type { ConnectionPoolConfig, PoolStats }; 