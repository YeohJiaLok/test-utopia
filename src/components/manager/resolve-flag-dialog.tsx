"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resolveFlag } from "@/app/(app)/manager/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const QUICK_NOTES = ["Verified with technician — legitimate", "Customer approved extra charges", "Evidence re-uploaded", "False positive"];

export function ResolveFlagDialog({ flagId, title, size = "sm" }: { flagId: string; title: string; size?: "sm" | "default" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await resolveFlag({ flagId, note });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Flag resolved", { description: title });
      setOpen(false);
      setNote("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size={size} />}>
        <CheckCircle2 /> Resolve
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve flag</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`note-${flagId}`} className="text-[13px]">
              Resolution note<span className="text-destructive ml-0.5">*</span>
            </Label>
            <Textarea
              id={`note-${flagId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you check, and why is this resolved?"
              rows={3}
              aria-invalid={!!error}
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_NOTES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setNote(q)}
                  className="bg-muted text-muted-foreground hover:text-foreground rounded-full px-2 py-0.5 text-[11px] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            {error && <p className="text-destructive text-xs font-medium">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending || note.trim().length < 3}>
              {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Mark resolved
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
