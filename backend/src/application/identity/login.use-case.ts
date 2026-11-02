import { randomUUID } from 'node:crypto';
import { InvalidCredentialsError } from '../../domain/shared/app-error.js';
import type {
  AccessTokenService,
  Clock,
  PasswordHasher,
  RefreshTokenRepository,
  TokenGenerator,
  UserRepository,
} from '../../domain/identity/ports.js';
import type { AuthResult } from './dto.js';

/**
 * Valid argon2id hash used only to keep response time constant when the email
 * does not exist. Never matches a real password.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$sRL+IBEcEIh2AQ6OVqBcWg$kAEF5JwEDsUazLW8wYyzPXa8V1DBrscw7IgN8QfnYj4';

const DAY_MS = 24 * 60 * 60 * 1000;

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly refreshTtlDays: number,
  ) {}

  async execute(input: { email: string; password: string }): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    const passwordOk = await this.hasher.verify(user?.passwordHash ?? DUMMY_HASH, input.password);

    if (!user || !user.canAuthenticate() || !passwordOk) {
      throw new InvalidCredentialsError();
    }

    const now = this.clock.now();
    const refreshToken = this.tokens.generate();
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTtlDays * DAY_MS);

    await this.refreshTokens.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.tokens.hash(refreshToken),
      familyId: randomUUID(),
      expiresAt: refreshExpiresAt,
    });
    await this.users.updateLastLogin(user.id, now);

    const access = await this.accessTokens.sign({ userId: user.id, role: user.role });

    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken,
      refreshExpiresAt,
      user: user.toPublic(),
    };
  }
}
