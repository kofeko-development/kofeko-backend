import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { logger } from './common/logger/logger';
import { disconnectRedis } from './config/redis';

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Backend running');
});

const shutdown = async (): Promise<void> => {
  logger.info('Shutting down');
  await disconnectRedis();
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
