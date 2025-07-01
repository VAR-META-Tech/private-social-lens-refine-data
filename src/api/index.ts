/**
 * API Module Re-exports
 * Provides clean access to API server, routes, and middleware
 */

// Server exports
export { ApiServer } from './server'

// Route exports (re-exported from routes module)
export {
  jobRoutes,
  configRoutes,
  statsRoutes,
  healthRoutes
} from './routes'

// Middleware exports (re-exported from middleware module)
export {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requirePermission,
  generateJwtToken,
  errorHandler,
  createApiError,
  asyncHandler,
  requestLogger
} from './middleware'

// Type exports
export type { AuthenticatedRequest, ApiError } from './middleware' 