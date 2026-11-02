import type { Request, Response } from 'express';
import type { CreateUserInput, CreateUserResponse } from '@turiviaje/shared';
import type { CreateUserUseCase } from '../../application/identity/create-user.use-case.js';

export class UserController {
  constructor(private readonly createUserUseCase: CreateUserUseCase) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateUserInput;
    const user = await this.createUserUseCase.execute(body);
    const response: CreateUserResponse = { user: user.toPublic() };
    res.status(201).json(response);
  };
}
