"use client";

import React from "react";
import { cn } from "@/lib/utils";

export default function ChartCard({ title, subtitle, action, children, className }) {
  return (
    <div
      className={cn(
        "bg-card/90 backdrop-blur-sm rounded-xl border border-border/70 p-5 shadow-xs hover:border-accent/30 transition-all duration-300 flex flex-col justify-between overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="w-full flex-1">{children}</div>
    </div>
  );
}
