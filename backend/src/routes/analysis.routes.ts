import { Router } from 'express';
import { analysisController } from '../controllers/analysis.controller';
import { validateSessionId, validateFilePath } from '../middleware/validation.middleware';
import { rateLimiter } from '../middleware/rate-limiter.middleware';

const router = Router();

router.get(
  '/:sessionId/overview',
  rateLimiter,
  validateSessionId,
  analysisController.getOverview.bind(analysisController)
);

// File explanation endpoint supporting POST (frontend default) and GET (convenience)
router.post(
  '/:sessionId/file-explanation',
  rateLimiter,
  validateSessionId,
  validateFilePath,
  analysisController.explainFile.bind(analysisController)
);

router.get(
  '/:sessionId/file-explanation',
  rateLimiter,
  validateSessionId,
  validateFilePath,
  analysisController.explainFile.bind(analysisController)
);

// Bug detection endpoint supporting both POST and GET
router.post(
  '/:sessionId/bug-detection',
  rateLimiter,
  validateSessionId,
  analysisController.detectBugs.bind(analysisController)
);

router.get(
  '/:sessionId/bug-detection',
  rateLimiter,
  validateSessionId,
  analysisController.detectBugs.bind(analysisController)
);

// Flow diagram endpoint supporting both GET and POST
router.get(
  '/:sessionId/flow-diagram',
  rateLimiter,
  validateSessionId,
  analysisController.getFlowDiagram.bind(analysisController)
);

router.post(
  '/:sessionId/flow-diagram',
  rateLimiter,
  validateSessionId,
  analysisController.getFlowDiagram.bind(analysisController)
);

// Interactive Dependency Graph endpoint
router.get(
  '/:sessionId/dependencies',
  rateLimiter,
  validateSessionId,
  analysisController.getDependencyGraph.bind(analysisController)
);

export default router;
