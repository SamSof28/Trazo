import type { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import type { AccessTokenService } from '../domain/identity/ports.js';
import { LoginUseCase } from '../application/identity/login.use-case.js';
import { RefreshUseCase } from '../application/identity/refresh.use-case.js';
import { LogoutUseCase } from '../application/identity/logout.use-case.js';
import { CreateUserUseCase } from '../application/identity/create-user.use-case.js';
import { GetMeUseCase } from '../application/identity/get-me.use-case.js';
import { Argon2PasswordHasher } from '../infrastructure/security/argon2-password-hasher.js';
import { JwtAccessTokenService } from '../infrastructure/security/jwt-access-token.service.js';
import { RandomTokenGenerator } from '../infrastructure/security/random-token.generator.js';
import { SystemClock } from '../infrastructure/system-clock.js';
import { createPrismaClient } from '../infrastructure/persistence/prisma/client.js';
import { PrismaUserRepository } from '../infrastructure/persistence/prisma/user.repository.js';
import { PrismaRefreshTokenRepository } from '../infrastructure/persistence/prisma/refresh-token.repository.js';
import { AuthController } from '../interfaces/http/auth.controller.js';
import { UserController } from '../interfaces/http/user.controller.js';
import type { AppDependencies } from '../app.js';

export interface Container extends AppDependencies {
  prisma: PrismaClient;
}

export function buildContainer(): Container {
  const prisma = createPrismaClient();
  const users = new PrismaUserRepository(prisma);
  const refreshTokens = new PrismaRefreshTokenRepository(prisma);
  const hasher = new Argon2PasswordHasher();
  const tokens = new RandomTokenGenerator();
  const clock = new SystemClock();
  const accessTokens: AccessTokenService = new JwtAccessTokenService(
    env.JWT_ACCESS_SECRET,
    env.ACCESS_TOKEN_TTL_SECONDS,
  );

  const loginUseCase = new LoginUseCase(
    users,
    hasher,
    accessTokens,
    refreshTokens,
    tokens,
    clock,
    env.REFRESH_TOKEN_TTL_DAYS,
  );
  const refreshUseCase = new RefreshUseCase(
    users,
    accessTokens,
    refreshTokens,
    tokens,
    clock,
    env.REFRESH_TOKEN_TTL_DAYS,
  );
  const logoutUseCase = new LogoutUseCase(refreshTokens, tokens, clock);
  const createUserUseCase = new CreateUserUseCase(users, hasher, clock);
  const getMeUseCase = new GetMeUseCase(users);

  return {
    prisma,
    accessTokens,
    authController: new AuthController(
      loginUseCase,
      refreshUseCase,
      logoutUseCase,
      getMeUseCase,
    ),
    userController: new UserController(createUserUseCase),
    healthCheck: async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    },
  };
}
