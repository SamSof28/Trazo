import { PrismaClient } from '@prisma/client';
import { env } from '../../../config/env.js';

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}
