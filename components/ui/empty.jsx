import React from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Empty({
  icon: Icon = FolderOpen,
  title = "No data available",
  description = "There are no records matching your current selection or filter parameters.",
  action,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border/70 bg-card/40 my-2 min-h-[220px]",
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-secondary/80 flex items-center justify-center mb-3 text-muted-foreground border border-border/50">
        <Icon className="w-6 h-6 text-accent" />
      </div>
      <h3 className="text-sm font-semibold text-foreground tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm mb-4">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
