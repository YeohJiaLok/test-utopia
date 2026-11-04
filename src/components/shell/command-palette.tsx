"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CalendarClock, CornerDownLeft, Loader2, MapPin, Search, User, Wrench } from "lucide-react";
import { Command, CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { StatusBadge } from "@/components/shared/status-badge";
import type { NavItem, NavSection } from "@/lib/routes";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { searchOrders, type OrderSearchHit } from "@/app/(app)/shell-actions";
import { NavIcon } from "./nav-icon";

type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string; hits: OrderSearchHit[] }
  | { status: "ready"; query: string; hits: OrderSearchHit[] }
  | { status: "error"; query: string; message: string };

const EXAMPLES = ["SJK-2611-01400", "012-345 6789", "Ong Devi", "Benny Shah Alam", "job done"];

/** Wraps every occurrence of the query's words in <mark>. */
function Highlight({ text, query }: { text: string; query: string }) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-primary/15 text-foreground rounded-[3px] px-px">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-background text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[10px] shadow-xs">
      {children}
    </kbd>
  );
}

/**
 * Global search (Ctrl/⌘ K): ranked, typo-tolerant order search across order number, customer,
 * phone, address, technician, service, branch and status — plus page navigation.
 */
export function CommandPalette({ nav, actions = [] }: { nav: NavSection[]; actions?: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => {
          if (o) {
            seq.current++;
            setQuery("");
            setSearch({ status: "idle" });
          }
          return !o;
        });
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  // Debounced server search; responses that arrive out of order are discarded.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setSearch((prev) => ({ status: "loading", query: q, hits: prev.status === "ready" || prev.status === "loading" ? prev.hits : [] }));
      try {
        const hits = await searchOrders(q);
        if (id === seq.current) setSearch({ status: "ready", query: q, hits });
      } catch (err) {
        if (id === seq.current) setSearch({ status: "error", query: q, message: err instanceof Error ? err.message : "Search failed." });
      }
    }, 160);
    return () => clearTimeout(t);
  }, [query]);

  const q = query.trim();
  const searching = q.length >= 2;
  const hits = searching && (search.status === "ready" || search.status === "loading") ? search.hits : [];
  const loading = searching && (search.status === "loading" || ("query" in search ? search.query !== q : true));
  const pages = [...actions, ...nav.flatMap((s) => s.items)].filter((i) => !searching || i.label.toLowerCase().includes(q.toLowerCase()));

  // Every open starts fresh.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      seq.current++;
      setQuery("");
      setSearch({ status: "idle" });
    }
  }

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search orders by number, customer, phone, address, technician or status"
      className="top-[8vh] max-w-[calc(100%-1.5rem)] sm:top-[14vh] sm:max-w-2xl"
    >
      <Command shouldFilter={false} loop className="rounded-xl">
        <div className="relative">
          <CommandInput
            placeholder="Search orders, customers, phone, technician, area…"
            value={query}
            onValueChange={setQuery}
            className="text-[15px]"
          />
          {loading && <Loader2 className="text-muted-foreground absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin" />}
        </div>

        <CommandList className="max-h-[min(62vh,520px)] scroll-py-2">
          {!searching && (
            <div className="px-3 pt-3 pb-1">
              <p className="text-muted-foreground text-xs">Search every order you can access, by anything you remember:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setQuery(ex)}
                    className="hover:border-primary/40 hover:text-foreground text-muted-foreground bg-muted/50 rounded-full border px-2.5 py-1 text-xs transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {searching && search.status === "error" && search.query === q && (
            <div className="text-destructive flex items-center gap-2 px-4 py-6 text-sm">
              <AlertCircle className="size-4" /> {search.message}
            </div>
          )}

          {searching && !loading && search.status === "ready" && hits.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Search className="text-muted-foreground/60 mx-auto size-6" />
              <p className="mt-2 text-sm font-medium">No orders match “{q}”</p>
              <p className="text-muted-foreground mt-1 text-xs">Try an order number, the last digits of a phone number, or a customer or technician name.</p>
            </div>
          )}

          {hits.length > 0 && (
            <CommandGroup heading={`Orders · ${hits.length}${hits.length >= 12 ? "+" : ""}`}>
              {hits.map((h) => (
                <CommandItem key={h.id} value={h.id} onSelect={() => go(h.href)} className="items-start gap-3 rounded-lg px-3 py-2.5">
                  <span className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Wrench className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-xs font-medium">
                        <Highlight text={h.orderNo} query={q} />
                      </span>
                      <span className="truncate text-sm font-medium">
                        <Highlight text={h.customer} query={q} />
                      </span>
                    </span>
                    <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                      {h.service && <span>{h.service}</span>}
                      {h.technician && (
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" />
                          <Highlight text={h.technician} query={q} />
                        </span>
                      )}
                      {h.branch && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          <Highlight text={h.branch} query={q} />
                        </span>
                      )}
                      {h.scheduledAt && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3" />
                          {formatDateTime(h.scheduledAt)}
                        </span>
                      )}
                      {h.matchedOn === "Phone" && (
                        <span className="font-mono">
                          <Highlight text={h.phone} query={q} />
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={h.status} pulse={false} />
                    <span
                      className={cn(
                        "rounded px-1.5 py-px text-[10px] font-medium",
                        h.matchedOn === "Similar" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {h.matchedOn === "Similar" ? "Close match" : h.matchedOn}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {pages.length > 0 && (
            <CommandGroup heading={searching ? "Pages" : "Go to"}>
              {pages.map((item) => (
                <CommandItem key={item.href} value={`page:${item.href}`} onSelect={() => go(item.href)} className="rounded-lg px-3 py-2">
                  <NavIcon name={item.icon} className="text-muted-foreground" />
                  <span>{item.label}</span>
                  <ArrowRight className="text-muted-foreground ml-auto size-3.5" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>

        <div className="bg-muted/40 text-muted-foreground hidden items-center gap-4 border-t px-3 py-2 text-[11px] sm:flex">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>
              <CornerDownLeft className="size-3" />
            </Kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd> close
          </span>
          <span className="ml-auto">Ranked · typo-tolerant · scoped to your access</span>
        </div>
      </Command>
    </CommandDialog>
  );
}
