import { Router } from 'express';
import { analysisController } from '../controllers/analysis.controller';
import { validateSessionId } from '../middleware/validation.middleware';
import { rateLimiter } from '../middleware/rate-limiter.middleware';

const router = Router();

router.get(
  '/:sessionId/overview',
  rateLimiter,
  validateSessionId,
  analysisController.getOverview.bind(analysisController)
);

export default router;
