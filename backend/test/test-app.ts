import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { LoginUseCase } from '../src/application/identity/login.use-case.js';
import { RefreshUseCase } from '../src/application/identity/refresh.use-case.js';
import { LogoutUseCase } from '../src/application/identity/logout.use-case.js';
import { CreateUserUseCase } from '../src/application/identity/create-user.use-case.js';
import { ListUsersUseCase } from '../src/application/identity/list-users.use-case.js';
import { GetMeUseCase } from '../src/application/identity/get-me.use-case.js';
import { ListDestinationsUseCase } from '../src/application/catalog/list-destinations.use-case.js';
import { GetDestinationUseCase } from '../src/application/catalog/get-destination.use-case.js';
import { CreateDestinationUseCase } from '../src/application/catalog/create-destination.use-case.js';
import { UpdateDestinationUseCase } from '../src/application/catalog/update-destination.use-case.js';
import { DeactivateDestinationUseCase } from '../src/application/catalog/deactivate-destination.use-case.js';
import { ListHotelsUseCase } from '../src/application/catalog/list-hotels.use-case.js';
import { CreateHotelUseCase } from '../src/application/catalog/create-hotel.use-case.js';
import { UpdateHotelUseCase } from '../src/application/catalog/update-hotel.use-case.js';
import { DeactivateHotelUseCase } from '../src/application/catalog/deactivate-hotel.use-case.js';
import { ListActivitiesUseCase } from '../src/application/catalog/list-activities.use-case.js';
import { CreateActivityUseCase } from '../src/application/catalog/create-activity.use-case.js';
import { UpdateActivityUseCase } from '../src/application/catalog/update-activity.use-case.js';
import { DeactivateActivityUseCase } from '../src/application/catalog/deactivate-activity.use-case.js';
import { ListTransportOptionsUseCase } from '../src/application/catalog/list-transport-options.use-case.js';
import { CreateTransportOptionUseCase } from '../src/application/catalog/create-transport-option.use-case.js';
import { UpdateTransportOptionUseCase } from '../src/application/catalog/update-transport-option.use-case.js';
import { DeactivateTransportOptionUseCase } from '../src/application/catalog/deactivate-transport-option.use-case.js';
import { CreateTripRequestUseCase } from '../src/application/intake/create-trip-request.use-case.js';
import { GetTripRequestUseCase } from '../src/application/intake/get-trip-request.use-case.js';
import { ListTripRequestsUseCase } from '../src/application/intake/list-trip-requests.use-case.js';
import { AnswerTripRequestUseCase } from '../src/application/intake/answer-trip-request.use-case.js';
import { StartGenerationUseCase } from '../src/application/planning/start-generation.use-case.js';
import { RunGenerationJobUseCase } from '../src/application/planning/run-generation-job.use-case.js';
import { GetPlanUseCase } from '../src/application/planning/get-plan.use-case.js';
import { ListPlansUseCase } from '../src/application/planning/list-plans.use-case.js';
import { UpdatePlanUseCase } from '../src/application/planning/update-plan.use-case.js';
import {
  AddPlanItemUseCase,
  MovePlanItemUseCase,
  RemovePlanItemUseCase,
  ReplacePlanItemUseCase,
  UpdatePlanItemUseCase,
} from '../src/application/planning/plan-items.use-cases.js';
import {
  ArchivePlanUseCase,
  DuplicatePlanUseCase,
  PublishPlanUseCase,
  SavePlanUseCase,
} from '../src/application/planning/plan-lifecycle.use-cases.js';
import { ListPlanAlternativesUseCase } from '../src/application/planning/plan-alternatives.use-case.js';
import { GetPlanReportUseCase } from '../src/application/planning/plan-report.use-case.js';
import { AuthController } from '../src/interfaces/http/auth.controller.js';
import { UserController } from '../src/interfaces/http/user.controller.js';
import { DestinationController } from '../src/interfaces/http/destination.controller.js';
import { HotelController } from '../src/interfaces/http/hotel.controller.js';
import { ActivityController } from '../src/interfaces/http/activity.controller.js';
import { TransportController } from '../src/interfaces/http/transport.controller.js';
import { TripRequestController } from '../src/interfaces/http/trip-request.controller.js';
import { PlanController } from '../src/interfaces/http/plan.controller.js';
import { JwtAccessTokenService } from '../src/infrastructure/security/jwt-access-token.service.js';
import { MockPlanner } from '../src/infrastructure/ai/mock-planner.js';
import {
  FakeHasher,
  FixedClock,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
  SequentialTokenGenerator,
  makeUser,
} from './fakes.js';
import {
  ACTIVITY_ISLAS,
  ACTIVITY_PARAPENTE,
  DEST_INACTIVE,
  DEST_MEDELLIN,
  DEST_SANTA_MARTA,
  HOTEL_BOVEDAS,
  HOTEL_INACTIVE,
  HOTEL_LAURELES,
  InMemoryActivityRepository,
  InMemoryDestinationRepository,
  InMemoryHotelRepository,
  InMemoryTransportOptionRepository,
  TRANSPORT_BUS,
  makeActivity,
  makeDestination,
  makeHotel,
  makeTransportOption,
} from './catalog-fakes.js';
import { InMemoryTripRequestRepository } from './intake-fakes.js';
import {
  DeferredGenerationRunner,
  InMemoryAiJobRepository,
  InMemoryPlanRepository,
} from './planning-fakes.js';

