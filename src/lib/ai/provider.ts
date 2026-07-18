// AI provider abstraction with automatic fallback (US-3.2).
//
//   Local self-hosted LLM (primary)  ──fails──▶  Gemini (fallback)
//
// The "local" provider talks to any OpenAI-compatible endpoint (LM Studio,
// vLLM, Ollama, …) configured via LOCAL_AI_BASE_URL. Gemini stays as a hosted
// fallback for when the self-hosted box is unreachable.
//
// Demo material is only used when AI_DEMO_MODE=true (see src/lib/ai/index.ts).
//
// Each provider's only job is: take a system + user prompt and return a parsed
// JSON *object* (json_object / responseMimeType mode). The caller then validates
// that object against a Zod schema (see index.ts). Anything that goes wrong —
// network error, non-2xx, unparseable body, empty completion — throws an
// AiProviderError so the orchestrator can move on to the next provider.

import {
  AI_REQUEST_TIMEOUT_MS,
  getGeminiConfig,
  getLocalConfig,
} from '@/lib/ai/config';
import type { AiProviderName } from '@/lib/ai/types';

export class AiProviderError extends Error {
  constructor(
    public readonly provider: AiProviderName,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'AiProviderError';
  }
}

export interface JsonPrompt {
  /** High-level instructions ("You are a study assistant…"). */
  system: string;
  /** The task + source text. Must mention "JSON" for json_object mode. */
  user: string;
}

interface AiProvider {
  readonly name: Exclude<AiProviderName, 'demo'>;
  isConfigured(): boolean;
  /** Returns a parsed JSON object, or throws AiProviderError. */
  generateJson(prompt: JsonPrompt): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function fetchJson(
  provider: AiProviderName,
  url: string,
  init: RequestInit
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AiProviderError(
        provider,
        `HTTP ${res.status}${body ? `: ${body.slice(0, 300)}` : ''}`
      );
    }
    return await res.json();
  } catch (err) {
    if (err instanceof AiProviderError) throw err;
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? `timed out after ${AI_REQUEST_TIMEOUT_MS}ms`
        : 'request failed';
    throw new AiProviderError(provider, reason, err);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Models occasionally wrap JSON in ```json fences or add stray prose even in
 * JSON mode. Strip fences and parse; throw if there's still nothing usable.
 */
function parseJsonObject(provider: AiProviderName, raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  if (!cleaned) {
    throw new AiProviderError(provider, 'empty completion');
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new AiProviderError(provider, 'model did not return valid JSON', err);
  }
}

// ---------------------------------------------------------------------------
// Gemini (Google Generative Language API, REST)
// ---------------------------------------------------------------------------

const geminiProvider: AiProvider = {
  name: 'gemini',
  isConfigured: () => getGeminiConfig() !== null,
  async generateJson({ system, user }) {
    const config = getGeminiConfig();
    if (!config) throw new AiProviderError('gemini', 'no API key configured');

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(config.model)}:generateContent`;

    const data = (await fetchJson('gemini', url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      }),
    })) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      throw new AiProviderError(
        'gemini',
        `blocked: ${data.promptFeedback.blockReason}`
      );
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('');
    if (!text)
      throw new AiProviderError('gemini', 'no candidate text returned');

    return parseJsonObject('gemini', text);
  },
};

// ---------------------------------------------------------------------------
// Local self-hosted LLM (OpenAI-compatible chat completions)
// ---------------------------------------------------------------------------
//
// Talks to LOCAL_AI_BASE_URL (e.g. an LM Studio / vLLM / Ollama server). We do
// NOT send `response_format: json_object`: many local servers reject it (LM
// Studio only accepts `json_schema`/`text`). The prompt already demands JSON,
// reasoning models keep their chain-of-thought in a separate `reasoning_content`
// field, and parseJsonObject strips any stray fences — so `content` is clean.

const localProvider: AiProvider = {
  name: 'local',
  isConfigured: () => getLocalConfig() !== null,
  async generateJson({ system, user }) {
    const config = getLocalConfig();
    if (!config) throw new AiProviderError('local', 'not configured');

    const data = (await fetchJson(
      'local',
      `${config.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.4,
        }),
      }
    )) as { choices?: { message?: { content?: string } }[] };

    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new AiProviderError('local', 'no completion returned');

    return parseJsonObject('local', text);
  },
};

// ---------------------------------------------------------------------------
// Fallback orchestration
// ---------------------------------------------------------------------------

/** Primary first, then fallback: self-hosted LLM, then hosted Gemini. */
const PROVIDER_CHAIN: AiProvider[] = [localProvider, geminiProvider];

export interface ProviderRun {
  provider: AiProviderName;
  value: unknown;
}

/**
 * Runs the prompt through the provider chain, returning the first provider's
 * result (with its name). `validate` lets the caller reject a structurally-bad
 * response so we fall over to the next provider instead of surfacing garbage —
 * a malformed-but-parseable JSON body is treated as a provider failure.
 *
 * Throws AiProviderError only if EVERY configured provider fails.
 */
export async function runWithFallback(
  prompt: JsonPrompt,
  validate: (value: unknown) => boolean
): Promise<ProviderRun> {
  const configured = PROVIDER_CHAIN.filter((p) => p.isConfigured());
  if (configured.length === 0) {
    throw new AiProviderError(
      'local',
      'AI generation is not configured. Set LOCAL_AI_BASE_URL (or GEMINI_API_KEY) on the server.'
    );
  }

  console.info('[ai] provider chain', {
    providers: configured.map((p) => p.name),
  });

  const errors: string[] = [];
  for (const provider of configured) {
    try {
      console.info('[ai] trying provider', { provider: provider.name });
      const value = await provider.generateJson(prompt);
      if (!validate(value)) {
        throw new AiProviderError(
          provider.name,
          'response failed schema validation'
        );
      }
      console.info('[ai] selected provider', { provider: provider.name });
      return { provider: provider.name, value };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[ai] provider failed', {
        provider: provider.name,
        error: message.slice(0, 200),
      });
      errors.push(message);
    }
  }

  throw new AiProviderError(
    'local',
    `all providers failed — ${errors.join(' | ')}`
  );
}

/** True when at least one real provider has an API key. */
export function hasConfiguredProvider(): boolean {
  return PROVIDER_CHAIN.some((p) => p.isConfigured());
}
