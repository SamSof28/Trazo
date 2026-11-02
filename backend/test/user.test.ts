import { describe, expect, it } from 'vitest';
import { User } from '../src/domain/identity/user.js';

const base = {
  id: 'user-1',
  name: '  Asesor Demo  ',
  email: '  ASESOR@TURIVIAJE.CO ',
  passwordHash: 'hashed',
  role: 'ADVISOR' as const,
  now: new Date('2026-11-02T15:00:00.000Z'),
};

describe('User', () => {
  it('normalizes name and email', () => {
    const user = User.create(base);
    expect(user.name).toBe('Asesor Demo');
    expect(user.email).toBe('asesor@turiviaje.co');
    expect(user.active).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(() => User.create({ ...base, email: 'no-es-email' })).toThrow(/email/i);
  });

  it('rejects short names', () => {
    expect(() => User.create({ ...base, name: 'A' })).toThrow(/nombre/i);
  });

  it('never exposes the password hash in the public DTO', () => {
    const user = User.create(base);
    expect(user.toPublic()).toEqual({
      id: 'user-1',
      name: 'Asesor Demo',
      email: 'asesor@turiviaje.co',
      role: 'ADVISOR',
      isActive: true,
      createdAt: '2026-11-02T15:00:00.000Z',
      lastLoginAt: null,
    });
  });
});
