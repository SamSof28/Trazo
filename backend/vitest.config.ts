import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
    env: {
      NODE_ENV: 'test',
      PORT: '3001',
      CORS_ORIGINS: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/turiviaje_test',
      DIRECT_URL: 'postgresql://test:test@localhost:5432/turiviaje_test',
      JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-32-chars-long',
      ACCESS_TOKEN_TTL_SECONDS: '900',
      REFRESH_TOKEN_TTL_DAYS: '7',
      AI_PROVIDER: 'mock',
      GEMINI_MODEL: 'gemini-2.5-flash',
      AI_TIMEOUT_MS: '45000',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_ENABLED: 'false',
    },
  },
});
