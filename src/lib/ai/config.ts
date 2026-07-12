// Server-side AI configuration, read from environment (US-3.2).
//
// All of these are SERVER-ONLY — keys must never be exposed to the client.
// Read lazily (per call) via bracket access so Docker/runtime env values are
// picked up even when the image was built without these secrets present.

const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

/** Runtime env read — avoids build-time inlining quirks with process.env.NAME. */
function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export interface DeepSeekConfig {
  apiKey: string;
  model: string;
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

/** Returns DeepSeek config only when an API key is actually present. */
export function getDeepSeekConfig(): DeepSeekConfig | null {
  const apiKey = readEnv('DEEPSEEK_API_KEY');
  if (!apiKey) return null;
  return {
    apiKey,
    model: readEnv('DEEPSEEK_MODEL') || DEFAULT_DEEPSEEK_MODEL,
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
  geminiConfigured: boolean;
  deepseekConfigured: boolean;
  geminiModel: string;
} {
  const gemini = getGeminiConfig();
  const deepseek = getDeepSeekConfig();
  return {
    demoMode: isDemoModeForced(),
    geminiConfigured: gemini !== null,
    deepseekConfigured: deepseek !== null,
    geminiModel: gemini?.model || DEFAULT_GEMINI_MODEL,
  };
}

/** How long to wait on a single provider before giving up and falling over. */
export const AI_REQUEST_TIMEOUT_MS = 30_000;

/** User-facing message when no provider key is available (and demo is off). */
export const AI_NOT_CONFIGURED_MESSAGE =
  'AI generation is not configured. Set GEMINI_API_KEY on the server.';
