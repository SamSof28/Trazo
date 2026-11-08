export type Role = 'ADVISOR' | 'ADMIN';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthSessionResponse {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
}

export interface MeResponse {
  user: PublicUser;
}

export interface CreateUserResponse {
  user: PublicUser;
}

export interface ListUsersResponse {
  users: PublicUser[];
}
