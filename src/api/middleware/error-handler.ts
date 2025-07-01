/**
 * Error Handler Middleware
 * Centralized error handling for API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../services/logging.service.js';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Express error handler middleware
 */
export function errorHandler(
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.error('API Error', error, {
    operation: 'api-request',
    metadata: {
      path: req.path,
      method: req.method,
      statusCode: error.statusCode || 500,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }
  }, 'ApiServer');

  // Determine status code
  const statusCode = error.statusCode || 500;

  // Prepare error response
  const errorResponse: any = {
    error: true,
    message: error.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Add additional details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = error.details;
  }

  // Add error code if available
  if (error.code) {
    errorResponse.code = error.code;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Create API error with status code
 */
export function createApiError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
} 