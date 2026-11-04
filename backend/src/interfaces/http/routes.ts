import { Router } from 'express';
import {
  answerTripRequestSchema,
  catalogIdParamsSchema,
  createActivitySchema,
  createDestinationSchema,
  createHotelSchema,
  createTransportOptionSchema,
  createTripRequestSchema,
  createUserSchema,
  listActivitiesQuerySchema,
  listDestinationsQuerySchema,
  listHotelsQuerySchema,
  listTransportQuerySchema,
  listTripRequestsQuerySchema,
  loginSchema,
  tripRequestIdParamsSchema,
  updateActivitySchema,
  updateDestinationSchema,
  updateHotelSchema,
  updateTransportOptionSchema,
} from '@turiviaje/shared';
import type { AccessTokenService } from '../../domain/identity/ports.js';
import type { ActivityController } from './activity.controller.js';
import type { AuthController } from './auth.controller.js';
import type { DestinationController } from './destination.controller.js';
import type { HotelController } from './hotel.controller.js';
import type { TransportController } from './transport.controller.js';
import type { TripRequestController } from './trip-request.controller.js';
import type { UserController } from './user.controller.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import { validateBody, validateParams, validateQuery } from './middleware/validate.js';
import { loginLimiter, refreshLimiter, tripRequestLimiter } from './rate-limit.js';

export interface ApiRouterDependencies {
  authController: AuthController;
  userController: UserController;
  destinationController: DestinationController;
  hotelController: HotelController;
  activityController: ActivityController;
  transportController: TransportController;
  tripRequestController: TripRequestController;
  accessTokens: AccessTokenService;
}

export function createApiRouter(deps: ApiRouterDependencies): Router {
  const router = Router();
  const auth = requireAuth(deps.accessTokens);
  const admin = requireRole('ADMIN');

  router.post('/auth/login', loginLimiter, validateBody(loginSchema), deps.authController.login);
  router.post('/auth/refresh', refreshLimiter, deps.authController.refresh);
  router.post('/auth/logout', deps.authController.logout);
  router.get('/auth/me', auth, deps.authController.me);

  router.post('/users', auth, admin, validateBody(createUserSchema), deps.userController.create);

  router.get(
    '/catalog/destinations',
    auth,
    validateQuery(listDestinationsQuerySchema),
    deps.destinationController.list,
  );
  router.get(
    '/catalog/destinations/:id',
    auth,
    validateParams(catalogIdParamsSchema),
    deps.destinationController.get,
  );
  router.post(
    '/catalog/destinations',
    auth,
    admin,
    validateBody(createDestinationSchema),
    deps.destinationController.create,
  );
  router.patch(
    '/catalog/destinations/:id',
    auth,
    admin,
    validateParams(catalogIdParamsSchema),
    validateBody(updateDestinationSchema),
    deps.destinationController.update,
  );
  router.delete(
    '/catalog/destinations/:id',
    auth,
    admin,
    validateParams(catalogIdParamsSchema),
    deps.destinationController.remove,
  );

  router.get(
    '/catalog/hotels',
    auth,
    validateQuery(listHotelsQuerySchema),
    deps.hotelController.list,
  );
  router.post(
    '/catalog/hotels',
    auth,
    admin,
    validateBody(createHotelSchema),
    deps.hotelController.create,
  );
  router.patch(
    '/catalog/hotels/:id',
    auth,
    admin,
    validateParams(catalogIdParamsSchema),
    validateBody(updateHotelSchema),
    deps.hotelController.update,
  );
  router.delete(
    '/catalog/hotels/:id',
    auth,
    admin,
    validateParams(catalogIdParamsSchema),
    deps.hotelController.remove,
  );

  router.get(
    '/catalog/activities',
    auth,
    validateQuery(listActivitiesQuerySchema),
    deps.activityController.list,
  );
  router.post(
    '/catalog/activities',
    auth,
    admin,
    validateBody(createActivitySchema),
    deps.activityController.create,
  );
  router.patch(
    '/catalog/activities/:id',
    auth,
    admin,
    validateParams(catalogIdParamsSchema),
    validateBody(updateActivitySchema),
    deps.activityController.update,
  );
  router.delete(
    '/catalog/activities/:id',
    auth,
    admin,
    validateParams(catalogIdParamsSchema),
    deps.activityController.remove,
  );

  router.get(
    '/catalog/transport',
    auth,
    validateQuery(listTransportQuerySchema),
    deps.transportController.list,
  );
  router.post(
    '/catalog/transport',
    auth,
    admin,
    validateBody(createTransportOptionSchema),
    deps.transportController.create,
  );
  router.patch(
    '/catalog/transport/:id',
    auth,
    admin,
    validateParams(catalogIdParamsSchema),
    validateBody(updateTransportOptionSchema),
    deps.transportController.update,
  );
  router.delete(
    '/catalog/transport/:id',
    auth,
    admin,
    validateParams(catalogIdParamsSchema),
    deps.transportController.remove,
  );

  router.get(
    '/trip-requests',
    auth,
    validateQuery(listTripRequestsQuerySchema),
    deps.tripRequestController.list,
  );
  router.post(
    '/trip-requests',
    auth,
    tripRequestLimiter,
    validateBody(createTripRequestSchema),
    deps.tripRequestController.create,
  );
  router.get(
    '/trip-requests/:id',
    auth,
    validateParams(tripRequestIdParamsSchema),
    deps.tripRequestController.get,
  );
  router.post(
    '/trip-requests/:id/answers',
    auth,
    validateParams(tripRequestIdParamsSchema),
    validateBody(answerTripRequestSchema),
    deps.tripRequestController.answer,
  );

  return router;
}
