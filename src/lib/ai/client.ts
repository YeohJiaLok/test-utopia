import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

export const AI_NOT_CONFIGURED =
  "AI is not configured on this server. Add ANTHROPIC_API_KEY to the environment to enable the Ops Copilot and AI features.";

let cached: { key: string; client: Anthropic } | null = null;

/** Shared Anthropic client, or null when no API key is configured (degraded mode). */
export function getAnthropic(): Anthropic | null {
  const key = serverEnv.anthropicApiKey();
  if (!key) return null;
  if (cached?.key !== key) {
    cached = { key, client: new Anthropic({ apiKey: key, timeout: 90_000, maxRetries: 2 }) };
  }
  return cached.client;
}

export function aiModel(): string {
  return serverEnv.anthropicModel();
}

export function isAbortError(err: unknown): boolean {
  return (
    err instanceof Anthropic.APIUserAbortError ||
    (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"))
  );
}

/** Map SDK / runtime errors to a safe, user-facing message (never leaks internals). */
export function describeAiError(err: unknown): string {
  if (err instanceof Anthropic.APIUserAbortError) return "The request was cancelled.";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "The AI service took too long to respond. Please try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the AI service. Check the network and try again.";
  if (err instanceof Anthropic.AuthenticationError) return "The AI service rejected the API key. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key is not permitted to use the configured model.";
  if (err instanceof Anthropic.RateLimitError) return "The AI service is rate-limited right now. Please retry in a moment.";
  if (err instanceof Anthropic.BadRequestError) return "The AI service rejected the request. Try rephrasing or shortening it.";
  if (err instanceof Anthropic.InternalServerError) return "The AI service is temporarily unavailable. Please try again shortly.";
  if (err instanceof Anthropic.APIError) return `The AI service returned an error (${err.status ?? "unknown"}).`;
  if (err instanceof Error && err.name === "TimeoutError") return "The request timed out. Try a narrower question.";
  return "Something went wrong while running the AI request.";
}

/** Technical error detail for the governance log (not shown to users). */
export function errorDetail(err: unknown): string {
  if (err instanceof Anthropic.APIError) return `${err.constructor.name} ${err.status ?? ""}: ${err.message}`.slice(0, 1000);
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 1000);
  return String(err).slice(0, 1000);
}

/** Sum token usage across agent iterations. */
export function addUsage(
  total: { input_tokens: number; output_tokens: number },
  usage: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | null | undefined,
) {
  if (!usage) return total;
  total.input_tokens += (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  total.output_tokens += usage.output_tokens ?? 0;
  return total;
}
