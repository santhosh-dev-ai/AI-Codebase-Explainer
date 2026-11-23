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

  async explainFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const filePath = (req.body?.filePath || req.query?.filePath) as string;

      if (!filePath) {
        throw createError('File path is required', 400);
      }

      const fileExplanation = await analysisService.explainFile(sessionId, filePath);
      if (!fileExplanation) {
        throw createError('Failed to generate file explanation', 500);
      }

      res.status(200).json({
        success: true,
        data: {
          fileExplanation,
          explanation: fileExplanation,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async detectBugs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const filePath = (req.body?.filePath || req.query?.filePath || req.query?.path) as string | undefined;

      const bugs = await analysisService.detectBugs(sessionId, filePath);

      res.status(200).json({
        success: true,
        data: {
          bugs,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getFlowDiagram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;

      const flowDiagram = await analysisService.getFlowDiagram(sessionId);

      res.status(200).json({
        success: true,
        data: {
          flowDiagram,
          mermaid: flowDiagram.mermaid,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const analysisController = new AnalysisController();
