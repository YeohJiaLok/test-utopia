import { cn } from "@/lib/utils";

export function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn("bg-muted relative overflow-hidden rounded-md", className)} style={style}>
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

export function LoadingLabel({ label }: { label: string }) {
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  );
}

export function HeaderBones({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" aria-hidden>
      <div className="space-y-2">
        <Bone className="h-3 w-20" />
        <Bone className="h-7 w-64 max-w-full" />
        <Bone className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Bone key={i} className="h-8 w-32" />
        ))}
      </div>
    </div>
  );
}

export function StatBones({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-card space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <Bone className="h-3 w-20" />
            <Bone className="size-8 rounded-lg" />
          </div>
          <Bone className="h-7 w-24" />
          <Bone className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function PanelBones({ className, rows = 4, chart }: { className?: string; rows?: number; chart?: boolean }) {
  return (
    <div className={cn("bg-card space-y-4 rounded-xl border p-4 sm:p-5", className)} aria-hidden>
      <div className="space-y-1.5">
        <Bone className="h-4 w-40" />
        <Bone className="h-3 w-56 max-w-full" />
      </div>
      {chart ? (
        <div className="flex h-48 items-end gap-2">
          {[40, 65, 50, 80, 55, 90, 35, 60, 70, 45].map((h, i) => (
            <Bone key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-3.5 w-2/5" />
                <Bone className="h-1.5 w-full" />
              </div>
              <Bone className="hidden h-4 w-16 sm:block" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
