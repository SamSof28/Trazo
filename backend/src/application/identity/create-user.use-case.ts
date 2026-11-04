import { randomUUID } from 'node:crypto';
import type { Role } from '@trazo/shared';
import { ConflictError } from '../../domain/shared/app-error.js';
import type { Clock, PasswordHasher, UserRepository } from '../../domain/identity/ports.js';
import { User } from '../../domain/identity/user.js';

export class CreateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('Ya existe un usuario con ese email');
    }

    const passwordHash = await this.hasher.hash(input.password);
    const user = User.create({
      id: randomUUID(),
      name: input.name,
      email,
      passwordHash,
      role: input.role,
      now: this.clock.now(),
    });

    return this.users.create({
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
    });
  }
}
