// Server-side AI configuration, read from environment (US-3.2).
//
// All of these are SERVER-ONLY — keys must never be exposed to the client.
// Read lazily (per call) rather than at module load so a key added to .env is
// picked up on the next request without a full restart, matching how the rest
// of the app reads process.env (see src/lib/email.ts).

const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

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
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
  };
}

/** Returns DeepSeek config only when an API key is actually present. */
export function getDeepSeekConfig(): DeepSeekConfig | null {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL,
  };
}

/**
 * Demo mode returns canned material instead of calling any provider.
 * Only ON when AI_DEMO_MODE=true — without that flag, generation requires a
 * configured GEMINI_API_KEY or DEEPSEEK_API_KEY.
 */
export function isDemoModeForced(): boolean {
  return process.env.AI_DEMO_MODE?.trim().toLowerCase() === 'true';
}

/** How long to wait on a single provider before giving up and falling over. */
export const AI_REQUEST_TIMEOUT_MS = 30_000;
