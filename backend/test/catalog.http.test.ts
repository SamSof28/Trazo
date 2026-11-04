import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  DEST_CARTAGENA,
  DEST_INACTIVE,
  DEST_MEDELLIN,
  HOTEL_BOVEDAS,
  HOTEL_CASA_SAN_AGUSTIN,
} from './catalog-fakes.js';
import { buildTestApp, loginAs } from './test-app.js';

async function advisorToken(app: Parameters<typeof loginAs>[0]): Promise<string> {
  const { accessToken } = await loginAs(app, 'asesor@trazo.co');
  return accessToken;
}

async function adminToken(app: Parameters<typeof loginAs>[0]): Promise<string> {
  const { accessToken } = await loginAs(app, 'admin@trazo.co');
  return accessToken;
}

const NEW_DESTINATION = {
  city: 'Bogotá',
  country: 'Colombia',
  latitude: 4.711,
  longitude: -74.0721,
  tags: ['cultura', 'gastronomia'],
  isFeatured: true,
};

describe('HTTP catalog', () => {
  it('requires authentication for catalog reads', async () => {
    const { app } = buildTestApp();
    const response = await request(app).get('/api/v1/catalog/destinations');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
  });

  it('lists active destinations with pagination, filters and fromPrice', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const all = await request(app)
      .get('/api/v1/catalog/destinations')
      .set('Authorization', `Bearer ${token}`);

    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    expect(all.body.page).toBe(1);
    expect(all.body.pageSize).toBe(20);
    expect(all.body.items.map((item: { city: string }) => item.city)).toEqual([
      'Cartagena',
      'Medellín',
      'Santa Marta',
    ]);
    expect(all.body.items[0].fromPrice).toEqual({
      amountMinor: 52_000_000,
      currency: 'COP',
    });
    expect(all.body.items.some((item: { id: string }) => item.id === DEST_INACTIVE)).toBe(false);

    const filtered = await request(app)
      .get('/api/v1/catalog/destinations?q=medell&featured=false')
      .set('Authorization', `Bearer ${token}`);

    expect(filtered.status).toBe(200);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.items[0].slug).toBe('medellin');

    const paged = await request(app)
      .get('/api/v1/catalog/destinations?country=Colombia&page=1&pageSize=2')
      .set('Authorization', `Bearer ${token}`);

    expect(paged.status).toBe(200);
    expect(paged.body.total).toBe(3);
    expect(paged.body.items).toHaveLength(2);

    const featured = await request(app)
      .get('/api/v1/catalog/destinations?featured=true')
      .set('Authorization', `Bearer ${token}`);

    expect(featured.status).toBe(200);
    expect(featured.body.total).toBe(1);
    expect(featured.body.items[0].city).toBe('Cartagena');
  });

  it('rejects invalid and unknown query parameters', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const invalidPage = await request(app)
      .get('/api/v1/catalog/destinations?page=0')
      .set('Authorization', `Bearer ${token}`);
    expect(invalidPage.status).toBe(422);
    expect(invalidPage.body.code).toBe('VALIDATION_ERROR');

    const unknown = await request(app)
      .get('/api/v1/catalog/destinations?unknown=1')
      .set('Authorization', `Bearer ${token}`);
    expect(unknown.status).toBe(422);
  });

  it('returns a destination detail and hides inactive or unknown destinations', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const detail = await request(app)
      .get(`/api/v1/catalog/destinations/${DEST_CARTAGENA}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.destination.city).toBe('Cartagena');

    const inactive = await request(app)
      .get(`/api/v1/catalog/destinations/${DEST_INACTIVE}`)
      .set('Authorization', `Bearer ${token}`);
    expect(inactive.status).toBe(404);

    const unknown = await request(app)
      .get('/api/v1/catalog/destinations/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(unknown.status).toBe(404);

    const invalid = await request(app)
      .get('/api/v1/catalog/destinations/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);
    expect(invalid.status).toBe(422);
  });

  it('lists hotels filtered by destination, price and currency', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const byDestination = await request(app)
      .get(`/api/v1/catalog/hotels?destinationId=${DEST_CARTAGENA}`)
      .set('Authorization', `Bearer ${token}`);

    expect(byDestination.status).toBe(200);
    expect(byDestination.body.total).toBe(2);
    expect(byDestination.body.items.map((item: { id: string }) => item.id)).toEqual([
      HOTEL_BOVEDAS,
      HOTEL_CASA_SAN_AGUSTIN,
    ]);

    const cheap = await request(app)
      .get(`/api/v1/catalog/hotels?destinationId=${DEST_CARTAGENA}&maxPriceMinor=60000000`)
      .set('Authorization', `Bearer ${token}`);
    expect(cheap.status).toBe(200);
    expect(cheap.body.total).toBe(1);
    expect(cheap.body.items[0].id).toBe(HOTEL_BOVEDAS);

    const wrongCurrency = await request(app)
      .get('/api/v1/catalog/hotels?currency=USD')
      .set('Authorization', `Bearer ${token}`);
    expect(wrongCurrency.status).toBe(200);
    expect(wrongCurrency.body.total).toBe(0);
  });

  it('lists activities by interest and intensity', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const beach = await request(app)
      .get('/api/v1/catalog/activities?interest=playa')
      .set('Authorization', `Bearer ${token}`);
    expect(beach.status).toBe(200);
    expect(beach.body.total).toBe(1);
    expect(beach.body.items[0].name).toBe('Islas del Rosario y Barú');

    const high = await request(app)
      .get('/api/v1/catalog/activities?intensity=HIGH')
      .set('Authorization', `Bearer ${token}`);
    expect(high.status).toBe(200);
    expect(high.body.total).toBe(1);
    expect(high.body.items[0].name).toBe('Parapente en San Félix');
  });

  it('lists transport options by origin, destination and mode', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const route = await request(app)
      .get(`/api/v1/catalog/transport?originId=${DEST_MEDELLIN}&destinationId=${DEST_CARTAGENA}`)
      .set('Authorization', `Bearer ${token}`);

    expect(route.status).toBe(200);
    expect(route.body.total).toBe(2);
    expect(route.body.items.map((item: { mode: string }) => item.mode)).toEqual(['BUS', 'FLIGHT']);

    const flights = await request(app)
      .get('/api/v1/catalog/transport?mode=FLIGHT')
      .set('Authorization', `Bearer ${token}`);
    expect(flights.status).toBe(200);
    expect(flights.body.total).toBe(1);
  });

  it('forbids ADVISOR from writing the catalog', async () => {
    const { app } = buildTestApp();
    const token = await advisorToken(app);

    const destination = await request(app)
      .post('/api/v1/catalog/destinations')
      .set('Authorization', `Bearer ${token}`)
      .send(NEW_DESTINATION);
    expect(destination.status).toBe(403);
    expect(destination.body.code).toBe('FORBIDDEN');

    const hotel = await request(app)
      .post('/api/v1/catalog/hotels')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(hotel.status).toBe(403);
  });

  it('lets ADMIN create, update and soft-delete a destination', async () => {
    const { app } = buildTestApp();
    const token = await adminToken(app);

    const created = await request(app)
      .post('/api/v1/catalog/destinations')
      .set('Authorization', `Bearer ${token}`)
      .send(NEW_DESTINATION);

    expect(created.status).toBe(201);
    expect(created.body.destination.slug).toBe('bogota');
    expect(created.body.destination.isActive).toBe(true);
    expect(created.body.destination.fromPrice).toBeNull();

    const id = created.body.destination.id as string;

    const updated = await request(app)
      .patch(`/api/v1/catalog/destinations/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Capital de Colombia', isFeatured: false });

    expect(updated.status).toBe(200);
    expect(updated.body.destination.description).toBe('Capital de Colombia');
    expect(updated.body.destination.isFeatured).toBe(false);

    const empty = await request(app)
      .patch(`/api/v1/catalog/destinations/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(empty.status).toBe(422);

    const duplicate = await request(app)
      .patch(`/api/v1/catalog/destinations/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'cartagena' });
    expect(duplicate.status).toBe(409);

    const removed = await request(app)
      .delete(`/api/v1/catalog/destinations/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(204);

    const hidden = await request(app)
      .get(`/api/v1/catalog/destinations/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(hidden.status).toBe(404);
  });

  it('lets ADMIN create and update a hotel', async () => {
    const { app } = buildTestApp();
    const token = await adminToken(app);

    const created = await request(app)
      .post('/api/v1/catalog/hotels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destinationId: DEST_CARTAGENA,
        name: 'Hotel Nuevo',
        category: 4,
        roomType: 'Doble',
        pricePerNight: { amountMinor: 48_000_000, currency: 'COP' },
        amenities: { wifi: true, breakfast: true },
      });

    expect(created.status).toBe(201);
    expect(created.body.hotel.pricePerNight).toEqual({
      amountMinor: 48_000_000,
      currency: 'COP',
    });
    expect(created.body.hotel.amenities).toEqual({ wifi: true, breakfast: true });

    const id = created.body.hotel.id as string;

    const updated = await request(app)
      .patch(`/api/v1/catalog/hotels/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pricePerNight: { amountMinor: 50_000_000, currency: 'COP' } });
    expect(updated.status).toBe(200);
    expect(updated.body.hotel.pricePerNight.amountMinor).toBe(50_000_000);

    const invalidCategory = await request(app)
      .post('/api/v1/catalog/hotels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destinationId: DEST_CARTAGENA,
        name: 'Hotel Inválido',
        category: 6,
        roomType: 'Doble',
        pricePerNight: { amountMinor: 1, currency: 'COP' },
      });
    expect(invalidCategory.status).toBe(422);

    const unknownDestination = await request(app)
      .post('/api/v1/catalog/hotels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destinationId: '00000000-0000-4000-8000-000000000000',
        name: 'Hotel Huérfano',
        category: 3,
        roomType: 'Doble',
        pricePerNight: { amountMinor: 1, currency: 'COP' },
      });
    expect(unknownDestination.status).toBe(404);

    const removed = await request(app)
      .delete(`/api/v1/catalog/hotels/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(204);

    const list = await request(app)
      .get(`/api/v1/catalog/hotels?destinationId=${DEST_CARTAGENA}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.items.some((item: { id: string }) => item.id === id)).toBe(false);
  });

  it('normalizes activity tags and validates transport pricing units', async () => {
    const { app } = buildTestApp();
    const token = await adminToken(app);

    const activity = await request(app)
      .post('/api/v1/catalog/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destinationId: DEST_CARTAGENA,
        name: 'Snorkel en Barú',
        durationMinutes: 120,
        pricePerPerson: { amountMinor: 9_000_000, currency: 'COP' },
        tags: ['Playa', ' playa ', 'Aventura'],
      });

    expect(activity.status).toBe(201);
    expect(activity.body.activity.tags).toEqual(['playa', 'aventura']);
    expect(activity.body.activity.intensity).toBe('LOW');

    const invalidUnit = await request(app)
      .post('/api/v1/catalog/transport')
      .set('Authorization', `Bearer ${token}`)
      .send({
        originDestinationId: DEST_MEDELLIN,
        destinationId: DEST_CARTAGENA,
        mode: 'CAR_RENTAL',
        provider: 'Localiza',
        price: { amountMinor: 18_000_000, currency: 'COP' },
        pricingUnit: 'PER_TRIP',
        durationMinutes: 60,
      });
    expect(invalidUnit.status).toBe(422);
    expect(invalidUnit.body.code).toBe('VALIDATION_ERROR');

    const validRental = await request(app)
      .post('/api/v1/catalog/transport')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destinationId: DEST_CARTAGENA,
        mode: 'CAR_RENTAL',
        provider: 'Localiza',
        price: { amountMinor: 18_000_000, currency: 'COP' },
        pricingUnit: 'PER_DAY',
        durationMinutes: 1440,
      });
    expect(validRental.status).toBe(201);
    expect(validRental.body.transportOption.pricingUnit).toBe('PER_DAY');

    const sameOrigin = await request(app)
      .post('/api/v1/catalog/transport')
      .set('Authorization', `Bearer ${token}`)
      .send({
        originDestinationId: DEST_CARTAGENA,
        destinationId: DEST_CARTAGENA,
        mode: 'FLIGHT',
        provider: 'Avianca',
        price: { amountMinor: 1, currency: 'COP' },
        pricingUnit: 'PER_PERSON',
        durationMinutes: 60,
      });
    expect(sameOrigin.status).toBe(422);
  });

  it('rejects unknown fields in catalog write payloads', async () => {
    const { app } = buildTestApp();
    const token = await adminToken(app);

    const response = await request(app)
      .post('/api/v1/catalog/destinations')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...NEW_DESTINATION, unknown: true });

    expect(response.status).toBe(422);
    expect(response.body.errors.some((error: { field: string }) => error.field === 'unknown')).toBe(
      true,
    );
  });
});
