import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { PrismaRefreshTokenRepository } from '../src/infrastructure/persistence/prisma/refresh-token.repository.js';

interface Row {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

/**
 * Fake mínimo de Prisma que reproduce la FK auto-referenciada
 * `refresh_tokens.replaced_by_id -> refresh_tokens.id`: apuntar a un token que
 * todavía no existe falla, igual que en PostgreSQL.
 */
class FakePrisma {
  readonly tokens = new Map<string, Row>();

  async $transaction<T>(callback: (tx: FakePrisma) => Promise<T>): Promise<T> {
    return callback(this);
  }

  readonly refreshToken = {
    create: async ({ data }: { data: Omit<Row, 'revokedAt' | 'replacedById'> }) => {
      if (this.tokens.has(data.id)) throw new Error('Unique constraint failed on id');
      const row: Row = { ...data, revokedAt: null, replacedById: null };
      this.tokens.set(row.id, row);
      return row;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; revokedAt: null };
      data: { revokedAt: Date; replacedById?: string };
    }) => {
      const row = this.tokens.get(where.id);
      if (!row || row.revokedAt !== null) return { count: 0 };
      if (data.replacedById !== undefined && !this.tokens.has(data.replacedById)) {
        throw new Error('Foreign key constraint violated on refresh_tokens_replaced_by_id_fkey');
      }
      row.revokedAt = data.revokedAt;
      if (data.replacedById !== undefined) row.replacedById = data.replacedById;
      return { count: 1 };
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { replacedById: string };
    }) => {
      const row = this.tokens.get(where.id);
      if (!row) throw new Error('Record to update not found');
      if (!this.tokens.has(data.replacedById)) {
        throw new Error('Foreign key constraint violated on refresh_tokens_replaced_by_id_fkey');
      }
      row.replacedById = data.replacedById;
      return row;
    },
  };
}

function makeRepository(): { prisma: FakePrisma; repository: PrismaRefreshTokenRepository } {
  const prisma = new FakePrisma();
  const repository = new PrismaRefreshTokenRepository(prisma as unknown as PrismaClient);
  return { prisma, repository };
}

const CURRENT_ID = '11111111-1111-4111-8111-111111111111';
const NEXT_ID = '22222222-2222-4222-8222-222222222222';
const FAMILY_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-11-04T12:00:00.000Z');

async function seedCurrent(prisma: FakePrisma): Promise<void> {
  await prisma.refreshToken.create({
    data: {
      id: CURRENT_ID,
      userId: USER_ID,
      tokenHash: 'hash-current',
      familyId: FAMILY_ID,
      expiresAt: new Date('2026-11-11T12:00:00.000Z'),
    },
  });
}

describe('PrismaRefreshTokenRepository.rotate', () => {
  it('creates the replacement before linking it through replaced_by_id', async () => {
    const { prisma, repository } = makeRepository();
    await seedCurrent(prisma);

    const rotated = await repository.rotate({
      currentId: CURRENT_ID,
      nextId: NEXT_ID,
      userId: USER_ID,
      tokenHash: 'hash-next',
      familyId: FAMILY_ID,
      expiresAt: new Date('2026-11-11T12:00:00.000Z'),
      revokedAt: NOW,
    });

    expect(rotated).toBe(true);
    expect(prisma.tokens.get(CURRENT_ID)).toMatchObject({
      revokedAt: NOW,
      replacedById: NEXT_ID,
    });
    expect(prisma.tokens.get(NEXT_ID)).toMatchObject({
      tokenHash: 'hash-next',
      familyId: FAMILY_ID,
      revokedAt: null,
    });
  });

  it('does not create a replacement when the current token was already revoked', async () => {
    const { prisma, repository } = makeRepository();
    await seedCurrent(prisma);
    await prisma.refreshToken.updateMany({
      where: { id: CURRENT_ID, revokedAt: null },
      data: { revokedAt: NOW },
    });

    const rotated = await repository.rotate({
      currentId: CURRENT_ID,
      nextId: NEXT_ID,
      userId: USER_ID,
      tokenHash: 'hash-next',
      familyId: FAMILY_ID,
      expiresAt: new Date('2026-11-11T12:00:00.000Z'),
      revokedAt: NOW,
    });

    expect(rotated).toBe(false);
    expect(prisma.tokens.has(NEXT_ID)).toBe(false);
  });
});
