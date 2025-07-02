/**
 * User Management Routes
 * Provides endpoints for managing users and authentication
 */

import { Router, Response } from 'express'
import Joi from 'joi'
import { container } from '@/core'
import { asyncHandler, createApiError } from '../middleware/error-handler'
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth'

const router = Router()

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
})

const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().optional(),
  role: Joi.string().valid('USER', 'ADMIN', 'SYSTEM').default('USER')
})

const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).optional(),
  name: Joi.string().optional(),
  role: Joi.string().valid('USER', 'ADMIN', 'SYSTEM').optional(),
  isActive: Joi.boolean().optional()
})

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     tags: [Users]
 *     summary: User login
 *     description: Authenticate user and return JWT token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { error, value } = loginSchema.validate(req.body)
  if (error) {
    throw createApiError('Invalid login data', 400, 'VALIDATION_ERROR', error.details)
  }

  const userService = container.getUserService()
  const result = await userService.authenticateUser(value.email, value.password)

  res.json({
    message: 'Login successful',
    ...result,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Create user
 *     description: Create a new user (admin only)
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
 *               - email
 *               - password
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *               role: { type: string, enum: [USER, ADMIN, SYSTEM], default: USER }
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid user data
 *       409:
 *         description: User already exists
 */
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Check if user has admin role
  if (req.user?.type !== 'api_key') {
    throw createApiError('Admin role required', 403, 'INSUFFICIENT_PERMISSIONS')
  }

  const { error, value } = createUserSchema.validate(req.body)
  if (error) {
    throw createApiError('Invalid user data', 400, 'VALIDATION_ERROR', error.details)
  }

  const userService = container.getUserService()
  const user = await userService.createUser(value)

  res.status(201).json({
    message: 'User created successfully',
    user,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List users
 *     description: Get paginated list of users (admin only)
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Check if user has admin role
  if (req.user?.type !== 'api_key') {
    throw createApiError('Admin role required', 403, 'INSUFFICIENT_PERMISSIONS')
  }

  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 10

  const userService = container.getUserService()
  const result = await userService.listUsers(page, limit)

  res.json({
    ...result,
    page,
    limit,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     tags: [Users]
 *     summary: Get user
 *     description: Get user by ID (admin or self)
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/:userId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Check if user has access (admin or self)
  if (req.user?.type !== 'api_key' && req.user?.id !== req.params.userId) {
    throw createApiError('Access denied', 403, 'INSUFFICIENT_PERMISSIONS')
  }

  const userService = container.getUserService()
  const user = await userService.getUserById(req.params.userId)

  if (!user) {
    throw createApiError('User not found', 404, 'USER_NOT_FOUND')
  }

  res.json({
    user,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @swagger
 * /api/users/{userId}:
 *   put:
 *     tags: [Users]
 *     summary: Update user
 *     description: Update user details (admin or self)
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *               role: { type: string, enum: [USER, ADMIN, SYSTEM] }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put('/:userId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const isAdmin = req.user?.type === 'api_key'
  const isSelf = req.user?.id === req.params.userId

  // Check if user has access (admin or self)
  if (!isAdmin && !isSelf) {
    throw createApiError('Access denied', 403, 'INSUFFICIENT_PERMISSIONS')
  }

  const { error, value } = updateUserSchema.validate(req.body)
  if (error) {
    throw createApiError('Invalid user data', 400, 'VALIDATION_ERROR', error.details)
  }

  // Non-admin users can only update their own name and password
  if (!isAdmin) {
    const { name, password } = value
    const updateData: { name?: string; password?: string } = {}
    if (name !== undefined) updateData.name = name
    if (password !== undefined) updateData.password = password

    const userService = container.getUserService()
    const user = await userService.updateUser(req.params.userId, updateData)

    return res.json({
      message: 'User updated successfully',
      user,
      timestamp: new Date().toISOString()
    })
  }

  // Admin can update all fields
  const userService = container.getUserService()
  const user = await userService.updateUser(req.params.userId, value)

  res.json({
    message: 'User updated successfully',
    user,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete user
 *     description: Soft delete user (admin only)
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete('/:userId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Check if user has admin role
  if (req.user?.type !== 'api_key') {
    throw createApiError('Admin role required', 403, 'INSUFFICIENT_PERMISSIONS')
  }

  const userService = container.getUserService()
  await userService.deleteUser(req.params.userId)

  res.json({
    message: 'User deleted successfully',
    timestamp: new Date().toISOString()
  })
}))

export default router 