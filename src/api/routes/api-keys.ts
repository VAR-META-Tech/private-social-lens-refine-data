/**
 * API Key Management Routes
 * Provides endpoints for managing API keys
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { container } from '@/core';
import { asyncHandler, createApiError } from '../middleware/error-handler';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';

const router = Router();

// Validation schemas
const createApiKeySchema = Joi.object({
  name: Joi.string().required().min(1).max(100).trim(),
  description: Joi.string().optional().max(255).trim(),
  expiresAt: Joi.date().iso().greater('now').optional()
});

const updateApiKeySchema = Joi.object({
  name: Joi.string().optional().min(1).max(100).trim(),
  description: Joi.string().optional().max(255).trim().allow('', null),
  isActive: Joi.boolean().optional()
});

/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     tags: [API Keys]
 *     summary: List API keys
 *     description: Get all API keys (admin/system only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive API keys
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKeys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       keyHint: { type: string }
 *                       description: { type: string }
 *                       isActive: { type: boolean }
 *                       expiresAt: { type: string, format: date-time }
 *                       createdAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 *                 count: { type: integer }
 *                 timestamp: { type: string, format: date-time }
 *       403:
 *         description: Insufficient permissions
 */
router.get('/', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const apiKeyService = container.getApiKeyService();
  const includeInactive = req.query.includeInactive === 'true';

  let apiKeys = await apiKeyService.listApiKeys();

  // Filter out inactive keys unless specifically requested
  if (!includeInactive) {
    apiKeys = apiKeys.filter(key => key.isActive);
  }

  res.json({
    apiKeys,
    count: apiKeys.length,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/api-keys:
 *   post:
 *     tags: [API Keys]
 *     summary: Create API key
 *     description: Create a new API key (admin/system only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 100 }
 *               description: { type: string, maxLength: 255 }
 *               expiresAt: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 apiKey:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     key: { type: string, description: 'Full API key - only shown once' }
 *                     keyHint: { type: string }
 *                     description: { type: string }
 *                     isActive: { type: boolean }
 *                     expiresAt: { type: string, format: date-time }
 *                     createdAt: { type: string, format: date-time }
 *                 timestamp: { type: string, format: date-time }
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { error, value } = createApiKeySchema.validate(req.body);
  if (error) {
    throw createApiError('Invalid API key data', 400, 'VALIDATION_ERROR', error.details);
  }

  const apiKeyService = container.getApiKeyService();
  const apiKey = await apiKeyService.createApiKey(value);

  res.status(201).json({
    message: 'API key created successfully',
    apiKey,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/api-keys/{keyId}:
 *   get:
 *     tags: [API Keys]
 *     summary: Get API key
 *     description: Get a specific API key by ID (admin/system only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     keyHint: { type: string }
 *                     description: { type: string }
 *                     isActive: { type: boolean }
 *                     expiresAt: { type: string, format: date-time }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                 timestamp: { type: string, format: date-time }
 *       404:
 *         description: API key not found
 *       403:
 *         description: Insufficient permissions
 */
router.get('/:keyId', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const apiKeyService = container.getApiKeyService();
  const apiKey = await apiKeyService.getApiKeyById(req.params.keyId);

  if (!apiKey) {
    throw createApiError('API key not found', 404, 'API_KEY_NOT_FOUND');
  }

  res.json({
    apiKey,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/api-keys/{keyId}:
 *   put:
 *     tags: [API Keys]
 *     summary: Update API key
 *     description: Update API key details (admin/system only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *         description: API key ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 100 }
 *               description: { type: string, maxLength: 255 }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: API key updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: API key not found
 *       403:
 *         description: Insufficient permissions
 */
router.put('/:keyId', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { error, value } = updateApiKeySchema.validate(req.body);
  if (error) {
    throw createApiError('Invalid API key data', 400, 'VALIDATION_ERROR', error.details);
  }

  const apiKeyService = container.getApiKeyService();
  
  // Check if API key exists
  const existingKey = await apiKeyService.getApiKeyById(req.params.keyId);
  if (!existingKey) {
    throw createApiError('API key not found', 404, 'API_KEY_NOT_FOUND');
  }

  // Update the API key
  await apiKeyService.updateApiKey(req.params.keyId, value);

  res.json({
    message: 'API key updated successfully',
    keyId: req.params.keyId,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/api-keys/{keyId}/deactivate:
 *   post:
 *     tags: [API Keys]
 *     summary: Deactivate API key
 *     description: Deactivate an API key (admin/system only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key deactivated successfully
 *       404:
 *         description: API key not found
 *       403:
 *         description: Insufficient permissions
 */
router.post('/:keyId/deactivate', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const apiKeyService = container.getApiKeyService();
  
  // Check if API key exists
  const existingKey = await apiKeyService.getApiKeyById(req.params.keyId);
  if (!existingKey) {
    throw createApiError('API key not found', 404, 'API_KEY_NOT_FOUND');
  }

  const success = await apiKeyService.deactivateApiKey(req.params.keyId);
  
  if (!success) {
    throw createApiError('Failed to deactivate API key', 500, 'DEACTIVATION_FAILED');
  }

  res.json({
    message: 'API key deactivated successfully',
    keyId: req.params.keyId,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/api-keys/{keyId}/activate:
 *   post:
 *     tags: [API Keys]
 *     summary: Activate API key
 *     description: Activate a deactivated API key (admin/system only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key activated successfully
 *       404:
 *         description: API key not found
 *       403:
 *         description: Insufficient permissions
 */
router.post('/:keyId/activate', requireRole(['ADMIN']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const apiKeyService = container.getApiKeyService();
  
  // Check if API key exists
  const existingKey = await apiKeyService.getApiKeyById(req.params.keyId);
  if (!existingKey) {
    throw createApiError('API key not found', 404, 'API_KEY_NOT_FOUND');
  }

  const success = await apiKeyService.activateApiKey(req.params.keyId);
  
  if (!success) {
    throw createApiError('Failed to activate API key', 500, 'ACTIVATION_FAILED');
  }

  res.json({
    message: 'API key activated successfully',
    keyId: req.params.keyId,
    timestamp: new Date().toISOString()
  });
}));

// Helper function to get category descriptions
function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    'processing': 'File processing and batch job configurations',
    'cron': 'Scheduled task and automation settings',
    'api': 'API service configurations',
    'blockchain': 'Blockchain network and gas settings',
    'system': 'Core system and performance settings'
  };
  
  return descriptions[category] || 'Configuration category';
}

export default router; 