"use client";

import { useId } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/shared/form-field";
import { PAGE_SIZES, auditHref, type AuditFilters } from "@/app/(app)/audit/_lib/filters";
import { cn } from "@/lib/utils";
import { useAuditNav } from "./audit-nav";

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

export function AuditPagination({
  filters,
  total,
  pages,
  noun,
}: {
  filters: AuditFilters;
  total: number;
  pages: number;
  noun: string;
}) {
  const { go } = useAuditNav();
  const sizeId = useId();
  const page = filters.page;
  const start = total ? (page - 1) * filters.size + 1 : 0;
  const end = Math.min(page * filters.size, total);
  const navBtn = cn(buttonVariants({ variant: "outline" }), "h-10 sm:h-8");

  const link = (p: number, children: React.ReactNode, props: Partial<React.ComponentProps<typeof Link>> & { className: string }) => {
    const href = auditHref(filters, { page: p });
    return (
      <Link
        href={href}
        scroll={false}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          go(href);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        {...props}
      >
        {children}
      </Link>
    );
  };

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <p className="tabular">
          <span className="text-foreground font-medium">{start.toLocaleString("en-MY")}</span>–
          <span className="text-foreground font-medium">{end.toLocaleString("en-MY")}</span> of{" "}
          <span className="text-foreground font-medium">{total.toLocaleString("en-MY")}</span> {noun}
        </p>
        <span className="hidden items-center gap-1.5 sm:flex">
          <label htmlFor={sizeId}>Rows</label>
          <NativeSelect
            id={sizeId}
            value={String(filters.size)}
            onChange={(e) => go(auditHref(filters, { size: Number(e.target.value) }))}
            className="h-7 w-[4.5rem] text-xs"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </span>
      </div>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          {page > 1 ? (
            link(page - 1, <><ChevronLeft /> <span>Newer</span></>, { className: navBtn, "aria-label": "Previous page (newer entries)" })
          ) : (
            <span className={cn(navBtn, "pointer-events-none opacity-50")} aria-hidden>
              <ChevronLeft /> <span>Newer</span>
            </span>
          )}
          {pageWindow(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="text-muted-foreground hidden px-1 text-xs sm:inline">
                …
              </span>
            ) : (
              <span key={p} className={cn(p !== page && "hidden sm:inline-flex")}>
                {link(p, p, {
                  "aria-current": p === page ? "page" : undefined,
                  className: cn(buttonVariants({ variant: p === page ? "default" : "ghost" }), "h-10 min-w-10 tabular sm:h-8 sm:min-w-8"),
                })}
              </span>
            ),
          )}
          {page < pages ? (
            link(page + 1, <><span>Older</span> <ChevronRight /></>, { className: navBtn, "aria-label": "Next page (older entries)" })
          ) : (
            <span className={cn(navBtn, "pointer-events-none opacity-50")} aria-hidden>
              <span>Older</span> <ChevronRight />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
