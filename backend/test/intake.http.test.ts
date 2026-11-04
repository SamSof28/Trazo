import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, loginAs } from './test-app.js';
import { makeTripRequest } from './intake-fakes.js';

async function advisorToken(app: Parameters<typeof loginAs>[0]): Promise<string> {
  const { accessToken } = await loginAs(app, 'asesor@trazo.co');
  return accessToken;
}

async function adminToken(app: Parameters<typeof loginAs>[0]): Promise<string> {
  const { accessToken } = await loginAs(app, 'admin@trazo.co');
  return accessToken;
}

const COMPLETE_PROMPT =
  'Viaje a Cartagena para 2 adultos, 5 días, presupuesto de 3 millones, con playa';

describe('HTTP trip requests', () => {
  it('requires authentication', async () => {
    const { app } = buildTestApp();
    const response = await request(app).post('/api/v1/trip-requests').send({
      prompt: 'Quiero un viaje',
    });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
  });

  it('creates an incomplete request and asks only what is missing', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const response = await request(app)
      .post('/api/v1/trip-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Quiero un viaje a Cartagena en diciembre' });

    expect(response.status).toBe(201);
    const tripRequest = response.body.tripRequest;
    expect(tripRequest.status).toBe('AWAITING_INPUT');
    expect(tripRequest.slots.destination.city).toBe('Cartagena');
    expect(tripRequest.missingFields).toEqual(['duration', 'travelers', 'budget']);
    expect(tripRequest.questions).toHaveLength(2);
    expect(tripRequest.questions[0].field).toBe('duration');
    expect(tripRequest.questions[1].field).toBe('travelers');
    expect(tripRequest.questions[0].chips).toContain('5 días');
  });

  it('creates a READY request when the prompt has every required slot', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const response = await request(app)
      .post('/api/v1/trip-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: COMPLETE_PROMPT });

    expect(response.status).toBe(201);
    const tripRequest = response.body.tripRequest;
    expect(tripRequest.status).toBe('READY');
    expect(tripRequest.missingFields).toEqual([]);
    expect(tripRequest.questions).toEqual([]);
    expect(tripRequest.slots.adults).toBe(2);
    expect(tripRequest.slots.durationDays).toBe(5);
    expect(tripRequest.slots.budgetMax).toEqual({
      amountMinor: 300_000_000,
      currency: 'COP',
    });
    expect(tripRequest.slots.interests).toEqual(['playa']);
  });

  it('answers questions one turn at a time until READY', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const created = await request(app)
      .post('/api/v1/trip-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Quiero un viaje a Cartagena' });

    const id = created.body.tripRequest.id as string;

    const firstTurn = await request(app)
      .post(`/api/v1/trip-requests/${id}/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [
          { field: 'duration', value: '5 días' },
          { field: 'travelers', value: 'Pareja' },
        ],
      });

    expect(firstTurn.status).toBe(200);
    expect(firstTurn.body.tripRequest.status).toBe('AWAITING_INPUT');
    expect(firstTurn.body.tripRequest.missingFields).toEqual(['budget']);
    expect(firstTurn.body.tripRequest.questions).toHaveLength(1);
    expect(firstTurn.body.tripRequest.questions[0].field).toBe('budget');

    const secondTurn = await request(app)
      .post(`/api/v1/trip-requests/${id}/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ field: 'budget', value: 'Medio' }] });

    expect(secondTurn.status).toBe(200);
    expect(secondTurn.body.tripRequest.status).toBe('READY');
    expect(secondTurn.body.tripRequest.missingFields).toEqual([]);
    expect(secondTurn.body.tripRequest.questions).toEqual([]);
    expect(secondTurn.body.tripRequest.slots.budgetMin).toEqual({
      amountMinor: 200_000_000,
      currency: 'COP',
    });
  });

  it('rejects an unknown destination with a field-aware validation error', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const created = await request(app)
      .post('/api/v1/trip-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Quiero un viaje' });
    const id = created.body.tripRequest.id as string;

    const response = await request(app)
      .post(`/api/v1/trip-requests/${id}/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ field: 'destination', value: 'París' }] });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors).toEqual([
      { field: 'destination', message: expect.stringMatching(/catálogo/i) },
    ]);
  });

  it('rejects duplicate answer fields and invalid payloads', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const created = await request(app)
      .post('/api/v1/trip-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Quiero un viaje a Cartagena' });
    const id = created.body.tripRequest.id as string;

    const duplicate = await request(app)
      .post(`/api/v1/trip-requests/${id}/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [
          { field: 'budget', value: 'Medio' },
          { field: 'budget', value: 'Premium' },
        ],
      });
    expect(duplicate.status).toBe(422);
    expect(duplicate.body.errors[0].field).toBe('answers.1.field');

    const unknownField = await request(app)
      .post(`/api/v1/trip-requests/${id}/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ field: 'dates', value: 'diciembre' }] });
    expect(unknownField.status).toBe(422);
  });

  it('enforces ownership and lets ADMIN see any request', async () => {
    const { app, intake } = buildTestApp();
    const advisor = await advisorToken(app);
    const admin = await adminToken(app);

    const created = await request(app)
      .post('/api/v1/trip-requests')
      .set('Authorization', `Bearer ${advisor}`)
      .send({ prompt: 'Quiero un viaje a Cartagena' });
    const ownId = created.body.tripRequest.id as string;

    const own = await request(app)
      .get(`/api/v1/trip-requests/${ownId}`)
      .set('Authorization', `Bearer ${advisor}`);
    expect(own.status).toBe(200);

    await intake.tripRequests.create(
      makeTripRequest({
        id: '99999999-9999-4999-8999-999999999999',
        advisorId: 'user-2',
        promptOriginal: 'Viaje ajeno',
      }),
    );

    const foreignAsAdvisor = await request(app)
      .get('/api/v1/trip-requests/99999999-9999-4999-8999-999999999999')
      .set('Authorization', `Bearer ${advisor}`);
    expect(foreignAsAdvisor.status).toBe(404);

    const foreignAsAdmin = await request(app)
      .get('/api/v1/trip-requests/99999999-9999-4999-8999-999999999999')
      .set('Authorization', `Bearer ${admin}`);
    expect(foreignAsAdmin.status).toBe(200);
  });

  it('lists only the advisor requests with pagination and status filter', async () => {
    const { app } = buildTestApp();
    const advisor = await advisorToken(app);
    const admin = await adminToken(app);

    await request(app)
      .post('/api/v1/trip-requests')
      .set('Authorization', `Bearer ${advisor}`)
      .send({ prompt: 'Quiero un viaje a Cartagena' });
    await request(app)
      .post('/api/v1/trip-requests')
      .set('Authorization', `Bearer ${advisor}`)
      .send({ prompt: COMPLETE_PROMPT });
    await request(app)
      .post('/api/v1/trip-requests')
      .set('Authorization', `Bearer ${admin}`)
      .send({ prompt: 'Viaje del administrador a Medellín' });

    const advisorList = await request(app)
      .get('/api/v1/trip-requests?page=1&pageSize=10')
      .set('Authorization', `Bearer ${advisor}`);
    expect(advisorList.status).toBe(200);
    expect(advisorList.body.total).toBe(2);
    expect(advisorList.body.items).toHaveLength(2);

    const adminList = await request(app)
      .get('/api/v1/trip-requests?page=1&pageSize=10')
      .set('Authorization', `Bearer ${admin}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.total).toBe(3);

    const readyOnly = await request(app)
      .get('/api/v1/trip-requests?status=READY')
      .set('Authorization', `Bearer ${advisor}`);
    expect(readyOnly.status).toBe(200);
    expect(readyOnly.body.total).toBe(1);

    const paged = await request(app)
      .get('/api/v1/trip-requests?page=1&pageSize=1')
      .set('Authorization', `Bearer ${advisor}`);
    expect(paged.status).toBe(200);
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.total).toBe(2);
  });

  it('validates ids, query parameters and prompt length', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const badId = await request(app)
      .get('/api/v1/trip-requests/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);
    expect(badId.status).toBe(422);

    const badStatus = await request(app)
      .get('/api/v1/trip-requests?status=UNKNOWN')
      .set('Authorization', `Bearer ${token}`);
    expect(badStatus.status).toBe(422);

    const unknownQuery = await request(app)
      .get('/api/v1/trip-requests?unknown=1')
      .set('Authorization', `Bearer ${token}`);
    expect(unknownQuery.status).toBe(422);

    const tooLong = await request(app)
      .post('/api/v1/trip-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'a'.repeat(2001) });
    expect(tooLong.status).toBe(422);

    const missing = await request(app)
      .get('/api/v1/trip-requests/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });
});
