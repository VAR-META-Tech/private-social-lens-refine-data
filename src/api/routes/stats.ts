/**
 * Statistics and Reporting Routes
 * Provides endpoints for analytics and performance metrics
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { container } from '@/core';
import { asyncHandler, createApiError } from '../middleware/error-handler';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth';

const router = Router();

// Validation schemas
const timeRangeSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  period: Joi.string().valid('hour', 'day', 'week', 'month').default('day')
});

/**
 * @swagger
 * /api/stats/overview:
 *   get:
 *     tags: [Statistics]
 *     summary: Get system overview statistics
 *     description: Get high-level system statistics and metrics
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time frame for statistics
 *     responses:
 *       200:
 *         description: System overview statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     running: { type: integer }
 *                     completed: { type: integer }
 *                     failed: { type: integer }
 *                 processing:
 *                   type: object
 *                   properties:
 *                     totalFiles: { type: integer }
 *                     successRate: { type: number }
 *                     averageProcessingTime: { type: number }
 *                 performance:
 *                   type: object
 *                   properties:
 *                     totalGasUsed: { type: string }
 *                     averageGasPerFile: { type: string }
 *                     throughputPerHour: { type: number }
 */
router.get('/overview', requirePermission('read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const batchStats = container.getBatchStatisticsService();
  const jobScheduler = container.getJobSchedulerService();

  const timeframe = req.query.timeframe as string || '24h';
  const timeframeDuration = parseTimeframe(timeframe);
  const since = new Date(Date.now() - timeframeDuration);

  // Get job statistics
  const jobStats = await jobScheduler.getJobStatistics(since);

  // Get processing statistics
  const processingStats = await batchStats.getProcessingStatistics(since);

  // Get performance metrics
  const performanceStats = await batchStats.getPerformanceStatistics(since);

  res.json({
    timeframe,
    since: since.toISOString(),
    jobs: {
      total: jobStats.total,
      running: jobStats.running,
      completed: jobStats.completed,
      failed: jobStats.failed,
      pending: jobStats.pending,
      successRate: jobStats.total > 0 ? (jobStats.completed / jobStats.total) * 100 : 0
    },
    processing: {
      totalFiles: processingStats.totalFiles,
      successFiles: processingStats.successFiles,
      failedFiles: processingStats.failedFiles,
      successRate: processingStats.totalFiles > 0 ? (processingStats.successFiles / processingStats.totalFiles) * 100 : 0,
      averageProcessingTime: processingStats.averageProcessingTime
    },
    performance: {
      totalGasUsed: performanceStats.totalGasUsed.toString(),
      averageGasPerFile: performanceStats.averageGasPerFile.toString(),
      throughputPerHour: performanceStats.throughputPerHour,
      totalProcessingTime: performanceStats.totalProcessingTime
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/stats/jobs:
 *   get:
 *     tags: [Statistics]
 *     summary: Get job statistics
 *     description: Get detailed job execution statistics
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for statistics
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *         description: Aggregation period
 *     responses:
 *       200:
 *         description: Job statistics
 */
router.get('/jobs', requirePermission('read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { error, value } = timeRangeSchema.validate(req.query);
  if (error) {
    throw createApiError('Invalid query parameters', 400, 'VALIDATION_ERROR', error.details);
  }

  const batchStats = container.getBatchStatisticsService();

  const startDate = value.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days ago
  const endDate = value.endDate || new Date();
  const period = value.period;

  const stats = await batchStats.getJobStatisticsByPeriod(startDate, endDate, period);

  res.json({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    period,
    data: stats,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/stats/performance:
 *   get:
 *     tags: [Statistics]
 *     summary: Get performance metrics
 *     description: Get system performance and throughput metrics
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for metrics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for metrics
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly]
 *           default: daily
 *         description: Data granularity
 *     responses:
 *       200:
 *         description: Performance metrics
 */
router.get('/performance', requirePermission('read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const batchStats = container.getBatchStatisticsService();

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
  const granularity = req.query.granularity as string || 'daily';

  const performanceMetrics = await batchStats.getPerformanceMetrics(startDate, endDate, granularity);

  res.json({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    granularity,
    metrics: performanceMetrics,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/stats/processing:
 *   get:
 *     tags: [Statistics]
 *     summary: Get file processing statistics
 *     description: Get detailed file processing success/failure statistics
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for statistics
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [status, hour, day]
 *           default: status
 *         description: Group results by field
 *     responses:
 *       200:
 *         description: File processing statistics
 */
router.get('/processing', requirePermission('read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const batchStats = container.getBatchStatisticsService();

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
  const groupBy = req.query.groupBy as string || 'status';

  const processingStats = await batchStats.getFileProcessingStatistics(startDate, endDate, groupBy);

  res.json({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    groupBy,
    statistics: processingStats,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/stats/errors:
 *   get:
 *     tags: [Statistics]
 *     summary: Get error statistics
 *     description: Get error analysis and failure patterns
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for error analysis
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for error analysis
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of top errors to return
 *     responses:
 *       200:
 *         description: Error statistics
 */
router.get('/errors', requirePermission('read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const batchStats = container.getBatchStatisticsService();

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const errorStats = await batchStats.getErrorStatistics(startDate, endDate, limit);

  res.json({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit,
    errors: errorStats,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/stats/trends:
 *   get:
 *     tags: [Statistics]
 *     summary: Get trend analysis
 *     description: Get performance trends and forecasting data
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [throughput, success_rate, processing_time, gas_usage]
 *           default: throughput
 *         description: Metric to analyze
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *         description: Analysis period
 *     responses:
 *       200:
 *         description: Trend analysis
 */
router.get('/trends', requirePermission('read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const batchStats = container.getBatchStatisticsService();

  const metric = req.query.metric as string || 'throughput';
  const period = req.query.period as string || '30d';

  const periodMs = parsePeriod(period);
  const startDate = new Date(Date.now() - periodMs);
  const endDate = new Date();

  const trendData = await batchStats.getTrendAnalysis(metric, startDate, endDate);

  res.json({
    metric,
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    trend: trendData,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/stats/export:
 *   get:
 *     tags: [Statistics]
 *     summary: Export statistics
 *     description: Export statistics data in CSV format
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [jobs, processing, performance, errors]
 *           default: jobs
 *         description: Type of data to export
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for export
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for export
 *     responses:
 *       200:
 *         description: CSV data
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export', requirePermission('read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const batchStats = container.getBatchStatisticsService();

  const type = req.query.type as string || 'jobs';
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

  const csvData = await batchStats.exportStatistics(type, startDate, endDate);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="batch-refinement-${type}-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv"`);

  res.send(csvData);
}));

/**
 * Parse timeframe string to milliseconds
 */
function parseTimeframe(timeframe: string): number {
  const timeframes: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };

  return timeframes[timeframe] || timeframes['24h'];
}

/**
 * Parse period string to milliseconds
 */
function parsePeriod(period: string): number {
  const periods: Record<string, number> = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000
  };

  return periods[period] || periods['30d'];
}

export default router;
