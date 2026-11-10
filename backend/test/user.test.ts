import { describe, expect, it } from 'vitest';
import { User } from '../src/domain/identity/user.js';

const base = {
  id: 'user-1',
  name: '  Asesor Demo  ',
  email: '  ASESOR@TRAZO.CO ',
  passwordHash: 'hashed',
  role: 'ADVISOR' as const,
  now: new Date('2026-11-02T15:00:00.000Z'),
};

describe('User', () => {
  it('normalizes name, email and agency', () => {
    const user = User.create({ ...base, agency: '  Viajes del Valle  ' });
    expect(user.name).toBe('Asesor Demo');
    expect(user.email).toBe('asesor@trazo.co');
    expect(user.agency).toBe('Viajes del Valle');
    expect(user.active).toBe(true);
  });

  it('stores an empty agency as null', () => {
    const user = User.create({ ...base, agency: '   ' });
    expect(user.agency).toBeNull();
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
      email: 'asesor@trazo.co',
      agency: null,
      role: 'ADVISOR',
      isActive: true,
      createdAt: '2026-11-02T15:00:00.000Z',
      lastLoginAt: null,
    });
  });
});
