import { describe, expect, it } from 'vitest';
import { RefreshUseCase } from '../src/application/identity/refresh.use-case.js';
import { InvalidRefreshTokenError } from '../src/domain/shared/app-error.js';
import {
  FakeAccessTokenService,
  FixedClock,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
  NOW,
  SequentialTokenGenerator,
  makeUser,
} from './fakes.js';

const FUTURE = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);

function build(expiresAt = FUTURE) {
  const users = new InMemoryUserRepository([makeUser()]);
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const tokens = new SequentialTokenGenerator();
  const useCase = new RefreshUseCase(
    users,
    new FakeAccessTokenService(),
    refreshTokens,
    tokens,
    new FixedClock(),
    7,
  );

  return { useCase, refreshTokens, tokens, expiresAt };
}

async function seedToken(
  repo: InMemoryRefreshTokenRepository,
  tokens: SequentialTokenGenerator,
  expiresAt: Date,
) {
  const raw = tokens.generate();
  await repo.create({
    id: 'token-1',
    userId: 'user-1',
    tokenHash: tokens.hash(raw),
    familyId: 'family-1',
    expiresAt,
  });
  return raw;
}

describe('RefreshUseCase', () => {
  it('rotates the refresh token and revokes the previous one', async () => {
    const { useCase, refreshTokens, tokens, expiresAt } = build();
    const raw = await seedToken(refreshTokens, tokens, expiresAt);

    const result = await useCase.execute(raw);

    expect(result.accessToken).toBe('access:user-1:ADVISOR');
    expect(result.refreshToken).not.toBe(raw);
    expect(refreshTokens.records).toHaveLength(2);
    expect(refreshTokens.records[0]?.revokedAt).toEqual(NOW);
    expect(refreshTokens.records[0]?.replacedById).toBe(refreshTokens.records[1]?.id);
    expect(refreshTokens.records[1]?.tokenHash).toBe('hash:refresh-2');
    expect(refreshTokens.records[1]?.revokedAt).toBeNull();
  });

  it('detects reuse and revokes the whole family', async () => {
    const { useCase, refreshTokens, tokens, expiresAt } = build();
    const raw = await seedToken(refreshTokens, tokens, expiresAt);

    await useCase.execute(raw);

    await expect(useCase.execute(raw)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(refreshTokens.records.every((record) => record.revokedAt !== null)).toBe(true);
  });

  it('rejects an expired token and revokes it', async () => {
    const { useCase, refreshTokens, tokens } = build(new Date(NOW.getTime() - 1000));
    const raw = await seedToken(refreshTokens, tokens, new Date(NOW.getTime() - 1000));

    await expect(useCase.execute(raw)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(refreshTokens.records[0]?.revokedAt).toEqual(NOW);
  });

  it('rejects an unknown or missing token', async () => {
    const { useCase } = build();
    await expect(useCase.execute(undefined)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    await expect(useCase.execute('unknown')).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('rejects tokens from inactive users and revokes the family', async () => {
    const users = new InMemoryUserRepository([makeUser({ active: false })]);
    const refreshTokens = new InMemoryRefreshTokenRepository();
    const tokens = new SequentialTokenGenerator();
    const useCase = new RefreshUseCase(
      users,
      new FakeAccessTokenService(),
      refreshTokens,
      tokens,
      new FixedClock(),
      7,
    );
    const raw = await seedToken(refreshTokens, tokens, FUTURE);

    await expect(useCase.execute(raw)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(refreshTokens.records[0]?.revokedAt).toEqual(NOW);
  });
});
