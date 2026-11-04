import type { IntakeQuestion, MissingField } from '@trazo/shared';
import type { Destination } from '../../domain/catalog/destination.js';

const PROMPTS: Record<MissingField, string> = {
  destination: '¿A dónde quieren viajar?',
  duration: '¿Cuántos días y en qué fechas?',
  travelers: '¿Quiénes viajan?',
  budget: '¿Qué presupuesto manejan por persona?',
};

const STATIC_CHIPS: Record<Exclude<MissingField, 'destination'>, string[]> = {
  duration: ['Fin de semana', '5 días', '10 días'],
  travelers: ['Solo', 'Pareja', 'Familia con 2 niños', '4 amigos'],
  budget: ['Económico', 'Medio', 'Premium'],
};

/**
 * Builds at most two questions per turn. Destination chips come from the active catalog so every
 * chip is directly answerable; "Sorpréndenos" resolves to the first featured destination.
 */
export function buildQuestions(
  missingFields: readonly MissingField[],
  destinations: Destination[],
): IntakeQuestion[] {
  const featured = destinations.filter((destination) => destination.isFeatured);
  const pool = featured.length > 0 ? featured : destinations;
  const destinationChips = [
    ...pool.slice(0, 3).map((destination) => destination.city),
    'Sorpréndenos',
  ];

  return missingFields.slice(0, 2).map((field) => ({
    field,
    prompt: PROMPTS[field],
    chips: field === 'destination' ? destinationChips : STATIC_CHIPS[field],
  }));
}
