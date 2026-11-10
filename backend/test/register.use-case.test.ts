import { describe, expect, it } from 'vitest';
import { RegisterUseCase } from '../src/application/identity/register.use-case.js';
import { ConflictError } from '../src/domain/shared/app-error.js';
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
  const useCase = new RegisterUseCase(
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

describe('RegisterUseCase', () => {
  it('creates an ADVISOR, stores the agency and starts a session', async () => {
    const { useCase, userRepository, refreshTokens } = build([]);

    const result = await useCase.execute({
      name: '  María Gómez  ',
      email: '  MARIA@AGENCIA.CO ',
      password: 'password-larga-123',
      agency: '  Viajes del Valle  ',
    });

    expect(result.user.name).toBe('María Gómez');
    expect(result.user.email).toBe('maria@agencia.co');
    expect(result.user.agency).toBe('Viajes del Valle');
    expect(result.user.role).toBe('ADVISOR');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.accessToken).toMatch(/^access:.+:ADVISOR$/);
    expect(result.refreshToken).toBe('refresh-1');
    expect(refreshTokens.records).toHaveLength(1);

    const stored = await userRepository.findByEmail('maria@agencia.co');
    expect(stored?.agency).toBe('Viajes del Valle');
    expect(stored?.role).toBe('ADVISOR');
  });

  it('stores a null agency when the optional field is omitted', async () => {
    const { useCase, userRepository } = build([]);

    const result = await useCase.execute({
      name: 'Asesor Solo',
      email: 'solo@agencia.co',
      password: 'password-larga-123',
    });

    expect(result.user.agency).toBeNull();
    expect((await userRepository.findByEmail('solo@agencia.co'))?.agency).toBeNull();
  });

  it('rejects a duplicate email without creating a session', async () => {
    const { useCase, refreshTokens } = build();

    await expect(
      useCase.execute({
        name: 'Otra Persona',
        email: 'ASESOR@TRAZO.CO',
        password: 'password-larga-123',
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(refreshTokens.records).toHaveLength(0);
  });
});
