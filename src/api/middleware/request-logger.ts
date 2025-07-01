/**
 * Request Logger Middleware
 * Logs incoming HTTP requests
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../services/logging.service.js';

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // Log incoming request
  logger.info('HTTP Request', {
    operation: 'http-request',
    metadata: {
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: req.get('Content-Length'),
      contentType: req.get('Content-Type')
    }
  }, 'ApiServer');

  // Log response when request finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('HTTP Response', {
      operation: 'http-response',
      duration,
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length'),
        duration: `${duration}ms`
      }
    }, 'ApiServer');
  });

  next();
} 
