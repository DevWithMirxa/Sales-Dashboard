"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DownloadButton({
  onExcel,
  onPdf,
  label = "Export Data",
  excelLabel = "Download Excel",
  pdfLabel = "Download PDF",
  disabled = false,
  variant = "outline",
  buttonClassName = "",
  iconSize = "w-4 h-4",
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const baseClasses =
    variant === "solid"
      ? "flex items-center gap-2 bg-accent text-accent-foreground font-medium px-3.5 py-2 rounded-lg hover:bg-accent/90 transition-all shadow-xs text-xs"
      : "flex items-center gap-2 border border-border/70 bg-secondary/80 text-foreground px-3.5 py-2 rounded-lg hover:bg-secondary hover:border-accent/40 transition-all text-xs font-medium shadow-xs";

  const closeMenu = (handler) => {
    setOpen(false);
    if (typeof handler === "function") handler();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={cn(baseClasses, disabled && "opacity-50 cursor-not-allowed", buttonClassName)}
      >
        <Download className={iconSize} />
        <span>{label}</span>
        <ChevronDown
          className={cn("w-3.5 h-3.5 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-xl shadow-xl z-30 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 p-1">
          <button
            type="button"
            onClick={() => closeMenu(onExcel)}
            className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>{excelLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => closeMenu(onPdf)}
            className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary rounded-lg transition-colors border-t border-border/40 mt-0.5"
          >
            <FileText className="w-4 h-4 text-rose-500" />
            <span>{pdfLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}