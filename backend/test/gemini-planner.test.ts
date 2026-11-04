import { describe, expect, it, vi } from 'vitest';
import { GeminiPlanner } from '../src/infrastructure/ai/gemini-planner.js';
import { AiInvalidOutputError, AiUnavailableError } from '../src/domain/shared/app-error.js';
import type { AiPlannerInput } from '../src/domain/ai/ports.js';

const input: AiPlannerInput = {
  system: 'system prompt',
  user: 'user prompt',
  timeoutMs: 1_000,
  context: {
    destination: { id: 'dest-1', city: 'Cartagena', country: 'Colombia' },
    tripRequest: {
      destinationId: 'dest-1',
      startDate: '2026-12-10',
      durationDays: 3,
      adults: 2,
      children: 0,
      travelerType: 'COUPLE',
      interests: ['playa'],
      budgetMinMinor: null,
      budgetMaxMinor: 300_000_000,
      currency: 'COP',
    },
    shortlist: [],
  },
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function errorResponse(status: number): Response {
  return { ok: false, status } as Response;
}

function planner(fetchImpl: typeof fetch, overrides: Partial<{ maxRetries: number; retryDelayMs: number; timeoutMs: number }> = {}) {
  return new GeminiPlanner({
    apiKey: 'test-key',
    model: 'gemini-2.5-flash',
    timeoutMs: overrides.timeoutMs ?? 1_000,
    fetchImpl,
    retryDelayMs: overrides.retryDelayMs ?? 0,
    maxRetries: overrides.maxRetries ?? 1,
  });
}

describe('GeminiPlanner', () => {
  it('sends the prompt and parses the JSON response', async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL, _init?: RequestInit) =>
        jsonResponse({
          candidates: [{ content: { parts: [{ text: '{"title":"Plan","days":[]}' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
          modelVersion: 'gemini-2.5-flash-001',
        }),
    );

    const result = await planner(fetchImpl as unknown as typeof fetch).generateJson(input);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain('/v1beta/models/gemini-2.5-flash:generateContent');
    expect(String(url)).toContain('key=test-key');
    const body = JSON.parse(String(init?.body)) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ parts: Array<{ text: string }> }>;
      generationConfig: { responseMimeType: string };
    };
    expect(body.systemInstruction.parts[0]!.text).toBe('system prompt');
    expect(body.contents[0]!.parts[0]!.text).toBe('user prompt');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(result.json).toEqual({ title: 'Plan', days: [] });
    expect(result.model).toBe('gemini-2.5-flash-001');
    expect(result.tokensIn).toBe(10);
    expect(result.tokensOut).toBe(20);
  });

  it('retries 429 once and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: '{"title":"Plan","days":[]}' }] } }],
        }),
      );

    const result = await planner(fetchImpl as unknown as typeof fetch).generateJson(input);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.json).toEqual({ title: 'Plan', days: [] });
  });

  it('does not retry a 401', async () => {
    const fetchImpl = vi.fn(async () => errorResponse(401));
    await expect(
      planner(fetchImpl as unknown as typeof fetch).generateJson(input),
    ).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails with AI_INVALID_OUTPUT when the model returns invalid JSON', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'not json' }] } }],
      }),
    );
    await expect(
      planner(fetchImpl as unknown as typeof fetch).generateJson(input),
    ).rejects.toBeInstanceOf(AiInvalidOutputError);
  });

  it('fails with AI_UNAVAILABLE on timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );

    await expect(
      planner(fetchImpl as unknown as typeof fetch, {
        timeoutMs: 10,
        maxRetries: 0,
      }).generateJson(input),
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
