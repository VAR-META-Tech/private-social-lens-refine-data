/**
 * Authentication Middleware
 * Handles JWT and API key authentication
 */

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { logger } from '@/services';
import { createApiError } from './error-handler';
import { ApiKeyService } from '@/services';
import { container } from '@/core';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'jwt' | 'api_key';
    name?: string;
    role: 'USER' | 'ADMIN' | 'SYSTEM';
  };
}

/**
 * Authentication middleware
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    // Check for API key authentication
    if (apiKey) {
      const apiKeyService = container.getApiKeyService();
      const keyDetails = await apiKeyService.validateApiKey(apiKey);
      
      if (keyDetails) {
        req.user = {
          id: keyDetails.id,
          type: 'api_key',
          name: keyDetails.name,
          role: 'SYSTEM'
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
        type: 'jwt',
        name: decoded.name,
        role: decoded.role
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
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    // Try to authenticate if credentials are provided
    if (apiKey) {
      const apiKeyService = container.getApiKeyService();
      const keyDetails = await apiKeyService.validateApiKey(apiKey);
      
      if (keyDetails) {
        req.user = {
          id: keyDetails.id,
          type: 'api_key',
          name: keyDetails.name,
          role: 'SYSTEM'
        };
      }
    }
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyJwtToken(token);
        req.user = {
          id: decoded.sub || decoded.userId,
          type: 'jwt',
          name: decoded.name,
          role: decoded.role
        };
      } catch (error) {
        // Ignore invalid tokens for optional auth
        logger.debug('Invalid token in optional auth', {
          operation: 'optional-auth',
          metadata: { error: (error as Error).message }
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
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

/**
 * Role-based authorization middleware
 * Requires specific roles to access the endpoint
 */
export function requireRole(allowedRoles: Array<'USER' | 'ADMIN' | 'SYSTEM'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw createApiError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
      }

      if (!allowedRoles.includes(req.user.role)) {
        const roleString = allowedRoles.length === 1 ? `${allowedRoles[0]} role` : `one of the following roles: ${allowedRoles.join(', ')}`;
        throw createApiError(`Access denied. Required: ${roleString}`, 403, 'INSUFFICIENT_PERMISSIONS');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Admin-only authorization middleware
 * Shorthand for requireRole(['ADMIN', 'SYSTEM'])
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  return requireRole(['ADMIN', 'SYSTEM'])(req, res, next);
}
