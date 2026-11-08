import type { CreateUserInput, CreateUserResponse, ListUsersResponse, PublicUser } from '@trazo/shared';
import { apiJson } from './client';

export async function listUsers(): Promise<PublicUser[]> {
  const data = await apiJson<ListUsersResponse>('/api/v1/users');
  return data.users;
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const data = await apiJson<CreateUserResponse>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.user;
}
