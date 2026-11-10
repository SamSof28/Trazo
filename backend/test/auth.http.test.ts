import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, loginAs } from './test-app.js';

describe('HTTP auth', () => {
  it('serves health checks', async () => {
    const { app } = buildTestApp();
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });

    const ready = await request(app).get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: 'ready' });
  });

  it('returns problem+json for unknown routes', async () => {
    const { app } = buildTestApp();
    const response = await request(app).get('/api/v1/nope');
    expect(response.status).toBe(404);
    expect(response.type).toBe('application/problem+json');
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('logs in and sets an HttpOnly refresh cookie without exposing the password hash', async () => {
    const { app } = buildTestApp();
    const response = await request(app).post('/api/v1/auth/login').send({
      email: '  ASESOR@TRAZO.CO ',
      password: 'secret-password',
    });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTypeOf('string');
    expect(response.body.expiresIn).toBe(900);
    expect(response.body.user.email).toBe('asesor@trazo.co');
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const cookies = response.headers['set-cookie'];
    const cookie = Array.isArray(cookies) ? cookies[0] : cookies;
    expect(cookie).toContain('refresh_token=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('registers a public advisor, persists the profile and starts a session', async () => {
    const { app } = buildTestApp();

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'María Gómez',
      agency: 'Viajes del Valle',
      email: '  MARIA@AGENCIA.CO ',
      password: 'password-larga-123',
      acceptTerms: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toBeTypeOf('string');
    expect(response.body.expiresIn).toBe(900);
    expect(response.body.user).toMatchObject({
      name: 'María Gómez',
      email: 'maria@agencia.co',
      agency: 'Viajes del Valle',
      role: 'ADVISOR',
      isActive: true,
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const cookies = response.headers['set-cookie'];
    const cookie = Array.isArray(cookies) ? cookies[0] : cookies;
    expect(cookie).toContain('refresh_token=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${response.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('maria@agencia.co');

    const admin = await loginAs(app, 'admin@trazo.co');
    const users = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(users.status).toBe(200);
    expect(
      users.body.users.find((user: { email: string }) => user.email === 'maria@agencia.co'),
    ).toMatchObject({ agency: 'Viajes del Valle', role: 'ADVISOR' });
  });

  it('rejects a duplicate registration email with 409', async () => {
    const { app } = buildTestApp();
    const payload = {
      name: 'María Gómez',
      email: 'maria@agencia.co',
      password: 'password-larga-123',
      acceptTerms: true,
    };

    const first = await request(app).post('/api/v1/auth/register').send(payload);
    expect(first.status).toBe(201);

    const duplicate = await request(app).post('/api/v1/auth/register').send(payload);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('CONFLICT');
  });

  it('rejects invalid registration payloads and role escalation', async () => {
    const { app } = buildTestApp();
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'A',
      email: 'not-an-email',
      password: 'short',
      acceptTerms: false,
      role: 'ADMIN',
    });

    expect(response.status).toBe(422);
    expect(response.type).toBe('application/problem+json');
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('returns 422 with field errors for an invalid payload', async () => {
    const { app } = buildTestApp();
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(response.status).toBe(422);
    expect(response.type).toBe('application/problem+json');
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it('rejects /auth/me without a token and accepts a valid one', async () => {
    const { app } = buildTestApp();

    const anonymous = await request(app).get('/api/v1/auth/me');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.code).toBe('UNAUTHENTICATED');

    const { accessToken } = await loginAs(app, 'asesor@trazo.co');
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('asesor@trazo.co');
    expect(me.body.user.role).toBe('ADVISOR');
  });

  it('rotates the refresh cookie and rejects a missing refresh token', async () => {
    const { app } = buildTestApp();
    const { cookie } = await loginAs(app, 'asesor@trazo.co');

    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTypeOf('string');
    expect(refreshed.headers['set-cookie']).toBeDefined();

    const missing = await request(app).post('/api/v1/auth/refresh');
    expect(missing.status).toBe(401);
    expect(missing.body.code).toBe('UNAUTHENTICATED');
  });

  it('logs out idempotently', async () => {
    const { app } = buildTestApp();
    const { cookie } = await loginAs(app, 'asesor@trazo.co');

    const response = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(response.status).toBe(204);
  });

  it('forbids ADVISOR from creating users and allows ADMIN', async () => {
    const { app } = buildTestApp();
    const advisor = await loginAs(app, 'asesor@trazo.co');
    const admin = await loginAs(app, 'admin@trazo.co');

    const forbidden = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${advisor.accessToken}`)
      .send({
        name: 'Nuevo Asesor',
        email: 'nuevo@trazo.co',
        password: 'password-larga-123',
        role: 'ADVISOR',
      });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');

    const created = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        name: 'Nuevo Asesor',
        email: 'nuevo@trazo.co',
        password: 'password-larga-123',
        role: 'ADVISOR',
      });

    expect(created.status).toBe(201);
    expect(created.body.user.email).toBe('nuevo@trazo.co');
    expect(created.body.user).not.toHaveProperty('passwordHash');
  });

  it('lists users for ADMIN and hides password hashes', async () => {
    const { app } = buildTestApp();
    const advisor = await loginAs(app, 'asesor@trazo.co');
    const admin = await loginAs(app, 'admin@trazo.co');

    const forbidden = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${advisor.accessToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');

    const response = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(3);
    expect(response.body.users.map((user: { email: string }) => user.email)).toEqual([
      'asesor@trazo.co',
      'otro@trazo.co',
      'admin@trazo.co',
    ]);
    for (const user of response.body.users) {
      expect(user).not.toHaveProperty('passwordHash');
    }
  });
});
