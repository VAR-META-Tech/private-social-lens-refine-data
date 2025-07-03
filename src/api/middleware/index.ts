/**
 * API Middleware Re-exports
 * Provides clean access to all middleware functions and types
 */

// Authentication middleware exports
export {
  authMiddleware,
  optionalAuthMiddleware,
  generateJwtToken,
  requireRole,
  requireAdmin
} from './auth'

// Authentication types
export type { AuthenticatedRequest } from './auth'

// Error handling middleware exports
export {
  errorHandler,
  createApiError,
  asyncHandler
} from './error-handler'

// Error handling types
export type { ApiError } from './error-handler'

// Request logging middleware exports
export { requestLogger } from './request-logger' 