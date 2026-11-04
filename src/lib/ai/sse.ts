/**
 * Server-Sent Events framing for the Ops Copilot stream. Pure and isomorphic: the
 * route handler encodes with `encodeSse`, the browser decodes with `createSseParser`.
 */
import type { CopilotEvent } from "@/lib/ai/contracts";

const EVENT_TYPES = new Set<CopilotEvent["type"]>(["run", "status", "tool_call", "tool_result", "text", "records", "done", "error", "policy", "chart"]);

export function encodeSse(event: CopilotEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** SSE comment line — keeps proxies from closing an idle connection. */
export const SSE_HEARTBEAT = ": ping\n\n";

/** Parse one SSE `data` payload into a CopilotEvent; returns null for anything unrecognised. */
export function parseCopilotEvent(raw: string): CopilotEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const type = (value as { type?: unknown }).type;
  if (typeof type !== "string" || !EVENT_TYPES.has(type as CopilotEvent["type"])) return null;
  return value as CopilotEvent;
}

/**
 * Incremental SSE decoder. Feed it arbitrary text chunks (events may be split across
 * chunks); it calls `onEvent` once per complete event. Handles CRLF, multi-line data
 * and comment lines.
 */
export function createSseParser(onEvent: (event: CopilotEvent) => void) {
  let buffer = "";

  function dispatch(block: string) {
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      if (line.startsWith("data:")) data.push(line.slice(line.startsWith("data: ") ? 6 : 5));
    }
    if (!data.length) return;
    const event = parseCopilotEvent(data.join("\n"));
    if (event) onEvent(event);
  }

  return {
    push(chunk: string) {
      let text = buffer + chunk;
      // A lone trailing CR may be the first half of a CRLF split across chunks.
      let carry = "";
      if (text.endsWith("\r")) {
        carry = "\r";
        text = text.slice(0, -1);
      }
      text = text.replace(/\r\n?/g, "\n");
      let idx = text.indexOf("\n\n");
      while (idx !== -1) {
        dispatch(text.slice(0, idx));
        text = text.slice(idx + 2);
        idx = text.indexOf("\n\n");
      }
      buffer = text + carry;
    },
    /** Dispatch whatever remains when the stream ends without a trailing blank line. */
    flush() {
      if (buffer.trim()) dispatch(buffer.replace(/\r\n?/g, "\n"));
      buffer = "";
    },
  };
}
