/**
 * Job Management Routes
 * Provides endpoints for managing refinement jobs
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { container } from '../../core/container.js';
import { asyncHandler, createApiError } from '../middleware/error-handler.js';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const createJobSchema = Joi.object({
  jobName: Joi.string().required().min(1).max(255),
  jobType: Joi.string().valid('SCHEDULED_BATCH', 'RANGE_BASED', 'CLEANUP', 'HEALTH_CHECK', 'MANUAL').required(),
  cronSchedule: Joi.string().when('jobType', {
    is: 'SCHEDULED_BATCH',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  startFileId: Joi.number().integer().min(1).when('jobType', {
    is: 'RANGE_BASED',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  endFileId: Joi.number().integer().min(1).when('jobType', {
    is: 'RANGE_BASED',
    then: Joi.required().min(Joi.ref('startFileId')),
    otherwise: Joi.optional()
  }),
  batchSize: Joi.number().integer().min(1).max(1000).default(10),
  priority: Joi.number().integer().min(1).max(10).default(5),
  metadata: Joi.object().optional()
});

const updateJobSchema = Joi.object({
  jobName: Joi.string().min(1).max(255).optional(),
  cronSchedule: Joi.string().optional(),
  batchSize: Joi.number().integer().min(1).max(1000).optional(),
  priority: Joi.number().integer().min(1).max(10).optional(),
  metadata: Joi.object().optional()
});

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: List refinement jobs
 *     description: Get list of refinement jobs with filtering and pagination
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, RETRYING]
 *         description: Filter by job status
 *       - in: query
 *         name: jobType
 *         schema:
 *           type: string
 *           enum: [SCHEDULED_BATCH, RANGE_BASED, CLEANUP, HEALTH_CHECK, MANUAL]
 *         description: Filter by job type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of jobs to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of jobs to skip
 *     responses:
 *       200:
 *         description: List of jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RefinementJob'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     limit: { type: integer }
 *                     offset: { type: integer }
 */
