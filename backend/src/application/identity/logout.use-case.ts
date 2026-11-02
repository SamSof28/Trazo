import type { Clock, RefreshTokenRepository, TokenGenerator } from '../../domain/identity/ports.js';

export class LogoutUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;

    const record = await this.refreshTokens.findByHash(this.tokens.hash(rawToken));
    if (!record || record.revokedAt) return;

    await this.refreshTokens.revokeById(record.id, this.clock.now());
  }
}
