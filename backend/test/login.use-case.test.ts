import { describe, expect, it } from 'vitest';
import { LoginUseCase } from '../src/application/identity/login.use-case.js';
import { InvalidCredentialsError } from '../src/domain/shared/app-error.js';
import {
  FakeAccessTokenService,
  FakeHasher,
  FixedClock,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
  makeUser,
  SequentialTokenGenerator,
} from './fakes.js';

function build(users = [makeUser()]) {
  const userRepository = new InMemoryUserRepository(users);
  const hasher = new FakeHasher();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const useCase = new LoginUseCase(
    userRepository,
    hasher,
    new FakeAccessTokenService(),
    refreshTokens,
    new SequentialTokenGenerator(),
    new FixedClock(),
    7,
  );
  return { useCase, userRepository, hasher, refreshTokens };
}

describe('LoginUseCase', () => {
  it('returns an access token, a refresh token and the public user', async () => {
    const { useCase, refreshTokens, userRepository } = build();

    const result = await useCase.execute({
      email: 'ASESOR@TRAZO.CO',
      password: 'secret-password',
    });

    expect(result.accessToken).toBe('access:user-1:ADVISOR');
    expect(result.expiresIn).toBe(900);
    expect(result.refreshToken).toBe('refresh-1');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(refreshTokens.records).toHaveLength(1);
    expect(refreshTokens.records[0]?.tokenHash).toBe('hash:refresh-1');
    expect(userRepository.lastLoginUpdates).toHaveLength(1);
  });

  it('rejects an unknown email with the same error as a wrong password', async () => {
    const { useCase, hasher } = build();

    await expect(
      useCase.execute({ email: 'nadie@trazo.co', password: 'secret-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    // Timing defense: a dummy hash is verified even when the user does not exist.
    expect(hasher.lastVerifyHash).toContain('$argon2id$');
  });

  it('rejects a wrong password', async () => {
    const { useCase } = build();
    await expect(
      useCase.execute({ email: 'asesor@trazo.co', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejects inactive users without revealing the reason', async () => {
    const { useCase } = build([makeUser({ active: false })]);
    await expect(
      useCase.execute({ email: 'asesor@trazo.co', password: 'secret-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('does not create a refresh token on failed login', async () => {
    const { useCase, refreshTokens } = build();
    await expect(
      useCase.execute({ email: 'asesor@trazo.co', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(refreshTokens.records).toHaveLength(0);
  });
});
