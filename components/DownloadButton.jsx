"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

/**
 * Reusable "Download" dropdown that offers both Excel (CSV) and PDF export
 * options, mirroring the toggle behaviour used on the dashboard page.
 *
 * Props:
 *   onExcel  - handler that builds/saves the Excel (CSV) file
 *   onPdf    - handler that builds/saves the PDF file
 *   label     - main button label (default "Download")
 *   excelLabel- dropdown item label (default "Download Excel")
 *   pdfLabel  - dropdown item label (default "Download PDF")
 *   disabled  - disable the button
 *   variant   - "outline" (default) or "solid" (blue)
 *   buttonClassName, iconSize - styling escape hatches
 */
export default function DownloadButton({
  onExcel,
  onPdf,
  label = "Download",
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
      ? "flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs"
      : "flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-xs";

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
        className={`${baseClasses} ${buttonClassName} disabled:opacity-60`}
      >
        <Download className={iconSize} />
        {label}
        <ChevronDown
          className={`${iconSize} transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
          <button
            type="button"
            onClick={() => closeMenu(onExcel)}
            className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            {excelLabel}
          </button>
          <button
            type="button"
            onClick={() => closeMenu(onPdf)}
            className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100"
          >
            <FileText className="w-4 h-4 text-red-600" />
            {pdfLabel}
          </button>
        </div>
      )}
    </div>
  );
}