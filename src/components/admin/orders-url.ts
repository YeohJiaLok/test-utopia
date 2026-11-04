import { ALL_STATUSES } from "@/lib/workflow";
import type { OrderStatus } from "@/lib/types";

/** URL-backed filter state for /admin/orders (server-rendered, shareable links). */
export interface OrderFilters {
  status: OrderStatus | "all";
  q: string;
  tech: string;
  branch: string;
  page: number;
  view: "list" | "board";
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseOrderFilters(sp: SearchParams): OrderFilters {
  const status = first(sp.status);
  const tech = first(sp.tech);
  const branch = first(sp.branch);
  const page = Number.parseInt(first(sp.page), 10);
  return {
    status: (ALL_STATUSES as string[]).includes(status) ? (status as OrderStatus) : "all",
    q: first(sp.q).trim().slice(0, 80),
    tech: tech === "none" || /^[0-9a-f-]{36}$/i.test(tech) ? tech : "",
    branch: /^\d+$/.test(branch) ? branch : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    view: first(sp.view) === "board" ? "board" : "list",
  };
}

/** Builds /admin/orders?… from the current filters plus a patch; resets paging unless set. */
export function ordersHref(current: OrderFilters, patch: Partial<OrderFilters> = {}) {
  const next: OrderFilters = { ...current, page: 1, ...patch };
  const params = new URLSearchParams();
  if (next.view === "board") params.set("view", "board");
  if (next.status !== "all" && next.view !== "board") params.set("status", next.status);
  if (next.q) params.set("q", next.q);
  if (next.tech) params.set("tech", next.tech);
  if (next.branch) params.set("branch", next.branch);
  if (next.page > 1 && next.view !== "board") params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}
