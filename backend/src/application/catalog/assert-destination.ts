import { NotFoundError, ValidationError } from '../../domain/shared/app-error.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';

export async function assertActiveDestination(
  destinations: DestinationRepository,
  destinationId: string,
): Promise<void> {
  const destination = await destinations.findById(destinationId);
  if (!destination) throw new NotFoundError('Destino');
  if (!destination.isActive) throw new ValidationError('El destino no está activo');
}
