import { type HTMLAttributes } from "react";

export function Skeleton({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Se încarcă"
      className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`}
      {...rest}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/40 p-5 sm:p-7 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

export function SkeletonRow() {
  return <Skeleton className="h-12 w-full" />;
}
