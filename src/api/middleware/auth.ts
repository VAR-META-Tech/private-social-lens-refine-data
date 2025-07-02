/**
 * Authentication Middleware
 * Handles JWT and API key authentication
 */

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { logger } from '@/services';
import { createApiError } from './error-handler';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    permissions?: string[];
  };
}

/**
 * Authentication middleware
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    // Check for API key authentication
    if (apiKey) {
      const keyValidation = validateApiKey(apiKey);
      if (keyValidation.isValid) {
        req.user = {
          id: 'api-user',
          role: keyValidation.role,
          permissions: keyValidation.permissions
        };
        next();
        return;
      } else {
        throw createApiError('Invalid API key', 401, 'INVALID_API_KEY');
      }
    }

    // Check for JWT authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyJwtToken(token);

      req.user = {
        id: decoded.sub || decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user',
        permissions: decoded.permissions || ['read']
      };

      next();
      return;
    }

    // No valid authentication found
    throw createApiError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createApiError('Invalid token', 401, 'INVALID_TOKEN'));
    } else {
      next(error);
    }
  }
}

/**
 * Optional authentication middleware (allows unauthenticated requests)
 */
export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    // Try to authenticate if credentials are provided
    if (apiKey) {
      const keyValidation = validateApiKey(apiKey);
      if (keyValidation.isValid) {
        req.user = {
          id: 'api-user',
          role: keyValidation.role,
          permissions: keyValidation.permissions
        };
      }
    }
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyJwtToken(token);
        req.user = {
          id: decoded.sub || decoded.userId,
          email: decoded.email,
          role: decoded.role || 'user',
          permissions: decoded.permissions || ['read']
        };
      } catch (error) {
        // Ignore invalid tokens for optional auth
        logger.debug('Invalid token in optional auth', {
          operation: 'optional-auth',
          metadata: { error: (error as Error).message }
        }, 'ApiServer');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createApiError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      return next(createApiError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
}

/**
 * Permission-based authorization middleware
 */
export function requirePermission(requiredPermission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createApiError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    }

    if (!req.user.permissions || !req.user.permissions.includes(requiredPermission)) {
      return next(createApiError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
}

/**
 * Validate API key and return role/permissions info
 */
function validateApiKey(apiKey: string): {
  isValid: boolean;
  role?: string;
  permissions?: string[];
} {
  // Check for admin API key
  if (apiKey === process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY) {
    return {
      isValid: true,
      role: 'admin',
      permissions: ['read', 'write', 'delete']
    };
  }

  // Check for regular API key
  if (apiKey === process.env.API_KEY && process.env.API_KEY) {
    return {
      isValid: true,
      role: 'user',
      permissions: ['read', 'write']
    };
  }

  // Invalid API key
  return {
    isValid: false
  };
}

/**
 * Verify JWT token
 */
function verifyJwtToken(token: string): any {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.verify(token, secret);
}

/**
 * Generate JWT token
 */
export function generateJwtToken(payload: any, expiresIn: string = '24h'): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}
