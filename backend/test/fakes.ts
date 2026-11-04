import type { Role } from '@trazo/shared';
import type {
  AccessToken,
  AccessTokenPayload,
  AccessTokenService,
  Clock,
  CreateUserInput,
  PasswordHasher,
  RefreshTokenRecord,
  RefreshTokenRepository,
  TokenGenerator,
  UserRepository,
} from '../src/domain/identity/ports.js';
import { User } from '../src/domain/identity/user.js';

export const NOW = new Date('2026-11-02T15:00:00.000Z');

export function makeUser(overrides: Partial<Parameters<typeof User.fromPersistence>[0]> = {}): User {
  return User.fromPersistence({
    id: 'user-1',
    name: 'Asesor Demo',
    email: 'asesor@trazo.co',
    passwordHash: 'hashed:secret-password',
    role: 'ADVISOR',
    active: true,
    lastLoginAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  readonly lastLoginUpdates: Array<{ id: string; at: Date }> = [];

  constructor(users: User[] = []) {
    for (const user of users) this.users.set(user.id, user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const user = User.fromPersistence({
      ...input,
      active: true,
      lastLoginAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.users.set(user.id, user);
    return user;
  }

  async updateLastLogin(id: string, at: Date): Promise<void> {
    this.lastLoginUpdates.push({ id, at });
  }
}

export class FakeHasher implements PasswordHasher {
  lastVerifyHash: string | null = null;

  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    this.lastVerifyHash = hash;
    return hash === `hashed:${plain}`;
  }
}

export class FakeAccessTokenService implements AccessTokenService {
  async sign(payload: AccessTokenPayload): Promise<AccessToken> {
    return { token: `access:${payload.userId}:${payload.role}`, expiresIn: 900 };
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    const [prefix, userId, role] = token.split(':');
    if (prefix !== 'access' || !userId || (role !== 'ADVISOR' && role !== 'ADMIN')) {
      throw new Error('invalid token');
    }
    return { userId, role: role satisfies Role };
  }
}

export class SequentialTokenGenerator implements TokenGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `refresh-${this.counter}`;
  }

  hash(token: string): string {
    return `hash:${token}`;
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly records: RefreshTokenRecord[] = [];

  async create(input: {
    id: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<void> {
    this.records.push({
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      familyId: input.familyId,
      expiresAt: input.expiresAt,
      revokedAt: null,
      replacedById: null,
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.records.find((record) => record.tokenHash === tokenHash) ?? null;
  }

  async rotate(input: {
    currentId: string;
    nextId: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    revokedAt: Date;
  }): Promise<boolean> {
    const current = this.records.find((record) => record.id === input.currentId);
    if (!current || current.revokedAt) return false;

    current.revokedAt = input.revokedAt;
    current.replacedById = input.nextId;
    this.records.push({
      id: input.nextId,
      userId: input.userId,
      tokenHash: input.tokenHash,
      familyId: input.familyId,
      expiresAt: input.expiresAt,
      revokedAt: null,
      replacedById: null,
    });
    return true;
  }

  async revokeById(id: string, at: Date): Promise<void> {
    const record = this.records.find((item) => item.id === id);
    if (record && !record.revokedAt) record.revokedAt = at;
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    for (const record of this.records) {
      if (record.familyId === familyId && !record.revokedAt) record.revokedAt = at;
    }
  }
}

export class FixedClock implements Clock {
  constructor(private readonly date: Date = NOW) {}

  now(): Date {
    return this.date;
  }
}
