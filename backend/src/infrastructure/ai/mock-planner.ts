import type {
  AiPlannerContextItem,
  AiPlannerInput,
  AiPlannerPort,
  AiPlannerResult,
} from '../../domain/ai/ports.js';
import { AiInvalidOutputError } from '../../domain/shared/app-error.js';

function byType(
  items: readonly AiPlannerContextItem[],
  type: AiPlannerContextItem['type'],
): AiPlannerContextItem[] {
  return items.filter((item) => item.type === type);
}

/**
 * Deterministic planner used by tests, local development and the demo fallback.
 * It only selects ids from the shortlist; prices and names still come from the catalog.
 */
export class MockPlanner implements AiPlannerPort {
  async generateJson(input: AiPlannerInput): Promise<AiPlannerResult> {
    const { context } = input;
    const { tripRequest, destination } = context;
    const hotels = byType(context.shortlist, 'HOTEL');
    const activities = byType(context.shortlist, 'ACTIVITY');
    const transport = byType(context.shortlist, 'TRANSPORT');

    if (tripRequest.durationDays < 1) {
      throw new AiInvalidOutputError('La duración del viaje no es válida');
    }
    if (activities.length === 0 && tripRequest.durationDays > 1) {
      throw new AiInvalidOutputError('El catálogo no tiene actividades para completar el itinerario');
    }

    const days = Array.from({ length: tripRequest.durationDays }, (_, index) => {
      const dayNumber = index + 1;
      const items: Array<{
        type: 'ACCOMMODATION' | 'ACTIVITY' | 'TRANSPORT';
        catalogItemId: string;
        startTime?: string;
        endTime?: string;
        notes?: string;
      }> = [];

      if (dayNumber === 1 && transport[0]) {
        items.push({
          type: 'TRANSPORT',
          catalogItemId: transport[0].id,
          startTime: '08:00',
          endTime: '09:30',
          notes: 'Llegada al destino.',
        });
      }

      if (dayNumber === 1 && tripRequest.durationDays > 1 && hotels[0]) {
        items.push({
          type: 'ACCOMMODATION',
          catalogItemId: hotels[0].id,
          startTime: '15:00',
          notes: 'Check-in y alojamiento durante la estadía.',
        });
      }

      if (activities.length > 0) {
        const first = activities[(dayNumber - 1) % activities.length]!;
        items.push({
          type: 'ACTIVITY',
          catalogItemId: first.id,
          startTime: dayNumber === 1 ? '10:30' : '09:00',
          notes: 'Actividad principal del día.',
        });
        if (activities.length > 1 && dayNumber % 2 === 0) {
          const second = activities[(dayNumber - 1 + 1) % activities.length]!;
          items.push({
            type: 'ACTIVITY',
            catalogItemId: second.id,
            startTime: '14:30',
            notes: 'Actividad complementaria.',
          });
        }
      }

      if (items.length === 0) {
        throw new AiInvalidOutputError(`No hay ítems de catálogo para el día ${dayNumber}`);
      }

      return {
        dayNumber,
        title: dayNumber === 1 ? 'Llegada y primeros pasos' : `Día ${dayNumber} en ${destination.city}`,
        items,
      };
    });

    return {
      json: {
        title: `${destination.city} Esencial ${tripRequest.durationDays} días`,
        summary: `Plan de ${tripRequest.durationDays} días en ${destination.city} para ${tripRequest.adults + tripRequest.children} viajeros.`,
        days,
      },
      model: 'mock',
      latencyMs: 0,
      tokensIn: 0,
      tokensOut: 0,
    };
  }
}
