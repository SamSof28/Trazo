import type { Request, Response } from 'express';
import type { CreateUserInput, CreateUserResponse, ListUsersResponse } from '@trazo/shared';
import type { CreateUserUseCase } from '../../application/identity/create-user.use-case.js';
import type { ListUsersUseCase } from '../../application/identity/list-users.use-case.js';

export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
  ) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const users = await this.listUsersUseCase.execute();
    const response: ListUsersResponse = { users: users.map((user) => user.toPublic()) };
    res.json(response);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateUserInput;
    const user = await this.createUserUseCase.execute(body);
    const response: CreateUserResponse = { user: user.toPublic() };
    res.status(201).json(response);
  };
}
