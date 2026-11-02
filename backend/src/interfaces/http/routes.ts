import { Router } from 'express';
import { createUserSchema, loginSchema } from '@turiviaje/shared';
import type { AccessTokenService } from '../../domain/identity/ports.js';
import type { AuthController } from './auth.controller.js';
import type { UserController } from './user.controller.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import { validateBody } from './middleware/validate.js';
import { loginLimiter, refreshLimiter } from './rate-limit.js';

export interface ApiRouterDependencies {
  authController: AuthController;
  userController: UserController;
  accessTokens: AccessTokenService;
}

export function createApiRouter(deps: ApiRouterDependencies): Router {
  const router = Router();
  const auth = requireAuth(deps.accessTokens);

  router.post('/auth/login', loginLimiter, validateBody(loginSchema), deps.authController.login);
  router.post('/auth/refresh', refreshLimiter, deps.authController.refresh);
  router.post('/auth/logout', deps.authController.logout);
  router.get('/auth/me', auth, deps.authController.me);

  router.post(
    '/users',
    auth,
    requireRole('ADMIN'),
    validateBody(createUserSchema),
    deps.userController.create,
  );

  return router;
}
