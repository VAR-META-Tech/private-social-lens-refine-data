/**
 * Configuration Management Routes
 * Provides endpoints for managing system configuration
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { container } from '@/core';
import { asyncHandler, createApiError } from '../middleware/error-handler';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';

const router = Router();

// Validation schemas
const configUpdateSchema = Joi.object({
  value: Joi.string().required(),
  description: Joi.string().optional(),
  dataType: Joi.string().valid('STRING', 'INTEGER', 'BOOLEAN', 'JSON').default('STRING')
});

const configCreateSchema = Joi.object({
  key: Joi.string().required().min(1).max(255).pattern(/^[a-zA-Z0-9._-]+$/),
  value: Joi.string().required(),
  description: Joi.string().optional(),
  dataType: Joi.string().valid('STRING', 'INTEGER', 'BOOLEAN', 'JSON').default('STRING'),
  isEncrypted: Joi.boolean().default(false)
});

/**
 * @swagger
 * /api/config:
 *   get:
 *     tags: [Configuration]
 *     summary: List configuration
 *     description: Get all system configuration keys and values
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by configuration category (e.g., 'processing', 'cron')
 *       - in: query
 *         name: includeEncrypted
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include encrypted configuration values (admin only)
 *     responses:
 *       200:
 *         description: Configuration list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 config:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key: { type: string }
 *                       value: { type: string }
 *                       description: { type: string }
 *                       dataType: { type: string }
 *                       isEncrypted: { type: boolean }
 *                       updatedAt: { type: string, format: date-time }
 *                       updatedBy: { type: string }
 */
