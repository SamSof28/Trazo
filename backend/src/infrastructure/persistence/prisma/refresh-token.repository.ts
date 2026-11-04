import type { PrismaClient } from '@prisma/client';
import type { RefreshTokenRecord, RefreshTokenRepository } from '../../../domain/identity/ports.js';

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    id: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        id: input.id,
        userId: input.userId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      familyId: row.familyId,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      replacedById: row.replacedById,
    };
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
    return this.prisma.$transaction(async (tx) => {
      // Revoke the current token first, without the self-reference: the FK to
      // the replacement can only be set after that row exists.
      const updated = await tx.refreshToken.updateMany({
        where: { id: input.currentId, revokedAt: null },
        data: { revokedAt: input.revokedAt },
      });

      if (updated.count === 0) return false;

      await tx.refreshToken.create({
        data: {
          id: input.nextId,
          userId: input.userId,
          tokenHash: input.tokenHash,
          familyId: input.familyId,
          expiresAt: input.expiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: input.currentId },
        data: { replacedById: input.nextId },
      });

      return true;
    });
  }

  async revokeById(id: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}
