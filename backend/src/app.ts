import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { httpLogger } from './config/logger.js';
import type { AccessTokenService } from './domain/identity/ports.js';
import type { ActivityController } from './interfaces/http/activity.controller.js';
import type { AuthController } from './interfaces/http/auth.controller.js';
import type { DestinationController } from './interfaces/http/destination.controller.js';
import type { HotelController } from './interfaces/http/hotel.controller.js';
import type { TransportController } from './interfaces/http/transport.controller.js';
import type { UserController } from './interfaces/http/user.controller.js';
import { errorHandler, notFoundHandler } from './interfaces/http/middleware/error-handler.js';
import { globalLimiter } from './interfaces/http/rate-limit.js';
import { createApiRouter } from './interfaces/http/routes.js';

export interface AppDependencies {
  authController: AuthController;
  userController: UserController;
  destinationController: DestinationController;
  hotelController: HotelController;
  activityController: ActivityController;
  transportController: TransportController;
  accessTokens: AccessTokenService;
  healthCheck: () => Promise<boolean>;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(httpLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(globalLimiter);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      const ready = await deps.healthCheck();
      res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api/v1', createApiRouter(deps));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