router.get('/', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const systemConfig = container.getSystemConfigService();

  const category = req.query.category as string;
  const includeEncrypted = req.query.includeEncrypted === 'true';

  let config = await systemConfig.getAllConfig();

  // Filter by category if specified
  if (category) {
    config = config.filter(item => item.key.startsWith(`${category}.`));
  }

  // Remove encrypted values unless specifically requested by admin/system
  if (!includeEncrypted) {
    config = config.map(item => ({
      ...item,
      value: item.isEncrypted ? '[ENCRYPTED]' : item.value
    }));
  }

  res.json({
    config,
    count: config.length,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/config/categories:
 *   get:
 *     tags: [Configuration]
 *     summary: List configuration categories
 *     description: Get list of configuration categories (prefixes)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       count: { type: integer }
 *                       description: { type: string }
 */
router.get('/categories', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const systemConfig = container.getSystemConfigService();

  const allConfig = await systemConfig.getAllConfig();

  // Group by category (prefix before first dot)
  const categoryMap = new Map<string, number>();

  allConfig.forEach(config => {
    const category = config.key.split('.')[0];
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  });

  const categories = Array.from(categoryMap.entries()).map(([name, count]) => ({
    name,
    count,
    description: getCategoryDescription(name)
  }));

  res.json({
    categories,
    totalCategories: categories.length,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/config/{key}:
 *   get:
 *     tags: [Configuration]
 *     summary: Get configuration value
 *     description: Get a specific configuration value by key
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Configuration key
 *       - in: query
 *         name: decrypt
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Decrypt encrypted values (admin only)
 *     responses:
 *       200:
 *         description: Configuration value
 *       404:
 *         description: Configuration key not found
 */
router.get('/:key', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const systemConfig = container.getSystemConfigService();
  const decrypt = req.query.decrypt === 'true';

  // Check if user has admin/system role for encrypted configs
  if (decrypt && !['ADMIN', 'SYSTEM'].includes(req.user?.role || '')) {
    throw createApiError('Admin or system role required to decrypt configuration values', 403, 'INSUFFICIENT_PERMISSIONS');
  }

  const config = await systemConfig.getConfig(req.params.key);
  if (config === null) {
    throw createApiError('Configuration key not found', 404, 'CONFIG_NOT_FOUND');
  }

  // Get full config item with metadata
  const allConfigs = await systemConfig.getAllConfig();
  const configItem = allConfigs.find(item => item.key === req.params.key);
  if (!configItem) {
    throw createApiError('Configuration key not found', 404, 'CONFIG_NOT_FOUND');
  }

  res.json({
    key: req.params.key,
    value: configItem.isEncrypted && !decrypt ? '[ENCRYPTED]' : config,
    description: configItem.description,
    dataType: configItem.dataType,
    isEncrypted: configItem.isEncrypted,
    updatedAt: configItem.updatedAt,
    updatedBy: configItem.updatedBy,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/config:
 *   post:
 *     tags: [Configuration]
 *     summary: Create configuration
 *     description: Create a new configuration key-value pair (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key: { type: string, pattern: '^[a-zA-Z0-9._-]+$', minLength: 1, maxLength: 255 }
 *               value: { type: string }
 *               description: { type: string }
 *               dataType: { type: string, enum: [STRING, INTEGER, BOOLEAN, JSON], default: STRING }
 *               isEncrypted: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Configuration created successfully
 *       400:
 *         description: Invalid configuration data
 *       409:
 *         description: Configuration key already exists
 */
router.post('/', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { error, value } = configCreateSchema.validate(req.body);
  if (error) {
    throw createApiError('Invalid configuration data', 400, 'VALIDATION_ERROR', error.details);
  }

  const systemConfig = container.getSystemConfigService();

  // Check if key already exists
  const existing = await systemConfig.getConfig(value.key);
  if (existing !== null) {
    throw createApiError('Configuration key already exists', 409, 'CONFIG_EXISTS');
  }

  await systemConfig.setConfig(
    value.key,
    value.value,
    value.description,
    value.dataType,
    req.user?.id || 'api-user'
  );

  res.status(201).json({
    message: 'Configuration created successfully',
    key: value.key,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/config/{key}:
 *   put:
 *     tags: [Configuration]
 *     summary: Update configuration
 *     description: Update an existing configuration value (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Configuration key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value: { type: string }
 *               description: { type: string }
 *               dataType: { type: string, enum: [STRING, INTEGER, BOOLEAN, JSON] }
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *       404:
 *         description: Configuration key not found
 *       400:
 *         description: Invalid configuration data
 */
router.put('/:key', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { error, value } = configUpdateSchema.validate(req.body);
  if (error) {
    throw createApiError('Invalid configuration data', 400, 'VALIDATION_ERROR', error.details);
  }

  const systemConfig = container.getSystemConfigService();

  // Check if key exists
  const existing = await systemConfig.getConfig(req.params.key);
  if (existing === null) {
    throw createApiError('Configuration key not found', 404, 'CONFIG_NOT_FOUND');
  }

  const configData = {
    ...value,
    updatedBy: req.user?.id || 'api-user'
  };

  await systemConfig.setConfig(req.params.key, value.value, configData);

  res.json({
    message: 'Configuration updated successfully',
    key: req.params.key,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/config/{key}:
 *   delete:
 *     tags: [Configuration]
 *     summary: Delete configuration
 *     description: Delete a configuration key-value pair (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Configuration key
 *     responses:
 *       200:
 *         description: Configuration deleted successfully
 *       404:
 *         description: Configuration key not found
 */
router.delete('/:key', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const systemConfig = container.getSystemConfigService();

  // Check if key exists
  const existing = await systemConfig.getConfig(req.params.key);
  if (existing === null) {
    throw createApiError('Configuration key not found', 404, 'CONFIG_NOT_FOUND');
  }

  await systemConfig.deleteConfig(req.params.key);

  res.json({
    message: 'Configuration deleted successfully',
    key: req.params.key,
    timestamp: new Date().toISOString()
  });
}));



/**
 * Get description for configuration categories
 */
function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    'processing': 'File processing and batch job settings',
    'cron': 'Scheduled job and cron configurations',
    'api': 'API service settings and endpoints',
    'database': 'Database connection and performance settings',
    'logging': 'Logging configuration and levels',
    'monitoring': 'Health monitoring and alerting settings',
    'security': 'Security and authentication settings',
    'features': 'Feature flags and experimental settings'
  };

  return descriptions[category] || 'Custom configuration category';
}

export default router;
