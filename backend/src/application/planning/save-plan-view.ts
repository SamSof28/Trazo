import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import type { Plan } from '../../domain/planning/plan.js';
import { NotFoundError } from '../../domain/shared/app-error.js';
import type { PlanView } from './views.js';

/** Persists a mutated plan and reloads its destination for the HTTP presenter. */
export async function savePlanView(
  plans: PlanRepository,
  destinations: DestinationRepository,
  plan: Plan,
): Promise<PlanView> {
  const saved = await plans.update(plan);
  if (!saved) throw new NotFoundError('Plan');
  const destination = await destinations.findById(saved.destinationId);
  if (!destination) throw new NotFoundError('Destino del plan');
  return { plan: saved, destination };
}
