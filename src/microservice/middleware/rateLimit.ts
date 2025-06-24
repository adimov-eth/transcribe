import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export const createRateLimiter = (windowMs: number = 15 * 60 * 1000, max: number = 100) => {
  return rateLimit({
    windowMs, // Time window
    max, // Max requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
};

// Different rate limiters for different endpoints
export const transcriptionRateLimiter = createRateLimiter(15 * 60 * 1000, 10); // 10 requests per 15 minutes
export const statusRateLimiter = createRateLimiter(1 * 60 * 1000, 60); // 60 requests per minute