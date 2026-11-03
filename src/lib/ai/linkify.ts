import type { CopilotRecord } from "@/lib/ai/types";

/** Order numbers look like SJK-2611-01001. */
export const ORDER_NO_PATTERN = /\b[A-Z]{2,5}-\d{4}-\d{4,6}\b/g;

/**
 * Turn order numbers in a markdown answer into links for records the agent actually
 * retrieved. Skips text already inside a link (`[…](…)`) and inline code spans.
 */
export function linkifyOrders(markdown: string, records: CopilotRecord[], href: (orderId: string) => string): string {
  if (!records.length) return markdown;
  const byNo = new Map(records.map((r) => [r.orderNo.toUpperCase(), r]));
  // Split on inline code and existing links so we never rewrite inside them.
  const parts = markdown.split(/(`[^`]*`|\[[^\]]*\]\([^)]*\))/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(ORDER_NO_PATTERN, (match) => {
        const rec = byNo.get(match.toUpperCase());
        return rec ? `[${match}](${href(rec.orderId)})` : match;
      });
    })
    .join("");
}

/** Order numbers mentioned anywhere in a text, upper-cased and de-duplicated. */
export function mentionedOrderNumbers(text: string): Set<string> {
  return new Set(Array.from(text.matchAll(ORDER_NO_PATTERN), (m) => m[0].toUpperCase()));
}