const SECRET = 'test-secret-that-is-at-least-32-chars-long';

export function buildTestApp(): {
  app: Express;
  accessTokens: JwtAccessTokenService;
  catalog: {
    destinations: InMemoryDestinationRepository;
    hotels: InMemoryHotelRepository;
    activities: InMemoryActivityRepository;
    transportOptions: InMemoryTransportOptionRepository;
  };
  intake: {
    tripRequests: InMemoryTripRequestRepository;
  };
  planning: {
    plans: InMemoryPlanRepository;
    aiJobs: InMemoryAiJobRepository;
    runner: DeferredGenerationRunner;
  };
} {
  const users = new InMemoryUserRepository([
    makeUser(),
    makeUser({
      id: 'user-2',
      name: 'Otro Asesor',
      email: 'otro@trazo.co',
    }),
    makeUser({
      id: 'admin-1',
      name: 'Admin Demo',
      email: 'admin@trazo.co',
      role: 'ADMIN',
    }),
  ]);
  const hasher = new FakeHasher();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const tokens = new SequentialTokenGenerator();
  const clock = new FixedClock();
  const accessTokens = new JwtAccessTokenService(SECRET, 900);

  const destinations = new InMemoryDestinationRepository([
    makeDestination(),
    makeDestination({
      id: DEST_MEDELLIN,
      city: 'Medellín',
      slug: 'medellin',
      isFeatured: false,
      fromPriceMinor: 28_000_000,
    }),
    makeDestination({
      id: DEST_SANTA_MARTA,
      city: 'Santa Marta',
      slug: 'santa-marta',
      isFeatured: false,
      fromPriceMinor: 42_000_000,
    }),
    makeDestination({
      id: DEST_INACTIVE,
      city: 'San Andrés',
      slug: 'san-andres',
      isActive: false,
      isFeatured: false,
      fromPriceMinor: null,
    }),
  ]);
  const hotels = new InMemoryHotelRepository([
    makeHotel(),
    makeHotel({
      id: HOTEL_BOVEDAS,
      name: 'Hotel Bóvedas de San Pedro',
      category: 4,
      pricePerNightMinor: 52_000_000,
    }),
    makeHotel({
      id: HOTEL_LAURELES,
      destinationId: DEST_MEDELLIN,
      name: 'Hotel Laureles 70',
      category: 3,
      pricePerNightMinor: 28_000_000,
      amenities: null,
    }),
    makeHotel({
      id: HOTEL_INACTIVE,
      name: 'Hotel Inactivo',
      isActive: false,
      pricePerNightMinor: 10_000_000,
    }),
  ]);
  const activities = new InMemoryActivityRepository([
    makeActivity(),
    makeActivity({
      id: ACTIVITY_ISLAS,
      name: 'Islas del Rosario y Barú',
      tags: ['playa', 'naturaleza'],
      intensity: 'MEDIUM',
      pricePerPersonMinor: 28_000_000,
    }),
    makeActivity({
      id: ACTIVITY_PARAPENTE,
      destinationId: DEST_MEDELLIN,
      name: 'Parapente en San Félix',
      tags: ['aventura'],
      intensity: 'HIGH',
      pricePerPersonMinor: 22_000_000,
    }),
  ]);
  const transportOptions = new InMemoryTransportOptionRepository([
    makeTransportOption(),
    makeTransportOption({
      id: TRANSPORT_BUS,
      mode: 'BUS',
      provider: 'Expreso Brasilia',
      priceMinor: 6_000_000,
      durationMinutes: 240,
    }),
  ]);
  const tripRequests = new InMemoryTripRequestRepository();
  const plans = new InMemoryPlanRepository();
  const aiJobs = new InMemoryAiJobRepository();

  const authController = new AuthController(
    new LoginUseCase(users, hasher, accessTokens, refreshTokens, tokens, clock, 7),
    new RefreshUseCase(users, accessTokens, refreshTokens, tokens, clock, 7),
    new LogoutUseCase(refreshTokens, tokens, clock),
    new GetMeUseCase(users),
  );
  const userController = new UserController(
    new CreateUserUseCase(users, hasher, clock),
    new ListUsersUseCase(users),
  );
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
  const runGenerationJob = new RunGenerationJobUseCase({
    tripRequests,
    plans,
    aiJobs,
    destinations,
    hotels,
    activities,
    transportOptions,
    planner: new MockPlanner(),
    clock,
    timeoutMs: 5_000,
  });
  const runner = new DeferredGenerationRunner(runGenerationJob);

  const tripRequestController = new TripRequestController(
    new CreateTripRequestUseCase(tripRequests, destinations, clock),
    new GetTripRequestUseCase(tripRequests, destinations),
    new ListTripRequestsUseCase(tripRequests, destinations),
    new AnswerTripRequestUseCase(tripRequests, destinations, clock),
    new StartGenerationUseCase(tripRequests, plans, aiJobs, clock),
    runner,
  );

  const planItemDependencies = {
    plans,
    destinations,
    tripRequests,
    clock,
    hotels,
    activities,
    transportOptions,
  };
  const planController = new PlanController(
    new ListPlansUseCase(plans, destinations),
    new GetPlanUseCase(plans, destinations),
    new UpdatePlanUseCase(plans, destinations, clock),
    new AddPlanItemUseCase(planItemDependencies),
    new ReplacePlanItemUseCase(planItemDependencies),
    new UpdatePlanItemUseCase(planItemDependencies),
    new MovePlanItemUseCase(planItemDependencies),
    new RemovePlanItemUseCase(planItemDependencies),
    new SavePlanUseCase({ plans, destinations, tripRequests, clock }),
    new PublishPlanUseCase({ plans, destinations, tripRequests, clock }),
    new ArchivePlanUseCase({ plans, destinations, tripRequests, clock }),
    new DuplicatePlanUseCase({ plans, destinations, tripRequests, clock }),
    new ListPlanAlternativesUseCase({ plans, hotels, activities, transportOptions }),
    new GetPlanReportUseCase(plans, destinations),
  );

  const app = createApp({
    authController,
    userController,
    destinationController,
    hotelController,
    activityController,
    transportController,
    tripRequestController,
    planController,
    accessTokens,
    healthCheck: async () => true,
  });

  return {
    app,
    accessTokens,
    catalog: { destinations, hotels, activities, transportOptions },
    intake: { tripRequests },
    planning: { plans, aiJobs, runner },
  };
}

export async function loginAs(
  app: Express,
  email: string,
  password = 'secret-password',
): Promise<{ accessToken: string; cookie: string }> {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  const cookies = response.headers['set-cookie'];
  const cookie = Array.isArray(cookies) ? cookies[0] : cookies;
  return {
    accessToken: response.body.accessToken as string,
    cookie: cookie ?? '',
  };
}
