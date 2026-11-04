"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, MessageSquareText, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EASE } from "@/components/motion";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  deleteConversation,
  listConversations,
  renameConversation,
  type ConversationSummary,
} from "@/app/(app)/ai-history-actions";

const RETENTION_DAYS = 90;

function groupOf(iso: string, now: Date): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Previous 7 days";
  if (diff < 30) return "Previous 30 days";
  return "Older";
}

function Row({
  c,
  active,
  onOpen,
  onRenamed,
  onDeleted,
}: {
  c: ConversationSummary;
  active: boolean;
  onOpen: () => void;
  onRenamed: (title: string) => void;
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [draft, setDraft] = useState(c.title);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "rename") input.current?.select();
  }, [mode]);

  function saveTitle() {
    const title = draft.trim();
    if (!title || title === c.title) return setMode("view");
    start(async () => {
      const res = await renameConversation(c.id, title);
      if (!res.ok) return void toast.error(res.error);
      onRenamed(res.title);
      setMode("view");
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteConversation(c.id);
      if (!res.ok) return void toast.error(res.error ?? "Could not delete");
      toast.success("Conversation deleted", { description: "The AI audit log keeps its record." });
      onDeleted();
    });
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25, ease: EASE }}
      className={cn(
        "group relative rounded-lg",
        active ? "bg-[color-mix(in_oklch,var(--ai-2)_10%,transparent)] ring-1 ring-[color-mix(in_oklch,var(--ai-2)_30%,transparent)]" : "hover:bg-muted/60",
      )}
    >
      {mode === "rename" ? (
        <form
          className="flex items-center gap-1 p-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            saveTitle();
          }}
        >
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setMode("view"))}
            maxLength={120}
            aria-label="Conversation title"
            className="bg-background h-9 min-w-0 flex-1 rounded-md border px-2 text-base outline-none focus-visible:ring-2 sm:h-8 sm:text-sm"
          />
          <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save title" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setMode("view")}>
            <X />
          </Button>
        </form>
      ) : mode === "confirm" ? (
        <div className="flex items-center gap-2 p-2.5 text-xs">
          <span className="min-w-0 flex-1">
            Delete <span className="font-medium">“{c.title}”</span>?
          </span>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setMode("view")} disabled={pending}>
            Keep
          </Button>
          <Button size="sm" variant="destructive" className="h-8" onClick={remove} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
          </Button>
        </div>
      ) : (
        <>
          <button type="button" onClick={onOpen} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 pr-16 text-left">
            <MessageSquareText className={cn("mt-0.5 size-4 shrink-0", active ? "text-[var(--ai-2)] dark:text-violet-300" : "text-muted-foreground")} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{c.title}</span>
              <span className="text-muted-foreground block text-[11px]" suppressHydrationWarning>
                {formatRelative(c.updatedAt)} · {Math.ceil(c.messageCount / 2)} question{c.messageCount === 2 ? "" : "s"}
              </span>
            </span>
          </button>
          <div className="absolute top-1.5 right-1.5 flex opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Button size="icon-sm" variant="ghost" aria-label={`Rename ${c.title}`} title="Rename" onClick={() => setMode("rename")}>
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="hover:text-destructive"
              aria-label={`Delete ${c.title}`}
              title="Delete"
              onClick={() => setMode("confirm")}
            >
              <Trash2 />
            </Button>
          </div>
        </>
      )}
    </motion.li>
  );
}

/** Saved conversations of the signed-in user (server-side, owner-only, 90-day retention). */
export function CopilotHistory({
  activeId,
  onOpen,
  onNew,
  onRenamed,
  onDeleted,
}: {
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRenamed: (id: string, title: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () => {
        listConversations(query)
          .then((rows) => live && (setItems(rows), setError(false)))
          .catch(() => live && setError(true));
      },
      query ? 200 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  const now = new Date();
  const groups: [string, ConversationSummary[]][] = [];
  for (const c of items ?? []) {
    const g = groupOf(c.updatedAt, now);
    const last = groups.at(-1);
    if (last && last[0] === g) last[1].push(c);
    else groups.push([g, [c]]);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b p-3 dark:border-white/8">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="bg-card h-10 w-full rounded-lg border pr-2 pl-8 text-base outline-none focus-visible:ring-2 sm:h-9 sm:text-sm dark:border-white/12 dark:bg-white/[0.04]"
          />
        </div>
        <Button onClick={onNew} className="bg-gradient-ai h-10 shrink-0 text-white sm:h-9">
          <Plus /> New chat
        </Button>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {items === null && !error ? (
          <div className="space-y-2 p-1" aria-busy>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="text-destructive p-4 text-center text-sm">Couldn&apos;t load your conversations. Try again.</p>
        ) : !items?.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <MessageSquareText className="text-muted-foreground size-8" />
            <p className="text-sm font-medium">{query ? "No conversations match" : "No saved conversations yet"}</p>
            <p className="text-muted-foreground max-w-60 text-xs">
              {query ? "Try another word from the title." : "Every question you ask is saved here so you can come back to it."}
            </p>
          </div>
        ) : (
          groups.map(([label, rows]) => (
            <section key={label} className="mb-2">
              <h3 className="text-muted-foreground px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide uppercase">{label}</h3>
              <ul className="space-y-0.5">
                <AnimatePresence initial={false}>
                  {rows.map((c) => (
                    <Row
                      key={c.id}
                      c={c}
                      active={c.id === activeId}
                      onOpen={() => onOpen(c.id)}
                      onRenamed={(title) => {
                        setItems((prev) => prev?.map((x) => (x.id === c.id ? { ...x, title } : x)) ?? null);
                        onRenamed(c.id, title);
                      }}
                      onDeleted={() => {
                        setItems((prev) => prev?.filter((x) => x.id !== c.id) ?? null);
                        onDeleted(c.id);
                      }}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))
        )}
      </div>

      <p className="text-muted-foreground shrink-0 border-t px-4 py-2 text-[11px] dark:border-white/8">
        Private to you. Conversations are deleted after {RETENTION_DAYS} days of inactivity; the AI audit log is kept separately.
      </p>
    </div>
  );
}
