import type {
  AiPlannerInput,
  AiPlannerPort,
  AiPlannerResult,
} from '../../domain/ai/ports.js';
import { AiInvalidOutputError, AiUnavailableError } from '../../domain/shared/app-error.js';

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
}

export interface GeminiPlannerOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  retryDelayMs?: number;
  maxRetries?: number;
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    days: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          dayNumber: { type: 'INTEGER' },
          title: { type: 'STRING' },
          notes: { type: 'STRING' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                type: {
                  type: 'STRING',
                  enum: ['ACCOMMODATION', 'ACTIVITY', 'TRANSPORT'],
                },
                catalogItemId: { type: 'STRING' },
                startTime: { type: 'STRING' },
                endTime: { type: 'STRING' },
                notes: { type: 'STRING' },
              },
              required: ['type', 'catalogItemId'],
            },
          },
        },
        required: ['dayNumber', 'items'],
      },
    },
  },
  required: ['title', 'days'],
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function textFrom(response: GeminiResponse): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? '').join('').trim();
}

/** Gemini REST adapter. The API key never leaves the backend. */
export class GeminiPlanner implements AiPlannerPort {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly retryDelayMs: number;
  private readonly maxRetries: number;

  constructor(private readonly options: GeminiPlannerOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://generativelanguage.googleapis.com';
    this.retryDelayMs = options.retryDelayMs ?? 250;
    this.maxRetries = options.maxRetries ?? 1;
  }

  async generateJson(input: AiPlannerInput): Promise<AiPlannerResult> {
    const startedAt = Date.now();
    let lastError: AiUnavailableError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (attempt > 0 && this.retryDelayMs > 0) {
        await sleep(this.retryDelayMs);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        const response = await this.fetchImpl(
          `${this.baseUrl}/v1beta/models/${encodeURIComponent(this.options.model)}:generateContent?key=${encodeURIComponent(this.options.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: input.system }] },
              contents: [{ role: 'user', parts: [{ text: input.user }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: RESPONSE_SCHEMA,
                temperature: 0.4,
                maxOutputTokens: 8192,
              },
            }),
          },
        );

        if (!response.ok) {
          const status = response.status;
          lastError = new AiUnavailableError(`Gemini respondió ${status}`);
          // Only quota and transient server errors are retried; 401/403 fail immediately.
          if ((status === 429 || status >= 500) && attempt < this.maxRetries) {
            continue;
          }
          throw lastError;
        }

        const body = (await response.json()) as GeminiResponse;
        const text = textFrom(body);
        if (!text) {
          throw new AiInvalidOutputError('Gemini devolvió una respuesta vacía');
        }

        let json: unknown;
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          throw new AiInvalidOutputError('Gemini no devolvió JSON válido');
        }

        return {
          json,
          model: body.modelVersion ?? this.options.model,
          latencyMs: Date.now() - startedAt,
          tokensIn: body.usageMetadata?.promptTokenCount,
          tokensOut: body.usageMetadata?.candidatesTokenCount,
        };
      } catch (error) {
        if (error instanceof AiInvalidOutputError) throw error;
        // Provider/network/timeout failures are not retried here: only 429/5xx use `continue`.
        if (error instanceof AiUnavailableError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new AiUnavailableError('Gemini excedió el tiempo de espera');
        }
        throw new AiUnavailableError('No fue posible contactar a Gemini');
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new AiUnavailableError();
  }
}
