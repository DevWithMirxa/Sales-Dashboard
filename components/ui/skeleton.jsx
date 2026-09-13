import React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("bg-muted/60 animate-pulse rounded-lg", className)}
      {...props}
    />
  );
}

export function KPISkeleton() {
  return (
    <div className="bg-card border border-border/70 rounded-xl p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <div className="flex items-baseline justify-between pt-1">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = "h-[300px]" }) {
  return (
    <div className="bg-card/90 rounded-xl border border-border/70 p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
      <div className={cn("w-full flex items-end justify-between gap-3 pt-4 px-2", height)}>
        <Skeleton className="h-[40%] flex-1 rounded-t-md" />
        <Skeleton className="h-[75%] flex-1 rounded-t-md" />
        <Skeleton className="h-[55%] flex-1 rounded-t-md" />
        <Skeleton className="h-[90%] flex-1 rounded-t-md" />
        <Skeleton className="h-[65%] flex-1 rounded-t-md" />
        <Skeleton className="h-[80%] flex-1 rounded-t-md" />
        <Skeleton className="h-[45%] flex-1 rounded-t-md" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="bg-card/90 rounded-xl border border-border/70 overflow-hidden p-4 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-border/30">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/8 rounded-full" />
        </div>
      ))}
    </div>
  );
}
