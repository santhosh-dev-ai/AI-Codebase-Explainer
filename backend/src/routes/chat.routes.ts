import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { validateSessionId, validateChatMessage } from '../middleware/validation.middleware';
import { requireSessionAuth } from '../middleware/auth.middleware';
import { aiRateLimiter } from '../middleware/rate-limiter.middleware';
import { aiConcurrencyLimiter } from '../middleware/concurrency-limiter.middleware';

const router = Router();

router.post(
  '/:sessionId/message/stream',
  validateSessionId,
  requireSessionAuth,
  aiConcurrencyLimiter.middleware,
  aiRateLimiter,
  validateChatMessage,
  chatController.streamMessage.bind(chatController)
);

router.post(
  '/:sessionId/message',
  validateSessionId,
  requireSessionAuth,
  aiConcurrencyLimiter.middleware,
  aiRateLimiter,
  validateChatMessage,
  chatController.sendMessage.bind(chatController)
);

router.get(
  '/:sessionId/history',
  validateSessionId,
  requireSessionAuth,
  chatController.getHistory.bind(chatController)
);

router.delete(
  '/:sessionId/history',
  validateSessionId,
  requireSessionAuth,
  chatController.clearHistory.bind(chatController)
);

export default router;
