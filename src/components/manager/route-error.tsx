"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error instanceof Error ? error.message : "Unexpected error";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      <span className="bg-destructive/10 text-destructive mb-3 flex size-11 items-center justify-center rounded-full">
        <AlertTriangle className="size-5" />
      </span>
      <h2 className="text-sm font-semibold">This view could not be loaded</h2>
      <p className="text-muted-foreground mt-1 text-sm">{message}</p>
      <Button className="mt-4" variant="outline" onClick={() => retry()}>
        <RotateCw /> Try again
      </Button>
    </div>
  );
}
