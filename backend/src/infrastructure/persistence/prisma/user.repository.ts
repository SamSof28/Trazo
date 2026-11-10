import { Prisma } from '@prisma/client';
import type { Role } from '@trazo/shared';
import type { CreateUserInput, UserRepository } from '../../../domain/identity/ports.js';
import { User } from '../../../domain/identity/user.js';
import { ConflictError } from '../../../domain/shared/app-error.js';
import type { PrismaClient } from '@prisma/client';

type UserRow = {
  id: string;
  name: string;
  email: string;
  agency: string | null;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: UserRow): User {
  return User.fromPersistence({
    id: row.id,
    name: row.name,
    email: row.email,
    agency: row.agency,
    passwordHash: row.passwordHash,
    role: row.role,
    active: row.isActive,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<User[]> {
    const rows = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toDomain);
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      const row = await this.prisma.user.create({
        data: {
          id: input.id,
          name: input.name,
          email: input.email,
          agency: input.agency ?? null,
          passwordHash: input.passwordHash,
          role: input.role,
        },
      });
      return toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Ya existe un usuario con ese email');
      }
      throw error;
    }
  }

  async updateLastLogin(id: string, at: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: at },
    });
  }
}
