import { Router } from 'express';
import { analysisController } from '../controllers/analysis.controller';
import { validateSessionId, validateFilePath } from '../middleware/validation.middleware';
import { requireSessionAuth } from '../middleware/auth.middleware';
import { aiRateLimiter } from '../middleware/rate-limiter.middleware';
import { aiConcurrencyLimiter } from '../middleware/concurrency-limiter.middleware';

const router = Router();

// Lightweight cache metrics observability endpoint
router.get(
  '/cache-metrics',
  analysisController.getCacheMetrics.bind(analysisController)
);

router.get(
  '/:sessionId/overview',
  validateSessionId,
  requireSessionAuth,
  analysisController.getOverview.bind(analysisController)
);

// File explanation endpoint supporting POST (frontend default) and GET (convenience)
router.post(
  '/:sessionId/file-explanation',
  validateSessionId,
  requireSessionAuth,
  aiConcurrencyLimiter.middleware,
  aiRateLimiter,
  validateFilePath,
  analysisController.explainFile.bind(analysisController)
);

router.get(
  '/:sessionId/file-explanation',
  validateSessionId,
  requireSessionAuth,
  aiConcurrencyLimiter.middleware,
  aiRateLimiter,
  validateFilePath,
  analysisController.explainFile.bind(analysisController)
);

// Bug detection endpoint supporting both POST and GET
router.post(
  '/:sessionId/bug-detection',
  validateSessionId,
  requireSessionAuth,
  analysisController.detectBugs.bind(analysisController)
);

router.get(
  '/:sessionId/bug-detection',
  validateSessionId,
  requireSessionAuth,
  analysisController.detectBugs.bind(analysisController)
);

// Flow diagram endpoint supporting both GET and POST
router.get(
  '/:sessionId/flow-diagram',
  validateSessionId,
  requireSessionAuth,
  analysisController.getFlowDiagram.bind(analysisController)
);

router.post(
  '/:sessionId/flow-diagram',
  validateSessionId,
  requireSessionAuth,
  analysisController.getFlowDiagram.bind(analysisController)
);

// Interactive Dependency Graph endpoint
router.get(
  '/:sessionId/dependencies',
  validateSessionId,
  requireSessionAuth,
  analysisController.getDependencyGraph.bind(analysisController)
);

// Accurate Code Metrics Intelligence endpoint
router.get(
  '/:sessionId/code-metrics',
  validateSessionId,
  requireSessionAuth,
  analysisController.getCodeMetrics.bind(analysisController)
);

export default router;
