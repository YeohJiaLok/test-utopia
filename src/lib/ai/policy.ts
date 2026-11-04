/**
 * Acceptable-use policy for the Ops Copilot, enforced before any model call.
 *
 * Three layers keep the assistant on business:
 *  1. screenQuestion() (here): deterministic checks that block prompt injection, requests to
 *     change data, and requests for credentials or secrets. Blocked questions never reach
 *     the model and are logged to ai_runs with status "blocked".
 *  2. A per-user rate limit (see the chat route).
 *  3. The model itself: off-topic questions make it call decline_request, logged as "refused".
 * Pure functions so they are unit-tested (policy.test.ts).
 */

export type PolicyCategory =
  | "prompt_injection"
  | "write_action"
  | "secrets"
  | "rate_limit"
  | "too_long"
  | "off_topic"
  | "personal_data"
  | "other";

export const POLICY_LABEL: Record<PolicyCategory, string> = {
  prompt_injection: "Instruction override attempt",
  write_action: "Read-only assistant",
  secrets: "Credentials and secrets",
  rate_limit: "Usage limit",
  too_long: "Message too long",
  off_topic: "Outside operations scope",
  personal_data: "Personal data",
  other: "Outside policy",
};

/** What the assistant may be asked about (shown in the chat window). */
export const POLICY_SCOPE =
  "Jobs, technicians, schedules, workload, revenue and AI supervisor flags at Sejuk Sejuk Service. Read-only; every question is logged.";

export const RATE_LIMIT = { max: 20, windowMinutes: 10 } as const;

export type ScreenResult = { allowed: true } | { allowed: false; category: PolicyCategory; message: string };

const SCOPE_HINT = "I can help with jobs, technicians, schedules, workload, revenue and supervisor flags.";

const RULES: { category: PolicyCategory; pattern: RegExp; message: string }[] = [
  {
    category: "prompt_injection",
    pattern:
      /\b(ignore|disregard|forget|override|bypass)\b[^.?!]{0,40}\b(instructions?|rules?|prompt|guidelines?|policy|policies|restrictions?)\b|\b(system|developer|hidden|initial)\s+(prompt|message|instructions?)\b|\b(reveal|show|print|repeat|output|tell me)\b[^.?!]{0,30}\b(your|the)\s+(prompt|instructions|rules|configuration)\b|\b(jailbreak|dan mode|developer mode|god mode)\b|\b(pretend|roleplay|role-play)\b[^.?!]{0,30}\b(you are|to be|as)\b|\byou are (now|no longer)\b/i,
    message: `I can't change how I work or share my configuration. ${SCOPE_HINT}`,
  },
  {
    category: "secrets",
    pattern: /\b(passwords?|passcodes?|api[\s_-]?keys?|secret keys?|service[\s_-]?role|access tokens?|private keys?|credentials?|2fa codes?|otp codes?)\b/i,
    message: `I can't help with passwords, keys or other credentials. ${SCOPE_HINT}`,
  },
  {
    // Imperatives at the start of the question: "delete order…", "please assign…".
    // Questions *about* such events ("how many orders were cancelled?") are fine.
    category: "write_action",
    pattern:
      /^\s*(please\s+|can you\s+|could you\s+|kindly\s+)?(delete|remove|drop|truncate|update|edit|change|modify|set|assign|reassign|approve|reject|close|cancel|create|insert|add|reschedule|send|email|message|whatsapp|refund|mark)\b/i,
    message:
      "I'm read-only, so I can't change orders, assignments or any other data. Use the order pages for actions; I can tell you what needs attention.",
  },
];

/** Deterministic policy screen for one user question. */
export function screenQuestion(question: string, maxChars: number): ScreenResult {
  const q = question.trim();
  if (q.length > maxChars) {
    return { allowed: false, category: "too_long", message: `Please keep questions under ${maxChars} characters.` };
  }
  for (const rule of RULES) {
    if (rule.pattern.test(q)) return { allowed: false, category: rule.category, message: rule.message };
  }
  return { allowed: true };
}
