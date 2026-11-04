import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, loginAs } from './test-app.js';
import {
  ACTIVITY_ISLAS,
  ACTIVITY_PARAPENTE,
  HOTEL_BOVEDAS,
} from './catalog-fakes.js';

const READY_PROMPT =
  'Viaje a Cartagena para 2 adultos, 5 días, presupuesto de 3 millones, con playa';

type BuiltApp = ReturnType<typeof buildTestApp>;

async function tokenFor(app: BuiltApp, email = 'asesor@trazo.co'): Promise<string> {
  const { accessToken } = await loginAs(app.app, email);
  return accessToken;
}

async function createReadyRequest(app: BuiltApp, token: string, prompt = READY_PROMPT) {
  const response = await request(app.app)
    .post('/api/v1/trip-requests')
    .set('Authorization', `Bearer ${token}`)
    .send({ prompt });
  expect(response.status).toBe(201);
  expect(response.body.tripRequest.status).toBe('READY');
  return response.body.tripRequest.id as string;
}

async function generatePlan(app: BuiltApp, token: string, tripRequestId: string) {
  const response = await request(app.app)
    .post(`/api/v1/trip-requests/${tripRequestId}/generate`)
    .set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(202);
  await app.planning.runner.drain();

  const detail = await request(app.app)
    .get(`/api/v1/trip-requests/${tripRequestId}`)
    .set('Authorization', `Bearer ${token}`);
  expect(detail.status).toBe(200);
  return detail.body.tripRequest as {
    status: string;
    planId: string | null;
    errorCode: string | null;
  };
}

