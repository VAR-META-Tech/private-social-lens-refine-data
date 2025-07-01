/**
 * Health Check Routes
 * Provides health monitoring endpoints
 */

import { Router, Request, Response } from 'express';
import { container } from '@/core';
import { asyncHandler } from '@/api';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Basic health check
 *     description: Returns basic server health status
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
}));

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     tags: [Health]
 *     summary: Detailed health check
 *     description: Returns detailed system health including database and services
 *     responses:
 *       200:
 *         description: Detailed health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                     scheduler:
 *                       type: object
 *                     system:
 *                       type: object
 */
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const healthService = container.getHealthMonitoringService();

  const healthChecks = await healthService.performFullHealthCheck();
  const systemMetrics = await healthService.collectSystemMetrics();

  const checkValues = Object.values(healthChecks);
  const overallStatus = checkValues.every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy';

  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: Object.keys(healthChecks).reduce((acc, component) => {
      const check = healthChecks[component];
      acc[component] = {
        status: check.status,
        message: check.message,
        responseTime: check.responseTime,
        lastChecked: check.lastChecked
      };
      return acc;
    }, {} as any),
    metrics: {
      cpu: systemMetrics.cpu,
      memory: systemMetrics.memory,
      jobs: systemMetrics.jobs
    }
  });
}));

/**
 * @swagger
 * /api/health/metrics:
 *   get:
 *     tags: [Health]
 *     summary: System metrics
 *     description: Returns current system performance metrics
 *     responses:
 *       200:
 *         description: System metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cpu:
 *                   type: object
 *                 memory:
 *                   type: object
 *                 jobs:
 *                   type: object
 */
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const healthService = container.getHealthMonitoringService();
  const metrics = await healthService.collectSystemMetrics();

  res.json({
    timestamp: new Date().toISOString(),
    metrics
  });
}));

/**
 * @swagger
 * /api/health/readiness:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe
 *     description: Kubernetes readiness probe endpoint
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/readiness', asyncHandler(async (req: Request, res: Response) => {
  const healthService = container.getHealthMonitoringService();
  const healthChecks = await healthService.performFullHealthCheck();

  const checkValues = Object.values(healthChecks);
  const isReady = checkValues.every(check => check.status === 'healthy');

  if (isReady) {
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      issues: checkValues.filter(check => check.status !== 'healthy').map(check => ({
        component: check.component,
        message: check.message
      }))
    });
  }
}));

/**
 * @swagger
 * /api/health/liveness:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     description: Kubernetes liveness probe endpoint
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/liveness', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}));

export default router;
