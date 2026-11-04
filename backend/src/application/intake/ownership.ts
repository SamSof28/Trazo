import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { TripRequest } from '../../domain/intake/trip-request.js';
import { NotFoundError } from '../../domain/shared/app-error.js';

/** Ownership is enforced in the use case. A foreign resource is reported as 404, never 403. */
export function assertTripRequestAccess(
  request: TripRequest,
  actor: AccessTokenPayload,
): void {
  if (actor.role !== 'ADMIN' && request.advisorId !== actor.userId) {
    throw new NotFoundError('Solicitud de viaje');
  }
}
