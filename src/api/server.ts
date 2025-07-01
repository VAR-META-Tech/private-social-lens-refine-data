/**
 * Express API Server
 * Main HTTP API server for the batch refinement service
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import rateLimit from 'express-rate-limit';
import { container } from '../core/container.js';
import { logger } from '../services/logging.service.js';

// Import route handlers
import jobRoutes from './routes/jobs.js';
import configRoutes from './routes/config.js';
import statsRoutes from './routes/stats.js';
import healthRoutes from './routes/health.js';

// Import middleware
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { authMiddleware } from './middleware/auth.js';

export class ApiServer {
  private app: express.Application;
  private server?: any;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSwagger();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Stricter rate limiting for sensitive endpoints
    const strictLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20, // Limit each IP to 20 requests per windowMs
      message: {
        error: 'Too many requests to sensitive endpoint, please try again later',
        retryAfter: '15 minutes'
      }
    });
    this.app.use('/api/jobs', strictLimiter);
    this.app.use('/api/config', strictLimiter);

    // Request logging
    this.app.use(requestLogger);
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.use('/api/health', healthRoutes);

    // API documentation
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Batch Refinement API',
        version: '1.0.0',
        description: 'REST API for batch refinement service management',
        endpoints: {
          health: '/api/health',
          jobs: '/api/jobs',
          config: '/api/config',
          stats: '/api/stats',
          docs: '/api/docs'
        },
        timestamp: new Date().toISOString()
      });
    });

    // Protected API routes
    this.app.use('/api/jobs', authMiddleware, jobRoutes);
    this.app.use('/api/config', authMiddleware, configRoutes);
    this.app.use('/api/stats', authMiddleware, statsRoutes);

    // 404 handler for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Batch Refinement Service',
        status: 'running',
        api: '/api',
        docs: '/api/docs',
        health: '/api/health',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Setup Swagger API documentation
   */
  private setupSwagger(): void {
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'Batch Refinement API',
          version: '1.0.0',
          description: 'REST API for managing batch refinement jobs, configuration, and monitoring',
          contact: {
            name: 'API Support',
            email: 'support@batchrefinement.com'
          },
        },
        servers: [
          {
            url: `http://localhost:${this.port}`,
            description: 'Development server'
          },
          {
            url: 'https://api.batchrefinement.com',
            description: 'Production server'
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            },
            apiKey: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key'
            }
          }
        },
        security: [
          { bearerAuth: [] },
          { apiKey: [] }
        ]
      },
      apis: [
        './src/api/routes/*.ts',
        './src/api/routes/*.js'
      ],
    };

    const specs = swaggerJsdoc(swaggerOptions);
    this.app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Batch Refinement API Documentation'
    }));
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Start the API server
   */
  async start(): Promise<void> {
    try {
      // Initialize container and services
      await container.initialize();
      
      logger.info('API server dependencies initialized', {}, 'ApiServer');

      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        logger.info('API server started', {
          operation: 'server-start',
          metadata: {
            port: this.port,
            environment: process.env.NODE_ENV || 'development',
            endpoints: {
              api: `http://localhost:${this.port}/api`,
              docs: `http://localhost:${this.port}/api/docs`,
              health: `http://localhost:${this.port}/api/health`
            }
          }
        }, 'ApiServer');

        console.log(`🚀 API Server running on http://localhost:${this.port}`);
        console.log(`📚 API Documentation: http://localhost:${this.port}/api/docs`);
        console.log(`❤️ Health Check: http://localhost:${this.port}/api/health`);
      });

      // Handle server errors
      this.server.on('error', (error: any) => {
        logger.error('API server error', error, {}, 'ApiServer');
        throw error;
      });

    } catch (error) {
      logger.error('Failed to start API server', error as Error, {}, 'ApiServer');
      throw error;
    }
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server.close((error: any) => {
          if (error) {
            logger.error('Error stopping API server', error, {}, 'ApiServer');
            reject(error);
          } else {
            logger.info('API server stopped', {}, 'ApiServer');
            console.log('🛑 API Server stopped');
            resolve();
          }
        });
      });
    }
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return !!this.server && this.server.listening;
  }
}

export default ApiServer; 