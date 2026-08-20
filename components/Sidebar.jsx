"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
  UserCog,
  ChevronDown,
} from "lucide-react";

export default function Sidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const menuItems = [
    { icon: BarChart3, label: "Dashboard", href: "/" },
    { icon: Shield, label: "Salesmen", href: "/salesmen" },
    { icon: Box, label: "Products", href: "/products" },
    { icon: Target, label: "Targets", href: "/targets" },
    { icon: ShoppingCart, label: "Sales", href: "/sales" },
    { icon: MapPin, label: "Regions", href: "/regions" },
    {
      icon: FolderTree,
      label: "Business Directory",
      href: "/business-directory",
    },
    { icon: BarChart3, label: "Trends", href: "/trends" },
    { icon: PieChart, label: "Reports", href: "/reports" },
    { icon: UserCog, label: "User Management", href: "/users" },
  ];

  const isActive = (href) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      logout();
      router.push("/login");
    }
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
      className={`${
        isOpen ? "w-64" : "w-20"
      } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen overflow-hidden`}
    >
      {/* Logo - click toggles the sidebar */}
      <button
        type="button"
        onClick={onToggle}
        className="h-16 border-b border-gray-200 flex items-center justify-center gap-3 px-4 hover:bg-gray-50 transition-colors shrink-0 w-full"
        title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        <div className="w-10 h-10 bg-linear-to-br from-blue-600 to-teal-400 rounded-lg flex items-center justify-center shrink-0">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        {isOpen && (
          <span className="font-bold text-lg text-gray-900">SalesHub</span>
        )}
      </button>

      {/* Menu Items - scrolls independently if it grows taller than the screen */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {isOpen && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer - account block, replaces the old Header dropdown */}
      <div className="border-t border-gray-200 px-2 py-3 shrink-0 relative">
        {showAccountMenu && (
          <div
            className={`absolute bottom-full mb-2 ${
              isOpen ? "left-2 right-2" : "left-2 w-56"
            } bg-white border border-gray-200 rounded-lg shadow-lg z-50`}
          >
            <div className="p-4 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <div className="p-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAccountMenu((v) => !v)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          title={user?.name || "Account"}
        >
          <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-teal-400 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
            {getInitials(user?.name)}
          </div>
          {isOpen && (
            <>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-gray-500 capitalize truncate">
                  {user?.role || "user"}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-600 shrink-0" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
