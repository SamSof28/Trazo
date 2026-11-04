import type { PublicUser } from '@trazo/shared';
import { UnauthenticatedError } from '../../domain/shared/app-error.js';
import type { UserRepository } from '../../domain/identity/ports.js';

export class GetMeUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user || !user.canAuthenticate()) {
      throw new UnauthenticatedError('La sesión ya no es válida');
    }
    return user.toPublic();
  }
}
