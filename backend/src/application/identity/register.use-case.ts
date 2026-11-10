import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../domain/shared/app-error.js';
import type {
  AccessTokenService,
  Clock,
  PasswordHasher,
  RefreshTokenRepository,
  TokenGenerator,
  UserRepository,
} from '../../domain/identity/ports.js';
import { User } from '../../domain/identity/user.js';
import type { AuthResult } from './dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Public self-registration. The role is always ADVISOR: elevation to ADMIN
 * remains an explicit action of an existing administrator.
 */
export class RegisterUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly refreshTtlDays: number,
  ) {}

  async execute(input: {
    name: string;
    email: string;
    password: string;
    agency?: string;
  }): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('Ya existe una cuenta con ese email');
    }

    const now = this.clock.now();
    const passwordHash = await this.hasher.hash(input.password);
    const user = User.create({
      id: randomUUID(),
      name: input.name,
      email,
      agency: input.agency,
      passwordHash,
      role: 'ADVISOR',
      now,
    });

    const created = await this.users.create({
      id: user.id,
      name: user.name,
      email: user.email,
      agency: user.agency,
      passwordHash: user.passwordHash,
      role: user.role,
    });

    const refreshToken = this.tokens.generate();
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTtlDays * DAY_MS);

    await this.refreshTokens.create({
      id: randomUUID(),
      userId: created.id,
      tokenHash: this.tokens.hash(refreshToken),
      familyId: randomUUID(),
      expiresAt: refreshExpiresAt,
    });

    const access = await this.accessTokens.sign({
      userId: created.id,
      role: created.role,
    });

    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken,
      refreshExpiresAt,
      user: created.toPublic(),
    };
  }
}
