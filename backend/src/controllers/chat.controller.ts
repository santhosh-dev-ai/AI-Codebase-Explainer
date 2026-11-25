import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/ai/chat.service';
import logger from '../utils/logger.util';

export class ChatController {
  async streamMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ success: false, error: 'Message is required' });
        return;
      }

      // Initialize SSE streaming headers
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const abortController = new AbortController();

      // Periodic SSE heartbeat comment frames (: ping\n\n) every 15s to keep connections alive through proxies
      const heartbeatTimer = setInterval(() => {
        if (!res.writableEnded && !res.destroyed) {
          res.write(': ping\n\n');
        } else {
          clearInterval(heartbeatTimer);
        }
      }, 15000);

      // Listen for client disconnect on response socket; only !res.writableEnded accurately detects
      // premature client teardown because Node sets res.destroyed = true before emitting 'close'.
      const disconnectHandler = () => {
        if (!res.writableEnded && !abortController.signal.aborted) {
          logger.info('Client disconnected from SSE stream, aborting upstream generation', { sessionId });
          abortController.abort();
          clearInterval(heartbeatTimer);
        }
      };
      res.on('close', disconnectHandler);

      // Handle edge case where client already disconnected before the close listener attached
      if ((res.destroyed || (res as any).closed) && !res.writableEnded && !abortController.signal.aborted) {
        disconnectHandler();
      }

      const sendEvent = (data: object) => {
        if (!res.writableEnded && !res.destroyed) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };

      try {
        const result = await chatService.streamMessage(
          sessionId,
          message,
          context,
          (chunk) => {
            sendEvent({ type: 'chunk', content: chunk });
          },
          { abortSignal: abortController.signal }
        );

        sendEvent({
          type: 'done',
          response: result.response,
          references: result.references,
        });
        if (!res.writableEnded) {
          res.end();
        }
      } catch (streamError: any) {
        if (abortController.signal.aborted) {
          logger.info('Chat stream aborted by client', { sessionId });
        } else {
          logger.error('Streaming chat failed', {
            sessionId,
            error: streamError instanceof Error ? streamError.message : String(streamError),
          });
          sendEvent({
            type: 'error',
            error: streamError instanceof Error ? streamError.message : 'Chat stream error',
          });
        }
        if (!res.writableEnded) {
          res.end();
        }
      } finally {
        clearInterval(heartbeatTimer);
        res.off('close', disconnectHandler);
      }
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    // If client requested text/event-stream or stream query/body flag, delegate to streamMessage
    if (
      req.headers.accept?.includes('text/event-stream') ||
      req.query.stream === 'true' ||
      (req.body && req.body.stream === true)
    ) {
      return this.streamMessage(req, res, next);
    }

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

  async clearHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      chatService.clearHistory(sessionId);

      res.status(200).json({
        success: true,
        data: {
          message: 'Chat history cleared successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const chatController = new ChatController();
