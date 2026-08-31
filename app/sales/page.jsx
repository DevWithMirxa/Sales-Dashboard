"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import SaleForm from "@/components/forms/SaleForm";
import TanStackDataTable from "@/components/TanStackDataTable";
import {
  Plus,
  Trash2,
  Edit2,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileDown,
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import ConfirmDelete from "@/components/ConfirmDelete";

// Compact a number into a short, human-friendly string using a single "M"
// (millions) unit, e.g. 30,820,000 -> "30.82 M" and 21,700 -> "0.02 M".
const formatCompact = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0 M";
  return `${(n / 1_000_000).toFixed(2)} M`;
};

function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null); // { type: 'success' | 'error', text }
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  // Salesman + period (month / day) filters applied client-side to the table.
  const [filterSalesman, setFilterSalesman] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all"); // "YYYY-MM"
  const [filterDay, setFilterDay] = useState("all"); // day of month (1-31)

  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await api.get("/sales");
      setSales(res.data);
    } catch (error) {
      console.error("Error fetching sales:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const salesmen = useMemo(() => {
    const map = new Map();
    (sales || []).forEach((s) => {
      if (s.salesman) map.set(s.salesman, s.salesman);
    });
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  }, [sales]);

  const months = useMemo(() => {
    const map = new Map();
    (sales || []).forEach((s) => {
      const d = s.saleDate ? new Date(s.saleDate) : null;
      if (d && !isNaN(d)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0",
        )}`;
        map.set(
          key,
          d.toLocaleString("en-US", { month: "short", year: "numeric" }),
        );
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sales]);

  const days = useMemo(() => {
    const set = new Set();
    (sales || []).forEach((s) => {
      const d = s.saleDate ? new Date(s.saleDate) : null;
      if (d && !isNaN(d)) set.add(d.getDate());
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [sales]);

  const filteredSales = useMemo(() => {
    return (sales || []).filter((s) => {
      if (filterSalesman !== "all" && s.salesman !== filterSalesman) {
        return false;
      }
      const d = s.saleDate ? new Date(s.saleDate) : null;
      if (d && !isNaN(d)) {
        const monthKey = `${d.getFullYear()}-${String(
          d.getMonth() + 1,
        ).padStart(2, "0")}`;
        if (filterMonth !== "all" && monthKey !== filterMonth) return false;
        if (filterDay !== "all" && d.getDate() !== Number(filterDay)) {
          return false;
        }
      }
      return true;
    });
  }, [sales, filterSalesman, filterMonth, filterDay]);

  const clearFilters = () => {
    setFilterSalesman("all");
    setFilterMonth("all");
    setFilterDay("all");
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/sales/${id}`);
      fetchSales();
    } catch (error) {
      console.error("Error deleting sale:", error);
      alert("Failed to delete sale");
    }
  };

  const handleEdit = (sale) => {
    setEditingSale(sale);
    setShowForm(true);
  };

  const saleColumns = [
    {
      label: "Date",
      value: (row) =>
        row.saleDate ? new Date(row.saleDate).toLocaleDateString() : "-",
    },
    { label: "Salesman", key: "salesman" },
    { label: "Product", key: "product" },
    { label: "Customer", key: "customer" },
    { label: "Region", key: "region" },
    {
      label: "Quantity",
      value: (row) => `${row.quantity || 0} ${row.unit || ""}`.trim(),
    },
    { label: "Rate", key: "rate" },
    { label: "Total Amount", key: "totalAmount" },
    { label: "Notes", key: "notes" },
  ];

  const handleExportExcel = () => {
    exportToCSV(filteredSales, saleColumns, "sales");
  };

  const handleExportPDF = () => {
    exportToPDF(filteredSales, saleColumns, {
      title: "Sales",
      subtitle: "Sales records",
      filename: "sales",
    });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSale(null);
  };

  // "Browse Excel File" opens the dialog instead of the file picker directly,
  // so the user sees the Download Format File option first.
  const handleBrowseClick = () => setShowUploadDialog(true);

  // "Upload Excel File" inside the dialog closes it, then opens the actual
  // OS file picker. The hidden <input type="file"> below stays mounted
  // outside the dialog, so this still works after the dialog unmounts.
  const handleChooseUpload = () => {
    setShowUploadDialog(false);
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await api.get("/sales/upload-template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "sales-upload-template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading template:", err);
      alert("Failed to download the template file.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so selecting the same file again still fires onChange
    if (!file) return;

    setShowUploadDialog(false);
    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/sales/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { inserted = 0, skipped = 0, totalRows = 0 } = res.data || {};
      setUploadMessage({
        type: "success",
        text: `Imported ${inserted} of ${totalRows} rows${
          skipped ? ` (${skipped} skipped)` : ""
        }.`,
      });
      fetchSales();
    } catch (err) {
      setUploadMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Upload failed. Please check the file format and try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: "saleDate",
        header: "Date",
        cell: ({ getValue }) => {
          const v = getValue();
          return v ? new Date(v).toLocaleDateString() : "-";
        },
        meta: {
          headerClassName: "w-[13%]",
          cellClassName: "w-[13%]",
        },
      },
      {
        accessorKey: "salesman",
        header: "Salesman",
        meta: {
          headerClassName: "w-[14%]",
          cellClassName: "w-[14%] text-gray-900 font-medium",
        },
      },
      {
        accessorKey: "product",
        header: "Product",
        meta: {
          headerClassName: "w-[14%]",
          cellClassName: "w-[14%]",
        },
      },
      {
        accessorKey: "customer",
        header: "Customer",
        meta: {
          headerClassName: "w-[15%]",
          cellClassName: "w-[15%]",
        },
      },
      {
        accessorKey: "region",
        header: "Region",
        meta: {
          headerClassName: "w-[12%]",
          cellClassName: "w-[12%]",
        },
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) =>
          `${row.original.quantity || 0} ${row.original.unit || ""}`,
        meta: {
          headerClassName: "w-[10%]",
          cellClassName: "w-[10%]",
        },
      },
      {
        accessorKey: "totalAmount",
        header: "Total Amount (Rs)",
        cell: ({ getValue }) => formatCompact(getValue() || 0),
        meta: {
          headerClassName: "w-[15%] text-center",
          cellClassName: "w-[15%] text-center font-semibold text-gray-900",
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: {
          headerClassName: "w-[10%]",
          cellClassName: "w-[10%]",
        },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleEdit(row.original)}
              className="text-blue-600 hover:text-blue-900"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <ConfirmDelete
              title="Delete sale"
              description="Are you sure you want to delete this sale? This action cannot be undone."
              onConfirm={() => handleDelete(row.original._id)}
            >
              <button
                className="text-red-600 hover:text-red-900"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </ConfirmDelete>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900">Sales</h1>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton
              onExcel={handleExportExcel}
              onPdf={handleExportPDF}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelected}
            />
            <button
              onClick={handleBrowseClick}
              disabled={uploading}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 text-xs"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {uploading ? "Uploading..." : "Browse Excel File"}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs"
            >
              <Plus className="w-5 h-5" />
              Add Sales
            </button>
          </div>
        </div>

        {/* Salesman + Period filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex-1 min-w-32">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Salesman
            </label>
            <select
              value={filterSalesman}
              onChange={(e) => setFilterSalesman(e.target.value)}
              className="w-full px-1 py-1 border text-sm border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Salesmen</option>
              {salesmen.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-32">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Month
            </label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-1 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Months</option>
              {months.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-32">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Day
            </label>
            <select
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="w-full px-1 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Days</option>
              {days.map((d) => (
                <option key={d} value={String(d)}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors text-xs"
          >
            Clear
          </button>
        </div>

        {/* Upload result banner */}
        {uploadMessage && (
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
              uploadMessage.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {uploadMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="flex-1">{uploadMessage.text}</span>
            <button
              onClick={() => setUploadMessage(null)}
              className="text-current opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <TanStackDataTable
          columns={columns}
          data={filteredSales}
          loading={loading}
          emptyMessage={
            filteredSales.length === 0 && sales.length > 0
              ? "No sales match the selected filters."
              : "No sales recorded yet."
          }
          getRowId={(row) => row._id}
          paginate
        />

        {/* Browse Excel dialog - download a correctly-formatted template, or
            go straight to picking a file to upload */}
        {showUploadDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">
                  Import Sales
                </h3>
                <button
                  onClick={() => setShowUploadDialog(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm text-gray-600">
                  Not sure about the column headers? Download the format file
                  first — it has the exact headers we expect, plus one example
                  row.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 text-xs"
                >
                  {downloadingTemplate ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileDown className="w-5 h-5" />
                  )}
                  {downloadingTemplate
                    ? "Downloading..."
                    : "Download Format File"}
                </button>
                <button
                  onClick={handleChooseUpload}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors text-xs"
                >
                  <Upload className="w-5 h-5" />
                  Upload Excel File
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <SaleForm
            onClose={handleCloseForm}
            initialData={editingSale}
            onSuccess={fetchSales}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

export default function SalesPage() {
  return (
    <ProtectedRoute>
      <Sales />
    </ProtectedRoute>
  );
}
