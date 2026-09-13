"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Bell, Search, Calendar, Home, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ROUTE_LABELS = {
  salesmen: "Salesmen",
  products: "Products",
  targets: "Targets",
  sales: "Sales",
  recovery: "Recovery",
  regions: "Regions",
  "business-directory": "Business Directory",
  trends: "Trends",
  reports: "Reports",
  forecasting: "Forecasting",
  "performance-flow": "Performance Flow",
  users: "User Management",
};

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);
  const segments = pathname.split("/").filter(Boolean);

  const getPageTitle = () => {
    if (segments.length === 0) return "Overview";
    const lastSeg = segments[segments.length - 1];
    return (
      ROUTE_LABELS[lastSeg] ||
      lastSeg.charAt(0).toUpperCase() + lastSeg.slice(1)
    );
  };

  const getInitials = (name) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U"
    );
  };

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 transition-colors">
      <div className="flex items-center gap-6">
        <div className="flex flex-col justify-center">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {getPageTitle()}
          </h1>
          {/* Sub-breadcrumb navigation */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <Link
              href="/"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              <span>Dashboard</span>
            </Link>
            {segments.map((segment, i) => {
              const href = "/" + segments.slice(0, i + 1).join("/");
              const isLast = i === segments.length - 1;
              const label = ROUTE_LABELS[segment] || segment;
              return (
                <React.Fragment key={href}>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                  {isLast ? (
                    <span className="font-medium text-accent truncate">
                      {label}
                    </span>
                  ) : (
                    <Link
                      href={href}
                      className="hover:text-foreground transition-colors truncate"
                    >
                      {label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full border border-border/40">
          <Calendar className="w-3.5 h-3.5 text-accent" />
          <span>Real-Time Analytics</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search Input Box */}
        <div
          className={cn(
            "relative items-center transition-all duration-300 hidden sm:flex",
            searchFocused ? "w-64" : "w-44",
          )}
        ></div>

        {/* Theme Switcher Toggle */}
        <ThemeToggle />

        {/* User Profile Avatar */}
        <div className="w-9 h-9 rounded-lg overflow-hidden bg-secondary ring-2 ring-border hover:ring-accent/50 transition-all duration-200 flex items-center justify-center">
          <div className="w-full h-full bg-linear-to-br from-accent/80 to-chart-1 flex items-center justify-center text-xs font-semibold text-accent-foreground">
            {getInitials(user?.name)}
          </div>
        </div>
      </div>
    </header>
  );
}
