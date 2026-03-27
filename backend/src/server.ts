import { createApp } from './app';
import config, { validateConfig } from './config/env.config';
import logger from './utils/logger.util';
import { sessionService } from './services/storage/session.service';
import type { Server } from 'http';

// Validate environment configuration
try {
  validateConfig();
} catch (error) {
  logger.error('Configuration validation failed', { error });
  process.exit(1);
}

const app = createApp();
let server: Server;
const maxPortRetries = 10;

const startServer = (port: number, retryCount = 0): void => {
  const instance = app.listen(port, () => {
    logger.info(`Server started`, {
      port,
      env: config.nodeEnv,
      corsOrigin: config.corsOrigin,
    });
    logger.info(`API available at http://localhost:${port}/api/health`);
  });

  instance.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && retryCount < maxPortRetries) {
      const nextPort = port + 1;
      logger.warn(`Port ${port} is in use, retrying on ${nextPort}`);
      startServer(nextPort, retryCount + 1);
      return;
    }

    logger.error('Failed to start server', { error, port });
    process.exit(1);
  });

  server = instance;
};

startServer(config.port);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (!server) {
    sessionService.shutdown();
    process.exit(0);
  }
  server.close(() => {
    logger.info('HTTP server closed');
    sessionService.shutdown();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (!server) {
    sessionService.shutdown();
    process.exit(0);
  }
  server.close(() => {
    logger.info('HTTP server closed');
    sessionService.shutdown();
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});
