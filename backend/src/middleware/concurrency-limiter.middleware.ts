import { Request, Response, NextFunction } from 'express';
import config from '../config/env.config';
import logger from '../utils/logger.util';

export class ConcurrencyLimiter {
  private activeCount: number = 0;
  private maxAllowedLimit?: number;
  private resourceName: string;

  constructor(maxAllowedLimit?: number, resourceName: string = 'repository ingestions') {
    this.maxAllowedLimit = maxAllowedLimit;
    this.resourceName = resourceName;
  }

  get middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const maxAllowed = this.maxAllowedLimit ?? config.maxConcurrentIngestions;

      if (this.activeCount >= maxAllowed) {
        logger.warn(`${this.resourceName} concurrency limit exceeded`, {
          activeCount: this.activeCount,
          maxAllowed,
          path: req.path,
        });

        res.setHeader('Retry-After', '5');
        res.status(429).json({
          success: false,
          error: {
            message: `Server is currently processing the maximum number of concurrent ${this.resourceName} (${maxAllowed}). Please retry shortly.`,
            retryAfter: 5,
          },
        });
        return;
      }

      this.activeCount++;
      logger.info(`Acquired ${this.resourceName} concurrency slot`, {
        activeCount: this.activeCount,
        maxAllowed,
        path: req.path,
      });

      let released = false;
      const releaseSlot = () => {
        if (!released) {
          released = true;
          this.activeCount = Math.max(0, this.activeCount - 1);
          logger.info(`Released ${this.resourceName} concurrency slot`, {
            activeCount: this.activeCount,
            maxAllowed,
            path: req.path,
          });
        }
      };

      res.on('finish', releaseSlot);
      res.on('close', releaseSlot);
      if (typeof req.on === 'function') {
        req.on('close', releaseSlot);
      }

      next();
    };
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  reset(): void {
    this.activeCount = 0;
  }
}

export const ingestionConcurrencyLimiter = new ConcurrencyLimiter(undefined, 'repository ingestions');
export const aiConcurrencyLimiter = new ConcurrencyLimiter(config.maxConcurrentAiRequests || 10, 'AI operations');
