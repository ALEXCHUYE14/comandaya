import { cn } from "@/core/lib/cn";

export function EmptyState({ icon, title, text, action, className }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line px-6 py-12 text-center", className)}>
      <div className="mb-1 grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted [&_svg]:size-7">{icon}</div>
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} />;
}
