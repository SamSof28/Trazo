import type { PublicUser, Role } from '@turiviaje/shared';
import { ValidationError } from '../shared/app-error.js';

export interface UserProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class User {
  private constructor(private readonly props: UserProps) {}

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  static create(input: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
    now: Date;
  }): User {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();

    if (name.length < 2 || name.length > 120) {
      throw new ValidationError('El nombre debe tener entre 2 y 120 caracteres');
    }
    if (!EMAIL.test(email) || email.length > 320) {
      throw new ValidationError('El email no es válido');
    }
    if (input.passwordHash.length === 0) {
      throw new ValidationError('El hash de contraseña es obligatorio');
    }

    return new User({
      id: input.id,
      name,
      email,
      passwordHash: input.passwordHash,
      role: input.role,
      active: true,
      lastLoginAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get role(): Role {
    return this.props.role;
  }

  get active(): boolean {
    return this.props.active;
  }

  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  canAuthenticate(): boolean {
    return this.props.active;
  }

  toPublic(): PublicUser {
    return {
      id: this.props.id,
      name: this.props.name,
      email: this.props.email,
      role: this.props.role,
      isActive: this.props.active,
      createdAt: this.props.createdAt.toISOString(),
      lastLoginAt: this.props.lastLoginAt?.toISOString() ?? null,
    };
  }
}
