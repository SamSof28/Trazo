import type { Request, Response } from 'express';
import type {
  AuthSessionResponse,
  LoginInput,
  MeResponse,
  RegisterInput,
} from '@trazo/shared';
import type { LoginUseCase } from '../../application/identity/login.use-case.js';
import type { RegisterUseCase } from '../../application/identity/register.use-case.js';
import type { RefreshUseCase } from '../../application/identity/refresh.use-case.js';
import type { LogoutUseCase } from '../../application/identity/logout.use-case.js';
import type { GetMeUseCase } from '../../application/identity/get-me.use-case.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './cookies.js';

export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getMeUseCase: GetMeUseCase,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as RegisterInput;
    const result = await this.registerUseCase.execute(body);

    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

    const response: AuthSessionResponse = {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
    res.status(201).json(response);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as LoginInput;
    const result = await this.loginUseCase.execute(body);

    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

    const response: AuthSessionResponse = {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
    res.status(200).json(response);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const result = await this.refreshUseCase.execute(readRefreshCookie(req));
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

    res.status(200).json({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await this.logoutUseCase.execute(readRefreshCookie(req));
    clearRefreshCookie(res);
    res.status(204).end();
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.getMeUseCase.execute(req.auth!.userId);
    const response: MeResponse = { user };
    res.status(200).json(response);
  };
}
