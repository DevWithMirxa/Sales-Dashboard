"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Collapsible Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Container - margin offset accounts for fixed sidebar */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ease-out",
          sidebarOpen ? "pl-65" : "pl-18",
        )}
      >
        {/* Sticky Header Shell */}
        <Header />

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
