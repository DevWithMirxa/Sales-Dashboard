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
  Filter,
  RotateCcw,
  Search,
  ChevronDown,
  ShoppingCart,
  Users,
  DollarSign,
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import ConfirmDelete from "@/components/ConfirmDelete";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton";

function StatCard({ label, value, icon: Icon, colorClass }) {
  return (
    <Card className="border-border bg-card transition-all duration-300 hover:border-muted-foreground/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-2xl font-semibold", colorClass)}>
              {value}
            </p>
          </div>
          <Icon className={cn("h-8 w-8 opacity-50", colorClass)} />
        </div>
      </CardContent>
    </Card>
  );
}

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
  const [uploadMessage, setUploadMessage] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  const [filterSalesman, setFilterSalesman] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterDay, setFilterDay] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

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

  const regions = useMemo(
    () =>
      [
        ...new Set((sales || []).map((sale) => sale.region).filter(Boolean)),
      ].sort(),
    [sales],
  );

  const products = useMemo(
    () =>
      [
        ...new Set((sales || []).map((sale) => sale.product).filter(Boolean)),
      ].sort(),
    [sales],
  );

  const filteredSales = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (sales || []).filter((s) => {
      // More filters
      if (filterSalesman !== "all" && s.salesman !== filterSalesman)
        return false;
      if (filterRegion !== "all" && s.region !== filterRegion) return false;
      if (filterProduct !== "all" && s.product !== filterProduct) return false;
      const d = s.saleDate ? new Date(s.saleDate) : null;
      if (d && !isNaN(d)) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (filterMonth !== "all" && monthKey !== filterMonth) return false;
        if (filterDay !== "all" && d.getDate() !== Number(filterDay))
          return false;
      }
      // Search query: match salesman, product, customer, region
      if (q) {
        const haystack = [
          s.salesman || "",
          s.product || "",
          s.customer || "",
          s.region || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    sales,
    filterSalesman,
    filterMonth,
    filterDay,
    filterRegion,
    filterProduct,
    searchQuery,
  ]);

  const clearFilters = () => {
    setFilterSalesman("all");
    setFilterMonth("all");
    setFilterDay("all");
    setFilterRegion("all");
    setFilterProduct("all");
    setSearchQuery("");
  };

  const hasActiveMoreFilters =
    filterSalesman !== "all" ||
    filterMonth !== "all" ||
    filterDay !== "all" ||
    filterRegion !== "all" ||
    filterProduct !== "all";

  const handleDelete = async (id) => {
    try {
      await api.delete(`/sales/${id}`);
      fetchSales();
    } catch (error) {
      console.error("Error deleting sale:", error);
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

  const handleBrowseClick = () => setShowUploadDialog(true);

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
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
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
        text: `Successfully imported ${inserted} of ${totalRows} rows${
          skipped ? ` (${skipped} skipped)` : ""
        }.`,
      });
      fetchSales();
    } catch (err) {
      setUploadMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Upload failed. Please verify file formatting and try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  // Summary stats derived from the full (unfiltered) dataset.
  const stats = useMemo(() => {
    const totalSales = sales.length;
    const completedCount = sales.filter((s) => s.status === "completed").length;
    const salespeopleCount = new Set(
      sales.map((s) => s.salesman).filter(Boolean),
    ).size;
    const amounts = sales
      .map((s) => Number(s.totalAmount))
      .filter((n) => Number.isFinite(n));
    const avgDealSize = amounts.length
      ? amounts.reduce((a, b) => a + b, 0) / amounts.length
      : 0;
    return { totalSales, completedCount, salespeopleCount, avgDealSize };
  }, [sales]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "saleDate",
        header: "Date",
        cell: ({ getValue }) => {
          const v = getValue();
          return (
            <span className="font-mono text-muted-foreground">
              {v ? new Date(v).toLocaleDateString() : "-"}
            </span>
          );
        },
      },
      {
        accessorKey: "salesman",
        header: "Salesperson",
        cell: ({ getValue }) => (
          <span className="font-semibold text-foreground">{getValue()}</span>
        ),
      },
      {
        accessorKey: "product",
        header: "Product",
      },
      {
        accessorKey: "customer",
        header: "Customer",
      },
      {
        accessorKey: "region",
        header: "Region",
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.quantity || 0} {row.original.unit || ""}
          </span>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Total Amount (Rs)",
        cell: ({ getValue }) => (
          <span className="font-mono font-bold text-accent">
            {formatCompact(getValue() || 0)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleEdit(row.original)}
              className="p-1.5 rounded-lg border border-border/60 bg-secondary/80 text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors"
              title="Edit Sale"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <ConfirmDelete
              title="Delete sale record"
              description="Are you sure you want to delete this sales transaction? This action cannot be undone."
              onConfirm={() => handleDelete(row.original._id)}
            >
              <button
                type="button"
                className="p-1.5 rounded-lg border border-border/60 bg-secondary/80 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                title="Delete Sale"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 border border-border/70 rounded-xl p-5 shadow-xs">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-accent">
              Sales Management
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Record, import, and track farm & feed mill sales
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton
              onExcel={handleExportExcel}
              onPdf={handleExportPDF}
              label="Export"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelected}
            />
            <button
              type="button"
              onClick={handleBrowseClick}
              disabled={uploading}
              className="flex items-center gap-2 border border-border/70 bg-secondary/80 text-foreground px-3.5 py-2 rounded-lg hover:bg-secondary hover:border-accent/40 transition-all text-xs font-medium shadow-xs disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
              ) : (
                <Upload className="w-4 h-4 text-accent" />
              )}
              <span>{uploading ? "Uploading..." : "Import Excel"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-accent text-accent-foreground font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-all shadow-xs text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Sale</span>
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            label="Total Sales"
            value={stats.totalSales}
            icon={ShoppingCart}
            colorClass="text-foreground"
          />
          <StatCard
            label="Completed Sales"
            value={stats.completedCount}
            icon={CheckCircle2}
            colorClass="text-success"
          />
          <StatCard
            label="Salespeople"
            value={stats.salespeopleCount}
            icon={Users}
            colorClass="text-chart-1"
          />
          <StatCard
            label="Avg Deal Size"
            value={`Rs ${formatCompact(stats.avgDealSize)}`}
            icon={DollarSign}
            colorClass="text-chart-3"
          />
        </div>

        {/* v0-style Inline Filter Bar */}
        <div className="bg-card/60 border border-border/60 rounded-xl shadow-xs overflow-hidden">
          {/* Main filter row */}
          <div className="flex flex-col sm:flex-row items-center gap-3 px-4 py-3">
            {/* Search input */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                id="sales-search"
                type="text"
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-secondary/60 border border-border/60 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
              />
            </div>

            {/* More filters button */}
            <button
              id="sales-more-filters-btn"
              type="button"
              onClick={() => setShowMoreFilters((v) => !v)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 shrink-0 ${
                showMoreFilters || hasActiveMoreFilters
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-accent/40 bg-secondary/60"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              More filters
              {hasActiveMoreFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  showMoreFilters ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* Expandable more-filters panel */}
          {showMoreFilters && (
            <div className="border-t border-border/50 bg-secondary/20 px-4 py-4 flex flex-col sm:flex-row gap-3 flex-wrap items-end animate-in slide-in-from-top-2 duration-200">
              <div className="flex-1 min-w-40">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Salesperson
                </label>
                <select
                  value={filterSalesman}
                  onChange={(e) => setFilterSalesman(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-secondary/70 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                >
                  <option value="all">All Salespeople</option>
                  {salesmen.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-40">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Month
                </label>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-secondary/70 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                >
                  <option value="all">All Months</option>
                  {months.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-40">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Region
                </label>
                <select
                  value={filterRegion}
                  onChange={(e) => setFilterRegion(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-secondary/70 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                >
                  <option value="all">All Regions</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-40">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Product
                </label>
                <select
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-secondary/70 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                >
                  <option value="all">All Products</option>
                  {products.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-40">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Day of Month
                </label>
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-secondary/70 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
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
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60 rounded-lg text-xs font-medium transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>

        {/* Upload Alert */}
        {uploadMessage && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 text-xs font-medium ${
              uploadMessage.type === "success"
                ? "bg-success-soft border-success/30 text-success-soft-foreground"
                : "bg-destructive-soft border-destructive/30 text-destructive-soft-foreground"
            }`}
          >
            {uploadMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
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

        {/* Data Table */}
        {loading ? (
          <TableSkeleton rows={6} />
        ) : (
          <TanStackDataTable
            columns={columns}
            data={filteredSales}
            emptyMessage={
              filteredSales.length === 0 && sales.length > 0
                ? "No sales match the selected filters."
                : "No sales recorded yet."
            }
            getRowId={(row) => row._id}
            paginate
          />
        )}

        {/* Import Modal Dialog */}
        {showUploadDialog && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-popover border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-base font-bold text-foreground">
                  Import Sales via Excel
                </h3>
                <button
                  onClick={() => setShowUploadDialog(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Download our formatted Excel template to ensure headers match
                system requirements before uploading your spreadsheet.
              </p>
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="w-full flex items-center justify-center gap-2 border border-border/70 bg-secondary/80 text-foreground px-4 py-2.5 rounded-lg hover:bg-secondary transition-all text-xs font-semibold disabled:opacity-50"
                >
                  {downloadingTemplate ? (
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  ) : (
                    <FileDown className="w-4 h-4 text-accent" />
                  )}
                  <span>
                    {downloadingTemplate
                      ? "Downloading..."
                      : "Download Excel Template"}
                  </span>
                </button>
                <button
                  onClick={handleChooseUpload}
                  className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground px-4 py-2.5 rounded-lg hover:bg-accent/90 transition-all text-xs font-semibold"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose Excel File to Upload</span>
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
