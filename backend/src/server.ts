import { createApp } from './app.js';
import { buildContainer } from './config/container.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const container = buildContainer();
const app = createApp(container);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api_started');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutdown_started');

  const forceExit = setTimeout(() => {
    logger.error('shutdown_forced');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      logger.error({ err: error }, 'http_close_failed');
      process.exit(1);
    }
    await container.prisma.$disconnect();
    logger.info('shutdown_complete');
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
