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

// AI-specific rate limiter (chat, stream, and file explanation)
export const aiRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: 30, // 30 AI requests per window per session/IP (protects Groq TPM quota)
  keyGenerator: (req) => {
    const sessionId = req.params?.sessionId;
    const token = req.headers['x-session-token']?.toString();
    return sessionId || token || req.ip || 'global';
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('AI rate limit exceeded', {
      sessionId: req.params?.sessionId,
      ip: req.ip,
      path: req.path,
    });

    res.setHeader('Retry-After', '30');
    res.status(429).json({
      success: false,
      error: {
        message: 'AI request limit reached. Please wait briefly before sending more queries.',
        retryAfter: 30,
      },
    });
  },
});
