import express, { Application } from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors.config';
import { rateLimiter } from './middleware/rate-limiter.middleware';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware';
import healthRoutes from './routes/health.routes';
import repositoryRoutes from './routes/repository.routes';
import analysisRoutes from './routes/analysis.routes';
import logger from './utils/logger.util';

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  app.use(rateLimiter);

  // Request logging
  app.use((req, _res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });

  // Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/repository', repositoryRoutes);
  app.use('/api/analysis', analysisRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}
