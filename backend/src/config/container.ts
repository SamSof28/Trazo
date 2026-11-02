import type { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import type { AccessTokenService } from '../domain/identity/ports.js';
import { LoginUseCase } from '../application/identity/login.use-case.js';
import { RefreshUseCase } from '../application/identity/refresh.use-case.js';
import { LogoutUseCase } from '../application/identity/logout.use-case.js';
import { CreateUserUseCase } from '../application/identity/create-user.use-case.js';
import { GetMeUseCase } from '../application/identity/get-me.use-case.js';
import { ListDestinationsUseCase } from '../application/catalog/list-destinations.use-case.js';
import { GetDestinationUseCase } from '../application/catalog/get-destination.use-case.js';
import { CreateDestinationUseCase } from '../application/catalog/create-destination.use-case.js';
import { UpdateDestinationUseCase } from '../application/catalog/update-destination.use-case.js';
import { DeactivateDestinationUseCase } from '../application/catalog/deactivate-destination.use-case.js';
import { ListHotelsUseCase } from '../application/catalog/list-hotels.use-case.js';
import { CreateHotelUseCase } from '../application/catalog/create-hotel.use-case.js';
import { UpdateHotelUseCase } from '../application/catalog/update-hotel.use-case.js';
import { DeactivateHotelUseCase } from '../application/catalog/deactivate-hotel.use-case.js';
import { ListActivitiesUseCase } from '../application/catalog/list-activities.use-case.js';
import { CreateActivityUseCase } from '../application/catalog/create-activity.use-case.js';
import { UpdateActivityUseCase } from '../application/catalog/update-activity.use-case.js';
import { DeactivateActivityUseCase } from '../application/catalog/deactivate-activity.use-case.js';
import { ListTransportOptionsUseCase } from '../application/catalog/list-transport-options.use-case.js';
import { CreateTransportOptionUseCase } from '../application/catalog/create-transport-option.use-case.js';
import { UpdateTransportOptionUseCase } from '../application/catalog/update-transport-option.use-case.js';
import { DeactivateTransportOptionUseCase } from '../application/catalog/deactivate-transport-option.use-case.js';
import { Argon2PasswordHasher } from '../infrastructure/security/argon2-password-hasher.js';
import { JwtAccessTokenService } from '../infrastructure/security/jwt-access-token.service.js';
import { RandomTokenGenerator } from '../infrastructure/security/random-token.generator.js';
import { SystemClock } from '../infrastructure/system-clock.js';
import { createPrismaClient } from '../infrastructure/persistence/prisma/client.js';
import { PrismaUserRepository } from '../infrastructure/persistence/prisma/user.repository.js';
import { PrismaRefreshTokenRepository } from '../infrastructure/persistence/prisma/refresh-token.repository.js';
import { PrismaDestinationRepository } from '../infrastructure/persistence/prisma/destination.repository.js';
import { PrismaHotelRepository } from '../infrastructure/persistence/prisma/hotel.repository.js';
import { PrismaActivityRepository } from '../infrastructure/persistence/prisma/activity.repository.js';
import { PrismaTransportOptionRepository } from '../infrastructure/persistence/prisma/transport-option.repository.js';
import { AuthController } from '../interfaces/http/auth.controller.js';
import { UserController } from '../interfaces/http/user.controller.js';
import { DestinationController } from '../interfaces/http/destination.controller.js';
import { HotelController } from '../interfaces/http/hotel.controller.js';
import { ActivityController } from '../interfaces/http/activity.controller.js';
import { TransportController } from '../interfaces/http/transport.controller.js';
import type { AppDependencies } from '../app.js';

export interface Container extends AppDependencies {
  prisma: PrismaClient;
}

export function buildContainer(): Container {
  const prisma = createPrismaClient();
  const users = new PrismaUserRepository(prisma);
  const refreshTokens = new PrismaRefreshTokenRepository(prisma);
  const destinations = new PrismaDestinationRepository(prisma);
  const hotels = new PrismaHotelRepository(prisma);
  const activities = new PrismaActivityRepository(prisma);
  const transportOptions = new PrismaTransportOptionRepository(prisma);
  const hasher = new Argon2PasswordHasher();
  const tokens = new RandomTokenGenerator();
  const clock = new SystemClock();
  const accessTokens: AccessTokenService = new JwtAccessTokenService(
    env.JWT_ACCESS_SECRET,
    env.ACCESS_TOKEN_TTL_SECONDS,
  );

  const loginUseCase = new LoginUseCase(
    users,
    hasher,
    accessTokens,
    refreshTokens,
    tokens,
    clock,
    env.REFRESH_TOKEN_TTL_DAYS,
  );
  const refreshUseCase = new RefreshUseCase(
    users,
    accessTokens,
    refreshTokens,
    tokens,
    clock,
    env.REFRESH_TOKEN_TTL_DAYS,
  );
  const logoutUseCase = new LogoutUseCase(refreshTokens, tokens, clock);
  const createUserUseCase = new CreateUserUseCase(users, hasher, clock);
  const getMeUseCase = new GetMeUseCase(users);

  const destinationController = new DestinationController(
    new ListDestinationsUseCase(destinations),
    new GetDestinationUseCase(destinations),
    new CreateDestinationUseCase(destinations, clock),
    new UpdateDestinationUseCase(destinations, clock),
    new DeactivateDestinationUseCase(destinations, clock),
  );
  const hotelController = new HotelController(
    new ListHotelsUseCase(hotels),
    new CreateHotelUseCase(hotels, destinations, clock),
    new UpdateHotelUseCase(hotels, destinations, clock),
    new DeactivateHotelUseCase(hotels, clock),
  );
  const activityController = new ActivityController(
    new ListActivitiesUseCase(activities),
    new CreateActivityUseCase(activities, destinations, clock),
    new UpdateActivityUseCase(activities, destinations, clock),
    new DeactivateActivityUseCase(activities, clock),
  );
  const transportController = new TransportController(
    new ListTransportOptionsUseCase(transportOptions),
    new CreateTransportOptionUseCase(transportOptions, destinations, clock),
    new UpdateTransportOptionUseCase(transportOptions, destinations, clock),
    new DeactivateTransportOptionUseCase(transportOptions, clock),
  );

  return {
    prisma,
    accessTokens,
    authController: new AuthController(loginUseCase, refreshUseCase, logoutUseCase, getMeUseCase),
    userController: new UserController(createUserUseCase),
    destinationController,
    hotelController,
    activityController,
    transportController,
    healthCheck: async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    },
  };
}
