import { describe, expect, it } from "vitest";
import type { CopilotEvent } from "./contracts";
import { createSseParser, encodeSse, parseCopilotEvent, SSE_HEARTBEAT } from "./sse";

function collect() {
  const events: CopilotEvent[] = [];
  const parser = createSseParser((e) => events.push(e));
  return { events, parser };
}

describe("SSE framing", () => {
  it("round-trips events through encode + parse", () => {
    const sent: CopilotEvent[] = [
      { type: "run", runId: "r1" },
      { type: "tool_call", id: "t1", name: "count_jobs", input: { group_by: "technician" } },
      { type: "text", delta: "Line one\n\nLine two" },
      { type: "done", usage: { input_tokens: 10, output_tokens: 5 }, latencyMs: 1200 },
    ];
    const { events, parser } = collect();
    parser.push(sent.map(encodeSse).join(""));
    expect(events).toEqual(sent);
  });

  it("handles events split across arbitrary chunk boundaries", () => {
    const wire = encodeSse({ type: "status", label: "Planning" }) + encodeSse({ type: "text", delta: "héllo 🌬️" });
    const { events, parser } = collect();
    for (const ch of wire) parser.push(ch);
    expect(events).toEqual([
      { type: "status", label: "Planning" },
      { type: "text", delta: "héllo 🌬️" },
    ]);
  });

  it("ignores heartbeats, comments and unknown events", () => {
    const { events, parser } = collect();
    parser.push(SSE_HEARTBEAT);
    parser.push('data: {"type":"nope"}\n\n');
    parser.push("data: not json\n\n");
    parser.push(encodeSse({ type: "status", label: "ok" }));
    expect(events).toEqual([{ type: "status", label: "ok" }]);
  });

  it("supports CRLF line endings, including a CRLF split across chunks", () => {
    const { events, parser } = collect();
    parser.push('data: {"type":"run","runId":"a"}\r');
    parser.push("\n\r\n");
    expect(events).toEqual([{ type: "run", runId: "a" }]);
  });

  it("flushes a trailing event without a blank line", () => {
    const { events, parser } = collect();
    parser.push('data: {"type":"error","message":"x"}');
    expect(events).toHaveLength(0);
    parser.flush();
    expect(events).toEqual([{ type: "error", message: "x" }]);
  });

  it("parseCopilotEvent rejects non-objects", () => {
    expect(parseCopilotEvent("42")).toBeNull();
    expect(parseCopilotEvent("null")).toBeNull();
  });
});
