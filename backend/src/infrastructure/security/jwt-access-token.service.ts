import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@trazo/shared';
import type { AccessToken, AccessTokenPayload, AccessTokenService } from '../../domain/identity/ports.js';

export class JwtAccessTokenService implements AccessTokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSeconds: number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async sign(payload: AccessTokenPayload): Promise<AccessToken> {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ role: payload.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(payload.userId)
      .setIssuedAt(now)
      .setExpirationTime(now + this.ttlSeconds)
      .sign(this.key);

    return { token, expiresIn: this.ttlSeconds };
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Invalid token subject');
    }

    const role = payload['role'];
    if (role !== 'ADVISOR' && role !== 'ADMIN') {
      throw new Error('Invalid token role');
    }

    return { userId: payload.sub, role: role satisfies Role };
  }
}
