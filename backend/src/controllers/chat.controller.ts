import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/ai/chat.service';

export class ChatController {
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { message, context } = req.body as {
        message: string;
        context?: {
          currentFile?: string;
          relatedFiles?: string[];
          selectedCode?: string;
          lineRange?: { start: number; end: number };
        };
      };

      const result = await chatService.sendMessage(sessionId, message, context);

      res.status(200).json({
        success: true,
        data: {
          response: result.response,
          references: result.references,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const history = chatService.getHistory(sessionId);

      res.status(200).json({
        success: true,
        data: {
          history,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const chatController = new ChatController();