router.get('/', requirePermission('read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const jobScheduler = container.getJobSchedulerService();
  
  const filters = {
    status: req.query.status as string,
    jobType: req.query.jobType as string
  };
  
  const pagination = {
    limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
    offset: parseInt(req.query.offset as string) || 0
  };

  const jobs = await jobScheduler.listJobs(filters, pagination);
  const total = await jobScheduler.getJobCount(filters);

  res.json({
    jobs,
    pagination: {
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasNext: pagination.offset + pagination.limit < total,
      hasPrev: pagination.offset > 0
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/jobs/{jobId}:
 *   get:
 *     tags: [Jobs]
 *     summary: Get job details
 *     description: Get detailed information about a specific job
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job details
 *       404:
 *         description: Job not found
 */
router.get('/:jobId', requirePermission('read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const jobScheduler = container.getJobSchedulerService();
  const batchStats = container.getBatchStatisticsService();
  
  const job = await jobScheduler.getJobById(req.params.jobId);
  if (!job) {
    throw createApiError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  // Get job statistics if available
  let statistics = null;
  try {
    statistics = await batchStats.getBatchStatistics(req.params.jobId);
  } catch (error) {
    // Statistics may not exist for all jobs
  }

  res.json({
    job,
    statistics,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     tags: [Jobs]
 *     summary: Create new job
 *     description: Create a new refinement job
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobName
 *               - jobType
 *             properties:
 *               jobName: { type: string, minLength: 1, maxLength: 255 }
 *               jobType: { type: string, enum: [SCHEDULED_BATCH, RANGE_BASED, CLEANUP, HEALTH_CHECK, MANUAL] }
 *               cronSchedule: { type: string }
 *               startFileId: { type: integer, minimum: 1 }
 *               endFileId: { type: integer, minimum: 1 }
 *               batchSize: { type: integer, minimum: 1, maximum: 1000, default: 10 }
 *               priority: { type: integer, minimum: 1, maximum: 10, default: 5 }
 *               metadata: { type: object }
 *     responses:
 *       201:
 *         description: Job created successfully
 *       400:
 *         description: Invalid job data
 */
router.post('/', requirePermission('write'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { error, value } = createJobSchema.validate(req.body);
  if (error) {
    throw createApiError('Invalid job data', 400, 'VALIDATION_ERROR', error.details);
  }

  const jobScheduler = container.getJobSchedulerService();
  
  const jobData = {
    ...value,
    createdBy: req.user?.id || 'api-user'
  };

  const job = await jobScheduler.createJob(jobData);

  res.status(201).json({
    message: 'Job created successfully',
    job,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/jobs/{jobId}:
 *   put:
 *     tags: [Jobs]
 *     summary: Update job
 *     description: Update job configuration (only for non-running jobs)
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jobName: { type: string, minLength: 1, maxLength: 255 }
 *               cronSchedule: { type: string }
 *               batchSize: { type: integer, minimum: 1, maximum: 1000 }
 *               priority: { type: integer, minimum: 1, maximum: 10 }
 *               metadata: { type: object }
 *     responses:
 *       200:
 *         description: Job updated successfully
 *       404:
 *         description: Job not found
 *       409:
 *         description: Cannot update running job
 */
router.put('/:jobId', requirePermission('write'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { error, value } = updateJobSchema.validate(req.body);
  if (error) {
    throw createApiError('Invalid job data', 400, 'VALIDATION_ERROR', error.details);
  }

  const jobScheduler = container.getJobSchedulerService();
  
  const job = await jobScheduler.getJobById(req.params.jobId);
  if (!job) {
    throw createApiError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  if (job.status === 'RUNNING') {
    throw createApiError('Cannot update running job', 409, 'JOB_RUNNING');
  }

  const updatedJob = await jobScheduler.updateJob(req.params.jobId, value);

  res.json({
    message: 'Job updated successfully',
    job: updatedJob,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/jobs/{jobId}/start:
 *   post:
 *     tags: [Jobs]
 *     summary: Start job
 *     description: Start a pending job manually
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job started successfully
 *       404:
 *         description: Job not found
 *       409:
 *         description: Job cannot be started
 */
router.post('/:jobId/start', requirePermission('write'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const jobScheduler = container.getJobSchedulerService();
  
  const job = await jobScheduler.getJobById(req.params.jobId);
  if (!job) {
    throw createApiError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  if (job.status !== 'PENDING') {
    throw createApiError(`Job cannot be started (current status: ${job.status})`, 409, 'INVALID_JOB_STATUS');
  }

  await jobScheduler.startJob(req.params.jobId);

  res.json({
    message: 'Job started successfully',
    jobId: req.params.jobId,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/jobs/{jobId}/stop:
 *   post:
 *     tags: [Jobs]
 *     summary: Stop job
 *     description: Stop a running job
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job stopped successfully
 *       404:
 *         description: Job not found
 *       409:
 *         description: Job cannot be stopped
 */
router.post('/:jobId/stop', requirePermission('write'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const jobScheduler = container.getJobSchedulerService();
  
  const job = await jobScheduler.getJobById(req.params.jobId);
  if (!job) {
    throw createApiError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  if (job.status !== 'RUNNING') {
    throw createApiError(`Job cannot be stopped (current status: ${job.status})`, 409, 'INVALID_JOB_STATUS');
  }

  await jobScheduler.stopJob(req.params.jobId);

  res.json({
    message: 'Job stopped successfully',
    jobId: req.params.jobId,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/jobs/{jobId}/retry:
 *   post:
 *     tags: [Jobs]
 *     summary: Retry failed job
 *     description: Retry a failed job
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job retry scheduled
 *       404:
 *         description: Job not found
 *       409:
 *         description: Job cannot be retried
 */
router.post('/:jobId/retry', requirePermission('write'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const jobScheduler = container.getJobSchedulerService();
  
  const job = await jobScheduler.getJobById(req.params.jobId);
  if (!job) {
    throw createApiError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  if (job.status !== 'FAILED') {
    throw createApiError(`Job cannot be retried (current status: ${job.status})`, 409, 'INVALID_JOB_STATUS');
  }

  await jobScheduler.retryJob(req.params.jobId);

  res.json({
    message: 'Job retry scheduled',
    jobId: req.params.jobId,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/jobs/{jobId}:
 *   delete:
 *     tags: [Jobs]
 *     summary: Delete job
 *     description: Delete a job (only non-running jobs)
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job deleted successfully
 *       404:
 *         description: Job not found
 *       409:
 *         description: Cannot delete running job
 */
router.delete('/:jobId', requirePermission('write'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const jobScheduler = container.getJobSchedulerService();
  
  const job = await jobScheduler.getJobById(req.params.jobId);
  if (!job) {
    throw createApiError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  if (job.status === 'RUNNING') {
    throw createApiError('Cannot delete running job', 409, 'JOB_RUNNING');
  }

  await jobScheduler.deleteJob(req.params.jobId);

  res.json({
    message: 'Job deleted successfully',
    jobId: req.params.jobId,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/jobs/{jobId}/logs:
 *   get:
 *     tags: [Jobs]
 *     summary: Get job processing logs
 *     description: Get file processing logs for a specific job
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PROCESSING, SUCCESS, FAILED, SKIPPED, ALREADY_REFINED]
 *         description: Filter by processing status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Number of logs to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of logs to skip
 *     responses:
 *       200:
 *         description: Job processing logs
 *       404:
 *         description: Job not found
 */
router.get('/:jobId/logs', requirePermission('read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const jobScheduler = container.getJobSchedulerService();
  
  const job = await jobScheduler.getJobById(req.params.jobId);
  if (!job) {
    throw createApiError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  const filters = {
    jobId: req.params.jobId,
    status: req.query.status as string
  };
  
  const pagination = {
    limit: Math.min(parseInt(req.query.limit as string) || 100, 1000),
    offset: parseInt(req.query.offset as string) || 0
  };

  const logs = await jobScheduler.getJobLogs(filters, pagination);
  const total = await jobScheduler.getJobLogCount(filters);

  res.json({
    jobId: req.params.jobId,
    logs,
    pagination: {
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasNext: pagination.offset + pagination.limit < total,
      hasPrev: pagination.offset > 0
    },
    timestamp: new Date().toISOString()
  });
}));

export default router; 