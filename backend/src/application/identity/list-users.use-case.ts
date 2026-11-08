import type { UserRepository } from '../../domain/identity/ports.js';
import type { User } from '../../domain/identity/user.js';

export class ListUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<User[]> {
    return this.users.list();
  }
}
