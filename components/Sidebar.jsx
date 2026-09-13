"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ConfirmDelete from "@/components/ConfirmDelete";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  BarChart3,
  Box,
  MapPin,
  Target,
  LogOut,
  FolderTree,
  Shield,
  PieChart,
  ShoppingCart,
  Receipt,
  UserCog,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CircleDollarSign,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ icon: BarChart3, label: "Dashboard", href: "/" }],
  },
  {
    label: "Sales",
    items: [
      { icon: ShoppingCart, label: "Sales", href: "/sales" },
      { icon: Target, label: "Targets", href: "/targets" },
      { icon: Receipt, label: "Recovery", href: "/recovery" },
      { icon: TrendingUp, label: "Trends", href: "/trends" },
      { icon: PieChart, label: "Reports", href: "/reports" },
    ],
  },
  {
    label: "Management",
    items: [
      { icon: Shield, label: "Salesmen", href: "/salesmen" },
      { icon: Box, label: "Products", href: "/products" },
      { icon: MapPin, label: "Regions", href: "/regions" },
      {
        icon: FolderTree,
        label: "Business Directory",
        href: "/business-directory",
      },
    ],
  },
  {
    label: "Administration",
    items: [{ icon: UserCog, label: "User Management", href: "/users" }],
  },
];

export default function Sidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const isActive = (href) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
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
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-out flex flex-col shrink-0 select-none",
        isOpen ? "w-[260px]" : "w-[72px]"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-accent text-accent-foreground shadow-sm">
            <CircleDollarSign className="w-5 h-5" />
          </div>
          <span
            className={cn(
              "font-semibold text-lg text-sidebar-foreground tracking-tight whitespace-nowrap transition-all duration-300",
              isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
            )}
          >
            Sales<span className="text-accent">Hub</span>
          </span>
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto scrollbar-hide">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            {isOpen && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                      active
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                      !isOpen && "justify-center px-0"
                    )}
                    title={!isOpen ? item.label : undefined}
                  >
                    {/* Active vertical pill indicator */}
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-accent transition-all duration-300",
                        active ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Icon
                      className={cn(
                        "w-5 h-5 shrink-0 transition-transform duration-200",
                        active ? "text-accent" : "group-hover:scale-110"
                      )}
                    />
                    {isOpen && (
                      <span className="whitespace-nowrap transition-all duration-300 truncate">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Area with Theme Toggle & User Account */}
      <div className="p-3 border-t border-sidebar-border space-y-2 shrink-0 relative">
        {showAccountMenu && (
          <div
            className={cn(
              "absolute bottom-full mb-2 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200",
              isOpen ? "left-3 right-3" : "left-3 w-56"
            )}
          >
            <div className="p-3.5 border-b border-border bg-muted/20">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name || "Authenticated User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || "user@saleshub.com"}
              </p>
            </div>
            <div className="p-1.5 space-y-1">
              <div className="px-3 py-1.5 text-xs text-muted-foreground flex items-center justify-between">
                <span>Theme</span>
                <ThemeToggle className="w-7 h-7" />
              </div>
              <ConfirmDelete
                title="Sign out"
                description="Are you sure you want to sign out of SalesOps?"
                confirmLabel="Sign out"
                onConfirm={handleLogout}
              >
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive-soft/50 rounded-lg transition-colors">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </ConfirmDelete>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAccountMenu((v) => !v)}
            className={cn(
              "flex-1 flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/60 transition-colors text-left min-w-0 border border-transparent hover:border-sidebar-border",
              !isOpen && "justify-center px-0"
            )}
            title={user?.name || "Account Settings"}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/80 to-chart-1 flex items-center justify-center text-xs font-semibold text-accent-foreground shrink-0 shadow-sm">
              {getInitials(user?.name)}
            </div>
            {isOpen && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user?.name || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize truncate">
                    {user?.role || "sales_op"}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </>
            )}
          </button>

          {isOpen && <ThemeToggle className="shrink-0" />}
        </div>

        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200"
        >
          {!isOpen ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-xs font-medium">Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
