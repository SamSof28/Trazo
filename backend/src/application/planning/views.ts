import type { Destination } from '../../domain/catalog/destination.js';
import type { Plan } from '../../domain/planning/plan.js';

export interface PlanView {
  plan: Plan;
  destination: Destination;
}
