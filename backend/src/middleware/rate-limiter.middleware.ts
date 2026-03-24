import rateLimit from 'express-rate-limit';
import config from '../config/env.config';
import logger from '../utils/logger.util';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });

    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests, please try again later.'
      }
    });
  }
});

// Stricter rate limiter for expensive operations
export const strictRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: Math.floor(config.rateLimitMaxRequests / 5), // 20% of normal rate
  message: {
    success: false,
    error: {
      message: 'Too many analysis requests, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});
