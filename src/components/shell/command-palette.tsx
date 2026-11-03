"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { StatusBadge } from "@/components/shared/status-badge";
import type { NavSection } from "@/lib/routes";
import { searchOrders, type OrderSearchHit } from "@/app/(app)/shell-actions";
import { NavIcon } from "./nav-icon";

/** ⌘K palette: jump to any page or search orders by number / customer / phone. */
export function CommandPalette({ nav }: { nav: NavSection[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<OrderSearchHit[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
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

  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(() => {
      startTransition(async () => setHits(await searchOrders(query)));
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const visibleHits = query.trim().length >= 2 ? hits : [];

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page or find an order">
      <CommandInput placeholder="Search orders, customers, phone… or jump to a page" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{pending ? "Searching…" : "No results."}</CommandEmpty>
        {visibleHits.length > 0 && (
          <CommandGroup heading="Orders">
            {visibleHits.map((h) => (
              <CommandItem key={h.id} value={`${h.orderNo} ${h.customer}`} onSelect={() => go(h.href)}>
                <Search className="text-muted-foreground" />
                <span className="font-mono text-xs">{h.orderNo}</span>
                <span className="truncate">{h.customer}</span>
                <StatusBadge status={h.status} className="ml-auto" pulse={false} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {pending && visibleHits.length === 0 && query.length >= 2 && (
          <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs">
            <Loader2 className="size-3 animate-spin" /> Searching orders…
          </div>
        )}
        {nav.map((section, i) => (
          <CommandGroup key={i} heading={section.title ?? "Navigate"}>
            {section.items.map((item) => (
              <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                <NavIcon name={item.icon} />
                {item.label}
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
