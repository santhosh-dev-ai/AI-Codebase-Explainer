import { Request, Response, NextFunction } from 'express';
import { analysisService } from '../services/analysis/analysis.service';
import { createError } from '../middleware/error-handler.middleware';

export class AnalysisController {
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;

      const overview = await analysisService.generateOverview(sessionId);
      if (!overview) {
        throw createError('Failed to generate overview', 500);
      }

      res.status(200).json({
        success: true,
        data: {
          overview,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const analysisController = new AnalysisController();
