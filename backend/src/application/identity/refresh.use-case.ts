import { randomUUID } from 'node:crypto';
import { InvalidRefreshTokenError } from '../../domain/shared/app-error.js';
import type {
  AccessTokenService,
  Clock,
  RefreshTokenRepository,
  TokenGenerator,
  UserRepository,
} from '../../domain/identity/ports.js';
import type { RefreshResult } from './dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export class RefreshUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly refreshTtlDays: number,
  ) {}

  async execute(rawToken: string | undefined): Promise<RefreshResult> {
    if (!rawToken) throw new InvalidRefreshTokenError();

    const now = this.clock.now();
    const current = await this.refreshTokens.findByHash(this.tokens.hash(rawToken));

    if (!current) throw new InvalidRefreshTokenError();

    if (current.revokedAt) {
      // Token reuse: assume theft and revoke the whole family.
      await this.refreshTokens.revokeFamily(current.familyId, now);
      throw new InvalidRefreshTokenError();
    }

    if (current.expiresAt.getTime() <= now.getTime()) {
      await this.refreshTokens.revokeById(current.id, now);
      throw new InvalidRefreshTokenError();
    }

    const user = await this.users.findById(current.userId);
    if (!user || !user.canAuthenticate()) {
      await this.refreshTokens.revokeFamily(current.familyId, now);
      throw new InvalidRefreshTokenError();
    }

    const refreshToken = this.tokens.generate();
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTtlDays * DAY_MS);

    const rotated = await this.refreshTokens.rotate({
      currentId: current.id,
      nextId: randomUUID(),
      userId: current.userId,
      tokenHash: this.tokens.hash(refreshToken),
      familyId: current.familyId,
      expiresAt: refreshExpiresAt,
      revokedAt: now,
    });

    if (!rotated) {
      await this.refreshTokens.revokeFamily(current.familyId, now);
      throw new InvalidRefreshTokenError();
    }

    const access = await this.accessTokens.sign({ userId: user.id, role: user.role });

    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken,
      refreshExpiresAt,
    };
  }
}
