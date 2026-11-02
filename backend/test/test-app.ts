import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { LoginUseCase } from '../src/application/identity/login.use-case.js';
import { RefreshUseCase } from '../src/application/identity/refresh.use-case.js';
import { LogoutUseCase } from '../src/application/identity/logout.use-case.js';
import { CreateUserUseCase } from '../src/application/identity/create-user.use-case.js';
import { GetMeUseCase } from '../src/application/identity/get-me.use-case.js';
import { AuthController } from '../src/interfaces/http/auth.controller.js';
import { UserController } from '../src/interfaces/http/user.controller.js';
import { JwtAccessTokenService } from '../src/infrastructure/security/jwt-access-token.service.js';
import {
  FakeHasher,
  FixedClock,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
  SequentialTokenGenerator,
  makeUser,
} from './fakes.js';

const SECRET = 'test-secret-that-is-at-least-32-chars-long';

export function buildTestApp(): { app: Express; accessTokens: JwtAccessTokenService } {
  const users = new InMemoryUserRepository([
    makeUser(),
    makeUser({
      id: 'admin-1',
      name: 'Admin Demo',
      email: 'admin@turiviaje.co',
      role: 'ADMIN',
    }),
  ]);
  const hasher = new FakeHasher();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const tokens = new SequentialTokenGenerator();
  const clock = new FixedClock();
  const accessTokens = new JwtAccessTokenService(SECRET, 900);

  const authController = new AuthController(
    new LoginUseCase(users, hasher, accessTokens, refreshTokens, tokens, clock, 7),
    new RefreshUseCase(users, accessTokens, refreshTokens, tokens, clock, 7),
    new LogoutUseCase(refreshTokens, tokens, clock),
    new GetMeUseCase(users),
  );
  const userController = new UserController(new CreateUserUseCase(users, hasher, clock));

  const app = createApp({
    authController,
    userController,
    accessTokens,
    healthCheck: async () => true,
  });

  return { app, accessTokens };
}

export async function loginAs(
  app: Express,
  email: string,
  password = 'secret-password',
): Promise<{ accessToken: string; cookie: string }> {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  const cookies = response.headers['set-cookie'];
  const cookie = Array.isArray(cookies) ? cookies[0] : cookies;
  return {
    accessToken: response.body.accessToken as string,
    cookie: cookie ?? '',
  };
}
