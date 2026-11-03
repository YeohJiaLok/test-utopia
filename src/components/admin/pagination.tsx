import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ordersHref, type OrderFilters } from "./orders-url";

function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function OrdersPagination({ filters, total, pageSize }: { filters: OrderFilters; total: number; pageSize: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(filters.page, pages);
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  const navBtn = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 min-w-11 sm:h-8 sm:min-w-0");

  return (
    <div className="flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
      <p className="text-muted-foreground text-xs tabular">
        Showing <span className="text-foreground font-medium">{start.toLocaleString("en-MY")}</span>–
        <span className="text-foreground font-medium">{end.toLocaleString("en-MY")}</span> of{" "}
        <span className="text-foreground font-medium">{total.toLocaleString("en-MY")}</span> orders
      </p>
      {pages > 1 && (
        <nav className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start" aria-label="Pagination">
          {page > 1 ? (
            <Link href={ordersHref(filters, { page: page - 1 })} className={navBtn} aria-label="Previous page" scroll={false}>
              <ChevronLeft /> <span className="hidden sm:inline">Prev</span>
            </Link>
          ) : (
            <span className={cn(navBtn, "pointer-events-none opacity-50")} aria-hidden>
              <ChevronLeft /> <span className="hidden sm:inline">Prev</span>
            </span>
          )}
          <span className="text-sm font-medium tabular sm:hidden">
            Page {page} <span className="text-muted-foreground font-normal">of {pages}</span>
          </span>
          {pageWindow(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="text-muted-foreground hidden px-1 text-xs sm:inline">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={ordersHref(filters, { page: p })}
                scroll={false}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  buttonVariants({ variant: p === page ? "default" : "ghost", size: "sm" }),
                  "h-8 min-w-8 tabular",
                  p !== page && "hidden sm:inline-flex",
                )}
              >
                {p}
              </Link>
            ),
          )}
          {page < pages ? (
            <Link href={ordersHref(filters, { page: page + 1 })} className={navBtn} aria-label="Next page" scroll={false}>
              <span className="hidden sm:inline">Next</span> <ChevronRight />
            </Link>
          ) : (
            <span className={cn(navBtn, "pointer-events-none opacity-50")} aria-hidden>
              <span className="hidden sm:inline">Next</span> <ChevronRight />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
