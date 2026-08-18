"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart3,
  Box,
  MapPin,
  Target,
  Settings,
  LogOut,
  FolderTree,
  Shield,
  PieChart,
  ShoppingCart,
  UserCog,
} from "lucide-react";

export default function Sidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

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

  return (
    <aside
      className={`${
        isOpen ? "w-64" : "w-20"
      } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen overflow-hidden`}
    >
      {/* Logo */}
      <Link
        href="/"
        className="h-16 border-b border-gray-200 flex items-center justify-center gap-3 px-4 hover:bg-gray-50 transition-colors shrink-0"
      >
        <div className="w-10 h-10 bg-linear-to-br from-blue-600 to-teal-400 rounded-lg flex items-center justify-center">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        {isOpen && (
          <span className="font-bold text-lg text-gray-900">SalesHub</span>
        )}
      </Link>

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

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-4 space-y-2 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {isOpen && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
