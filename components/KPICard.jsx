import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function KPICard({
  title,
  value,
  trend,
  trendUp,
  icon: Icon,
  delay = 0,
  className,
}) {
  const hasTrend = trendUp !== undefined && trendUp !== null;

  return (
    <div
      className={cn(
        "group relative bg-card border border-border/70 rounded-xl p-5 hover:border-accent/50 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-3",
        className,
      )}
      style={{ animationDelay: `${delay * 80}ms`, animationFillMode: "both" }}
    >
      {/* Subtle ambient hover background glow */}
      <div className="absolute inset-0 bg-linear-to-br from-accent/5 via-accent/2 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
        <div className="flex items-start justify-between">
          <span
            className="text-[10px] font-light uppercase tracking-wider text-muted-foreground truncate max-w-40"
            title={title}
          >
            {title}
          </span>
          <div className="w-5 h-5 rounded-lg bg-secondary/80 flex items-center justify-center group-hover:bg-accent/15 transition-colors duration-300 shrink-0 border border-border/40 mt-8">
            {Icon ? (
              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors duration-300" />
            ) : hasTrend ? (
              trendUp ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )
            ) : (
              <Activity className="w-4 h-4 text-muted-foreground/60 group-hover:text-accent transition-colors duration-300" />
            )}
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg lg:text-xl font-bold font-mono tracking-tight text-foreground truncate">
            {value}
          </span>

          {trend && (
            <div
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 border",
                hasTrend
                  ? trendUp
                    ? "bg-success-soft/70 text-success-soft-foreground border-success/20"
                    : "bg-destructive-soft/70 text-destructive-soft-foreground border-destructive/20"
                  : "bg-muted text-muted-foreground border-border/40",
              )}
            >
              {hasTrend &&
                (trendUp ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                ))}
              <span>{trend}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