describe('HTTP plan generation', () => {
  it('generates a DRAFT plan asynchronously and exposes planId', async () => {
    const built = buildTestApp();
    const token = await tokenFor(built);
    const tripRequestId = await createReadyRequest(built, token);

    const accepted = await request(built.app)
      .post(`/api/v1/trip-requests/${tripRequestId}/generate`)
      .set('Authorization', `Bearer ${token}`);
    expect(accepted.status).toBe(202);
    expect(accepted.body.status).toBe('GENERATING');
    expect(accepted.body.jobId).toBeTruthy();
    expect(accepted.body.pollAfterMs).toBeGreaterThan(0);

    await built.planning.runner.drain();

    const detail = await request(built.app)
      .get(`/api/v1/trip-requests/${tripRequestId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.tripRequest.status).toBe('GENERATED');
    expect(detail.body.tripRequest.planId).toBeTruthy();
    expect(detail.body.tripRequest.errorCode).toBeNull();

    const planId = detail.body.tripRequest.planId as string;
    const plan = await request(built.app)
      .get(`/api/v1/plans/${planId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(plan.status).toBe(200);
    expect(plan.body.plan.status).toBe('DRAFT');
    expect(plan.body.plan.days).toHaveLength(5);
    expect(plan.body.plan.days[0].items.length).toBeGreaterThan(0);
    expect(plan.body.plan.budget.total.amountMinor).toBeGreaterThan(0);
    expect(plan.body.plan.currency).toBe('COP');
    expect(plan.body.plan.destination.city).toBe('Cartagena');

    const jobs = built.planning.aiJobs.all();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.status).toBe('SUCCEEDED');
    expect(jobs[0]!.model).toBe('mock');

    const duplicate = await request(built.app)
      .post(`/api/v1/trip-requests/${tripRequestId}/generate`)
      .set('Authorization', `Bearer ${token}`);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('CONFLICT');
  });

  it('marks the request FAILED when the destination has no catalog items', async () => {
    const built = buildTestApp();
    const token = await tokenFor(built);
    const tripRequestId = await createReadyRequest(
      built,
      token,
      'Viaje a Santa Marta para 2 adultos, 5 días, presupuesto de 3 millones',
    );

    const detail = await generatePlan(built, token, tripRequestId);
    expect(detail.status).toBe('FAILED');
    expect(detail.errorCode).toBe('VALIDATION_ERROR');
    expect(detail.planId).toBeNull();
  });

  it('enforces ownership on trip requests and plans', async () => {
    const built = buildTestApp();
    const advisor = await tokenFor(built);
    const other = await tokenFor(built, 'otro@trazo.co');
    const admin = await tokenFor(built, 'admin@trazo.co');

    const tripRequestId = await createReadyRequest(built, advisor);
    const detail = await generatePlan(built, advisor, tripRequestId);
    const planId = detail.planId as string;

    const otherRequest = await request(built.app)
      .get(`/api/v1/trip-requests/${tripRequestId}`)
      .set('Authorization', `Bearer ${other}`);
    expect(otherRequest.status).toBe(404);

    const otherPlan = await request(built.app)
      .get(`/api/v1/plans/${planId}`)
      .set('Authorization', `Bearer ${other}`);
    expect(otherPlan.status).toBe(404);

    const adminPlan = await request(built.app)
      .get(`/api/v1/plans/${planId}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(adminPlan.status).toBe(200);
  });
});

describe('HTTP plan editing and lifecycle', () => {
  it('edits metadata, items, margin and publishes a plan', async () => {
    const built = buildTestApp();
    const token = await tokenFor(built);
    const tripRequestId = await createReadyRequest(built, token);
    const generated = await generatePlan(built, token, tripRequestId);
    const planId = generated.planId as string;

    const metadata = await request(built.app)
      .patch(`/api/v1/plans/${planId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Cartagena Premium', marginPercent: 12.5, tags: ['playa', 'lujo'] });
    expect(metadata.status).toBe(200);
    expect(metadata.body.plan.title).toBe('Cartagena Premium');
    expect(metadata.body.plan.budget.marginPercent).toBe(12.5);
    expect(metadata.body.plan.tags).toEqual(['playa', 'lujo']);

    const added = await request(built.app)
      .post(`/api/v1/plans/${planId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        dayNumber: 2,
        type: 'ACTIVITY',
        catalogItemId: ACTIVITY_ISLAS,
        startTime: '15:00',
        notes: 'Tarde de playa',
      });
    expect(added.status).toBe(201);
    const dayTwo = added.body.plan.days.find(
      (day: { dayNumber: number }) => day.dayNumber === 2,
    );
    const addedItem = dayTwo.items.find(
      (item: { catalogItemId: string }) => item.catalogItemId === ACTIVITY_ISLAS,
    );
    expect(addedItem).toBeTruthy();
    expect(addedItem.quantity).toBe(2);

    const updated = await request(built.app)
      .patch(`/api/v1/plans/${planId}/items/${addedItem.id}/details`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 3, notes: 'Tarde completa' });
    expect(updated.status).toBe(200);
    const updatedItem = updated.body.plan.days
      .flatMap((day: { items: Array<{ id: string }> }) => day.items)
      .find((item: { id: string }) => item.id === addedItem.id);
    expect(updatedItem.quantity).toBe(3);

    const moved = await request(built.app)
      .patch(`/api/v1/plans/${planId}/items/${addedItem.id}/position`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dayNumber: 3, position: 0 });
    expect(moved.status).toBe(200);
    const dayThree = moved.body.plan.days.find(
      (day: { dayNumber: number }) => day.dayNumber === 3,
    );
    expect(dayThree.items[0].id).toBe(addedItem.id);

    const replaced = await request(built.app)
      .patch(`/api/v1/plans/${planId}/items/${addedItem.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ catalogItemId: ACTIVITY_PARAPENTE });
    expect(replaced.status).toBe(422);

    const hotelItem = moved.body.plan.days
      .flatMap((day: { items: Array<{ type: string; id: string }> }) => day.items)
      .find((item: { type: string }) => item.type === 'ACCOMMODATION');
    const replacedHotel = await request(built.app)
      .patch(`/api/v1/plans/${planId}/items/${hotelItem.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ catalogItemId: HOTEL_BOVEDAS });
    expect(replacedHotel.status).toBe(200);
    expect(
      replacedHotel.body.plan.days
        .flatMap((day: { items: Array<{ id: string; catalogItemId: string }> }) => day.items)
        .find((item: { id: string }) => item.id === hotelItem.id).catalogItemId,
    ).toBe(HOTEL_BOVEDAS);

    const alternatives = await request(built.app)
      .get(`/api/v1/plans/${planId}/alternatives`)
      .query({ itemId: addedItem.id })
      .set('Authorization', `Bearer ${token}`);
    expect(alternatives.status).toBe(200);
    expect(alternatives.body.itemId).toBe(addedItem.id);
    expect(Array.isArray(alternatives.body.alternatives)).toBe(true);
    expect(alternatives.body.alternatives.length).toBeLessThanOrEqual(3);

    const removed = await request(built.app)
      .delete(`/api/v1/plans/${planId}/items/${addedItem.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(200);
    expect(
      removed.body.plan.days
        .flatMap((day: { items: Array<{ id: string }> }) => day.items)
        .some((item: { id: string }) => item.id === addedItem.id),
    ).toBe(false);

    const saved = await request(built.app)
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', `Bearer ${token}`);
    expect(saved.status).toBe(200);
    expect(saved.body.plan.status).toBe('SAVED');

    const published = await request(built.app)
      .post(`/api/v1/plans/${planId}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(published.status).toBe(200);
    expect(published.body.plan.status).toBe('PUBLISHED');
    expect(published.body.plan.publishedAt).toBeTruthy();

    const forbiddenEdit = await request(built.app)
      .patch(`/api/v1/plans/${planId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No permitido' });
    expect(forbiddenEdit.status).toBe(409);
    expect(forbiddenEdit.body.code).toBe('PLAN_NOT_EDITABLE');

    const duplicated = await request(built.app)
      .post(`/api/v1/plans/${planId}/duplicate`)
      .set('Authorization', `Bearer ${token}`);
    expect(duplicated.status).toBe(201);
    expect(duplicated.body.plan.status).toBe('DRAFT');
    expect(duplicated.body.plan.id).not.toBe(planId);
    expect(duplicated.body.plan.title).toContain('(copia)');
    expect(duplicated.body.plan.version).toBe(published.body.plan.version + 1);

    const archived = await request(built.app)
      .post(`/api/v1/plans/${duplicated.body.plan.id}/archive`)
      .set('Authorization', `Bearer ${token}`);
    expect(archived.status).toBe(200);
    expect(archived.body.plan.status).toBe('ARCHIVED');
  });

  it('rejects publishing without a title', async () => {
    const built = buildTestApp();
    const token = await tokenFor(built);
    const tripRequestId = await createReadyRequest(built, token);
    const generated = await generatePlan(built, token, tripRequestId);
    const planId = generated.planId as string;

    const cleared = await request(built.app)
      .patch(`/api/v1/plans/${planId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: null });
    expect(cleared.status).toBe(200);

    const published = await request(built.app)
      .post(`/api/v1/plans/${planId}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(published.status).toBe(422);
    expect(published.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns JSON, CSV and PDF reports', async () => {
    const built = buildTestApp();
    const token = await tokenFor(built);
    const tripRequestId = await createReadyRequest(built, token);
    const generated = await generatePlan(built, token, tripRequestId);
    const planId = generated.planId as string;

    const json = await request(built.app)
      .get(`/api/v1/plans/${planId}/report`)
      .set('Authorization', `Bearer ${token}`);
    expect(json.status).toBe(200);
    expect(json.body.planId).toBe(planId);
    expect(json.body.days).toHaveLength(5);
    expect(json.body.budget.total.amountMinor).toBeGreaterThan(0);

    const csv = await request(built.app)
      .get(`/api/v1/plans/${planId}/report`)
      .query({ format: 'csv' })
      .set('Authorization', `Bearer ${token}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('subtotal');
    expect(csv.text).toContain('total');

    const pdf = await request(built.app)
      .get(`/api/v1/plans/${planId}/pdf`)
      .set('Authorization', `Bearer ${token}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(Buffer.isBuffer(pdf.body)).toBe(true);
    expect(pdf.body.subarray(0, 8).toString()).toBe('%PDF-1.4');
  });

  it('lists plans with filters and pagination', async () => {
    const built = buildTestApp();
    const token = await tokenFor(built);
    const tripRequestId = await createReadyRequest(built, token);
    const generated = await generatePlan(built, token, tripRequestId);
    const planId = generated.planId as string;

    await request(built.app)
      .post(`/api/v1/plans/${planId}/publish`)
      .set('Authorization', `Bearer ${token}`);

    const published = await request(built.app)
      .get('/api/v1/plans')
      .query({ status: 'PUBLISHED', page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${token}`);
    expect(published.status).toBe(200);
    expect(published.body.total).toBe(1);
    expect(published.body.items[0].id).toBe(planId);

    const search = await request(built.app)
      .get('/api/v1/plans')
      .query({ q: 'Cartagena', page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${token}`);
    expect(search.status).toBe(200);
    expect(search.body.total).toBe(1);
  });
});
