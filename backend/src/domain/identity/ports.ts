import type { Role } from '@trazo/shared';
import type { Clock } from '../shared/clock.js';
import type { User } from './user.js';

export type { Clock };

export interface AccessTokenPayload {
  userId: string;
  role: Role;
}

export interface AccessToken {
  token: string;
  expiresIn: number;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export interface CreateUserInput {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  list(): Promise<User[]>;
  create(input: CreateUserInput): Promise<User>;
  updateLastLogin(id: string, at: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface AccessTokenService {
  sign(payload: AccessTokenPayload): Promise<AccessToken>;
  verify(token: string): Promise<AccessTokenPayload>;
}

export interface RefreshTokenRepository {
  create(input: {
    id: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  rotate(input: {
    currentId: string;
    nextId: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    revokedAt: Date;
  }): Promise<boolean>;
  revokeById(id: string, at: Date): Promise<void>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
}

export interface TokenGenerator {
  generate(): string;
  hash(token: string): string;
}
