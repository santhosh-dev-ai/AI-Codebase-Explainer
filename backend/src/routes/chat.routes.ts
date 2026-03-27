import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { validateSessionId, validateChatMessage } from '../middleware/validation.middleware';
import { rateLimiter } from '../middleware/rate-limiter.middleware';

const router = Router();

router.post(
  '/:sessionId/message',
  rateLimiter,
  validateSessionId,
  validateChatMessage,
  chatController.sendMessage.bind(chatController)
);

router.get(
  '/:sessionId/history',
  rateLimiter,
  validateSessionId,
  chatController.getHistory.bind(chatController)
);

export default router;
