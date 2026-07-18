// Server-side AI configuration, read from environment (US-3.2).
//
// All of these are SERVER-ONLY — keys must never be exposed to the client.
// Read lazily (per call) via bracket access so Docker/runtime env values are
// picked up even when the image was built without these secrets present.

const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

/** Runtime env read — avoids build-time inlining quirks with process.env.NAME. */
function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Self-hosted, OpenAI-compatible endpoint (LM Studio, vLLM, Ollama, …). */
export interface LocalConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

/**
 * Returns the self-hosted OpenAI-compatible config only when a base URL is set.
 * The trailing `/chat/completions` is appended by the provider, so LOCAL_AI_BASE_URL
 * should point at the API root (e.g. "http://host:1500/v1"). A trailing slash is
 * tolerated. Many local servers ignore the key, but we still send whatever is set.
 */
export function getLocalConfig(): LocalConfig | null {
  const baseUrl = readEnv('LOCAL_AI_BASE_URL');
  const model = readEnv('LOCAL_AI_MODEL');
  if (!baseUrl || !model) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey: readEnv('LOCAL_AI_API_KEY') || 'not-needed',
    model,
  };
}

/** Returns Gemini config only when an API key is actually present. */
export function getGeminiConfig(): GeminiConfig | null {
  const apiKey = readEnv('GEMINI_API_KEY');
  if (!apiKey) return null;
  return {
    apiKey,
    model: readEnv('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL,
  };
}

/**
 * Demo mode returns canned material instead of calling any provider.
 * Strict: only the exact string "true" enables demo (per product requirement).
 */
export function isDemoModeForced(): boolean {
  return process.env['AI_DEMO_MODE'] === 'true';
}

/** Safe status for logs / errors — never includes secret values. */
export function getAiRuntimeStatus(): {
  demoMode: boolean;
  localConfigured: boolean;
  geminiConfigured: boolean;
  localModel: string | null;
  geminiModel: string;
} {
  const local = getLocalConfig();
  const gemini = getGeminiConfig();
  return {
    demoMode: isDemoModeForced(),
    localConfigured: local !== null,
    geminiConfigured: gemini !== null,
    localModel: local?.model ?? null,
    geminiModel: gemini?.model || DEFAULT_GEMINI_MODEL,
  };
}

/**
 * How long to wait on a single provider before giving up and falling over.
 * Overridable via AI_REQUEST_TIMEOUT_MS — a self-hosted reasoning model can
 * spend far longer than a hosted API, so the default is generous.
 */
export const AI_REQUEST_TIMEOUT_MS = (() => {
  const raw = Number(readEnv('AI_REQUEST_TIMEOUT_MS'));
  return Number.isFinite(raw) && raw > 0 ? raw : 120_000;
})();

/** User-facing message when no provider is configured (and demo is off). */
export const AI_NOT_CONFIGURED_MESSAGE =
  'AI generation is not configured. Set LOCAL_AI_BASE_URL (or GEMINI_API_KEY) on the server.';
