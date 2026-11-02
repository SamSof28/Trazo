import type { Activity } from '../../domain/catalog/activity.js';
import type {
  ActivityRepository,
  ActivitySearchCriteria,
  Page,
} from '../../domain/catalog/ports.js';

export class ListActivitiesUseCase {
  constructor(private readonly activities: ActivityRepository) {}

  async execute(criteria: ActivitySearchCriteria): Promise<Page<Activity>> {
    return this.activities.search(criteria);
  }
}
