"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import TargetForm from "@/components/forms/TargetForm";
import TanStackDataTable from "@/components/TanStackDataTable";
import {
  Plus,
  Trash2,
  Edit2,
  Package,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileDown,
  Building2,
  MapPin,
  CalendarDays,
  Eye,
  Target as TargetIcon,
  Users,
  DollarSign,
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import ConfirmDelete from "@/components/ConfirmDelete";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { KPISkeleton } from "@/components/ui/skeleton";

// Compact a number into a short, human-friendly string, e.g.
// 30,820,000 -> "30.82 M" and 21,700 -> "21.7 K".
const formatCompact = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
  return `${Math.round(n)}`;
};

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

function Targets() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTarget, setExpandedTarget] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null); // { type: 'success' | 'error', text }
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const res = await api.get("/targets");
      // controller responds with { success, count, data: [...] }
      setTargets(res.data.data || []);
    } catch (error) {
      console.error("Error fetching targets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/targets/${id}`);
      fetchTargets();
    } catch (error) {
      console.error("Error deleting target:", error);
      alert("Failed to delete target");
    }
  };

  // Removing a single product from a target means re-saving the target with
  // that product filtered out, since products live inside the Target document.
  const handleDeleteProduct = async (target, productIndex) => {
    try {
      const updatedProducts = target.products
        .filter((_, i) => i !== productIndex)
        .map((p) => ({
          product: p.product?._id || p.product,
          targetQuantity: p.targetQuantity,
          targetRevenue: p.targetRevenue,
          unit: p.unit,
        }));

      if (updatedProducts.length === 0) {
        alert(
          "A target must have at least one product. Delete the whole target assignment instead.",
        );
        return;
      }

      await api.put(`/targets/${target._id}`, {
        targetName: target.targetName,
        period: target.period,
        assignedTo: target.assignedTo?._id || target.assignedTo,
        region: target.region || "",
        products: updatedProducts,
        status: target.status,
      });
      fetchTargets();
    } catch (error) {
      console.error("Error removing product from target:", error);
      alert("Failed to remove product");
    }
  };

  const handleEdit = (target) => {
    setEditingTarget(target);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTarget(null);
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
      const res = await api.get("/targets/upload-template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "targets-upload-template.xlsx");
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
      const res = await api.post("/targets/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const {
        inserted = 0,
        updated = 0,
        skipped = 0,
        totalRows = 0,
      } = res.data || {};
      setUploadMessage({
        type: "success",
        text: `Imported ${inserted + updated} target${
          inserted + updated === 1 ? "" : "s"
        } from ${totalRows} rows (${inserted} new, ${updated} updated${
          skipped ? `, ${skipped} skipped` : ""
        }).`,
      });
      fetchTargets();
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

  const calculateTotalRevenue = (products) =>
    products.reduce((sum, p) => sum + (p.targetRevenue || 0), 0);
  const calculateTotalQuantity = (products) =>
    products.reduce((sum, p) => sum + (p.targetQuantity || 0), 0);
  const getStatusConfig = (status) => {
    const normalized = String(status || "active").toLowerCase();

    if (normalized === "inactive") {
      return {
        label: "Inactive",
        className: "bg-muted text-muted-foreground border border-border",
      };
    }

    if (normalized === "completed") {
      return {
        label: "Completed",
        className: "bg-chart-1/20 text-chart-1 border border-chart-1/30",
      };
    }

    return {
      label: "Active",
      className: "bg-success/20 text-success border border-success/30",
    };
  };

  const getProductColumns = (target) => [
    {
      id: "productName",
      header: "Product Name",
      accessorFn: (item) => item.product?.name || "Unknown product",
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Package className="w-4 h-4 text-accent" />
          {getValue()}
        </div>
      ),
      meta: { cellClassName: "text-foreground font-medium" },
    },
    {
      accessorKey: "targetQuantity",
      header: "Target Quantity",
      cell: ({ getValue }) => formatCompact(getValue() || 0),
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center whitespace-nowrap",
      },
    },
    {
      accessorKey: "targetRevenue",
      header: "Target Revenue (Rs)",
      cell: ({ getValue }) => formatCompact(getValue() || 0),
      meta: {
        headerClassName: "text-right whitespace-nowrap",
        cellClassName:
          "text-center font-semibold text-foreground whitespace-nowrap",
      },
    },
    {
      accessorKey: "unit",
      header: "Unit",
      meta: {
        headerClassName: "text-right whitespace-nowrap",
        cellClassName: "text-left  whitespace-nowrap",
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      meta: {
        headerClassName: "text-right",
        cellClassName: "text-left",
      },
      cell: ({ row }) => (
        <ConfirmDelete
          title="Remove product"
          description="Are you sure you want to remove this product from the target?"
          onConfirm={() =>
            handleDeleteProduct(target, row.original.__targetIndex)
          }
        >
          <button
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive-soft-foreground"
            title="Remove"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </ConfirmDelete>
      ),
    },
  ];

  const targetColumns = [
    { label: "Salesman", value: (t) => t.assignedTo?.name || "Unassigned" },
    { label: "Target Name", key: "targetName" },
    { label: "Period", key: "period" },
    {
      label: "Region",
      value: (t) => t.region || t.assignedTo?.area || "-",
    },
    { label: "Status", value: (t) => getStatusConfig(t.status).label },
    { label: "Products", value: (t) => t.products?.length || 0 },
    {
      label: "Total Quantity",
      value: (t) => t.totalQuantity || calculateTotalQuantity(t.products || []),
    },
    {
      label: "Total Revenue (Rs)",
      value: (t) => t.totalRevenue || calculateTotalRevenue(t.products || []),
    },
  ];

  const handleExportExcel = () => {
    exportToCSV(targets, targetColumns, "sales-targets");
  };

  const handleExportPDF = () => {
    exportToPDF(targets, targetColumns, {
      title: "Sales Targets",
      subtitle: "Target assignments",
      filename: "sales-targets",
    });
  };

  // Summary stats derived from the loaded targets.
  const stats = useMemo(() => {
    const totalTargets = targets.length;
    const activeCount = targets.filter(
      (t) => String(t.status || "active").toLowerCase() === "active",
    ).length;
    const salespeopleCount = new Set(
      targets
        .map((t) => t.assignedTo?._id || t.assignedTo?.name)
        .filter(Boolean),
    ).size;
    const totalRevenue = targets.reduce(
      (sum, t) =>
        sum + (t.totalRevenue || calculateTotalRevenue(t.products || [])),
      0,
    );
    return { totalTargets, activeCount, salespeopleCount, totalRevenue };
  }, [targets]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-lg font-bold text-accent">Sales Targets</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Set and monitor product-level goals for every sales territory.
            </p>
          </div>
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
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-accent disabled:opacity-60"
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
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              <Plus className="w-5 h-5" />
              Assign Target
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            label="Total Targets"
            value={stats.totalTargets}
            icon={TargetIcon}
            colorClass="text-foreground"
          />
          <StatCard
            label="Active Targets"
            value={stats.activeCount}
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
            label="Total Target Revenue"
            value={`Rs ${formatCompact(stats.totalRevenue)}`}
            icon={DollarSign}
            colorClass="text-chart-3"
          />
        </div>

        {/* Upload result banner */}
        {uploadMessage && (
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
              uploadMessage.type === "success"
                ? "bg-success-soft border-success/30 text-success-soft-foreground"
                : "bg-destructive-soft border-destructive/30 text-destructive-soft-foreground"
            }`}
          >
            {uploadMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-success" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-destructive" />
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

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <KPISkeleton key={i} />
            ))}
          </div>
        )}

        {/* Territory board — target cards follow the v0 pipeline layout. */}
        {!loading &&
          targets.length > 0 &&
          (() => {
            const regions = Object.values(
              targets.reduce((groups, target) => {
                const name =
                  target.region ||
                  target.assignedTo?.area ||
                  "Unassigned region";
                if (!groups[name])
                  groups[name] = { name, targets: [], revenue: 0 };
                groups[name].targets.push(target);
                groups[name].revenue +=
                  target.totalRevenue ||
                  calculateTotalRevenue(target.products || []);
                return groups;
              }, {}),
            );
            const selectedTarget = targets.find(
              (target) => target._id === expandedTarget,
            );

            return (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Manage targets by territory and open a card to view its
                  product plan.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                  {regions.map((region) => (
                    <section
                      key={region.name}
                      className="min-h-65 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <h2 className="truncate text-sm font-semibold text-foreground">
                            {region.name}
                          </h2>
                          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {region.targets.length}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          Rs. {formatCompact(region.revenue)}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {region.targets.map((target) => {
                          const salesmanName =
                            target.assignedTo?.name || "Unassigned";
                          const totalRevenue =
                            target.totalRevenue ||
                            calculateTotalRevenue(target.products || []);
                          const status = getStatusConfig(target.status);
                          const isOpen = expandedTarget === target._id;
                          return (
                            <React.Fragment key={target._id}>
                              <article
                                className={`rounded-lg border mt-3 bg-background p-4 transition-all ${isOpen ? "border-accent ring-1 ring-accent/30" : "border-border hover:border-accent/50"}`}
                              >
                                <div className="mb-3 flex items-start gap-2">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
                                    <TargetIcon className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                      {target.targetName || salesmanName}
                                    </p>
                                    {target.targetName && (
                                      <p className="truncate text-xs text-muted-foreground">
                                        {salesmanName}
                                      </p>
                                    )}
                                  </div>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}
                                  >
                                    {status.label}
                                  </span>
                                </div>
                                <p className="mb-3 text-sm font-semibold text-foreground">
                                  <span className="mr-2 text-accent">Rs.</span>
                                  {formatCompact(totalRevenue)}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1.5 truncate">
                                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                                    {target.products?.length || 0} products
                                  </span>
                                  <span className="flex items-center gap-1.5 truncate">
                                    <CalendarDays className="h-3.5 w-3.5 shrink-0 ml-36" />
                                    {target.period}
                                  </span>
                                </div>
                                <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
                                  <button
                                    onClick={() => handleEdit(target)}
                                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    title="Edit target"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <ConfirmDelete
                                    title="Delete target"
                                    description="Are you sure you want to delete this target assignment? This action cannot be undone."
                                    onConfirm={() => handleDelete(target._id)}
                                  >
                                    <button
                                      className="rounded p-1 text-muted-foreground hover:bg-destructive-soft hover:text-accent"
                                      title="Delete target"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </ConfirmDelete>
                                  <button
                                    onClick={() =>
                                      setExpandedTarget(
                                        isOpen ? null : target._id,
                                      )
                                    }
                                    className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-secondary hover:text-accent"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    {isOpen ? "Hide details" : "View details"}
                                  </button>
                                </div>
                              </article>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
                <Sheet
                  open={Boolean(selectedTarget)}
                  onOpenChange={(open) => !open && setExpandedTarget(null)}
                >
                  <SheetContent
                    side="right"
                    className="w-full gap-0 overflow-y-auto p-0 sm:max-w-3xl!"
                  >
                    {selectedTarget && (
                      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <SheetTitle className="sr-only">
                          {selectedTarget.targetName ||
                            selectedTarget.assignedTo?.name ||
                            "Target details"}
                        </SheetTitle>
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {selectedTarget.targetName ||
                                selectedTarget.assignedTo?.name ||
                                "Target details"}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              {selectedTarget.region ||
                                selectedTarget.assignedTo?.area ||
                                "Unassigned region"}{" "}
                              · {selectedTarget.period} target
                            </p>
                          </div>
                          <button
                            onClick={() => setExpandedTarget(null)}
                            className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-accent"
                          >
                            Hide details
                          </button>
                        </div>
                        <TanStackDataTable
                          columns={getProductColumns(selectedTarget)}
                          data={(selectedTarget.products || []).map(
                            (product, index) => ({
                              ...product,
                              __targetIndex: index,
                            }),
                          )}
                          emptyMessage="No products found for this target."
                          getRowId={(row) =>
                            row.product?._id || String(row.__targetIndex)
                          }
                          paginate
                          defaultPageSize={5}
                          wrapperClassName="overflow-hidden rounded-none border-0 bg-transparent shadow-none"
                        />
                        <div className="flex flex-col gap-2 border-t border-border bg-secondary/40 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-medium text-foreground">
                            Total quantity:{" "}
                            {formatCompact(
                              selectedTarget.totalQuantity ||
                                calculateTotalQuantity(
                                  selectedTarget.products || [],
                                ),
                            )}{" "}
                            {selectedTarget.products?.[0]?.unit || ""}
                          </span>
                          <span className="font-semibold text-accent">
                            Total revenue: Rs.{" "}
                            {formatCompact(
                              selectedTarget.totalRevenue ||
                                calculateTotalRevenue(
                                  selectedTarget.products || [],
                                ),
                            )}
                          </span>
                        </div>
                      </section>
                    )}
                  </SheetContent>
                </Sheet>
              </div>
            );
          })()}

        {/* Legacy row list retained temporarily but never rendered. */}
        {false && !loading && (
          <>
            <div className="space-y-3">
              {pagedTargets.map((target) => {
                const salesmanName = target.assignedTo?.name || "Unassigned";
                const salesmanInitial = salesmanName.charAt(0).toUpperCase();
                const statusConfig = getStatusConfig(target.status);
                // region is a plain string on the target; fall back to the salesman's area if not set
                const regionLabel =
                  target.region || target.assignedTo?.area || "-";

                return (
                  <div
                    key={target._id}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    {/* Compact target summary */}
                    <div className="px-5 py-4 sm:px-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                              <span className="text-blue-600 font-semibold text-sm">
                                {salesmanInitial}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="truncate text-base font-semibold text-gray-900">
                                  {salesmanName}
                                  {target.targetName ? (
                                    <span className="ml-2 text-sm font-normal text-gray-500">
                                      ({target.targetName})
                                    </span>
                                  ) : null}
                                </h3>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.className}`}
                                >
                                  {statusConfig.label}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                <span>Region: {regionLabel}</span>
                                <span>{target.period}</span>
                                <span>{target.products.length} Products</span>
                                <span className="font-semibold text-blue-600">
                                  Rs.{" "}
                                  {formatCompact(
                                    target.totalRevenue ||
                                      calculateTotalRevenue(target.products),
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 self-end lg:self-auto">
                          <button
                            onClick={() => handleEdit(target)}
                            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-50"
                            title="Edit"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <ConfirmDelete
                            title="Delete target"
                            description="Are you sure you want to delete this target assignment? This action cannot be undone."
                            onConfirm={() => handleDelete(target._id)}
                          >
                            <button
                              className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </ConfirmDelete>
                          <button
                            onClick={() =>
                              setExpandedTarget(
                                expandedTarget === target._id
                                  ? null
                                  : target._id,
                              )
                            }
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                              expandedTarget === target._id
                                ? "border border-green-600 bg-green-50 text-green-700 hover:bg-green-100"
                                : "text-blue-600 hover:bg-blue-50"
                            }`}
                          >
                            {expandedTarget === target._id ? "Hide" : "View"}{" "}
                            Details
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Products List - Expandable */}
                    {expandedTarget === target._id && (
                      <div className="bg-gray-50 border-t border-gray-200">
                        <TanStackDataTable
                          columns={getProductColumns(target)}
                          data={target.products.map((product, index) => ({
                            ...product,
                            __targetIndex: index,
                          }))}
                          emptyMessage="No products found for this target."
                          getRowId={(row) =>
                            row.product?._id || String(row.__targetIndex)
                          }
                          paginate
                          defaultPageSize={5}
                          wrapperClassName="overflow-hidden"
                        />

                        {/* Footer Summary */}
                        <div className="px-6 py-4 bg-gray-100 border-t border-gray-200 flex justify-between items-center">
                          <div className="ml-24 text-sm font-semibold text-gray-900">
                            Total Quantity:{" "}
                            {formatCompact(
                              target.totalQuantity ||
                                calculateTotalQuantity(target.products),
                            )}{" "}
                            {target.products[0]?.unit}
                          </div>
                          <div className="mx-auto text-lg font-bold text-blue-600">
                            Total Revenue: Rs.{" "}
                            {formatCompact(
                              target.totalRevenue ||
                                calculateTotalRevenue(target.products),
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {targets.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span>Targets per page</span>
                  <select
                    value={targetPageSize}
                    onChange={(e) => {
                      setTargetPageSize(Number(e.target.value));
                      setTargetPage(0);
                    }}
                    className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[5, 10, 25].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span>
                    {targets.length === 0
                      ? "0 of 0 targets"
                      : `${targetPage * targetPageSize + 1}-${Math.min(
                          (targetPage + 1) * targetPageSize,
                          targets.length,
                        )} of ${targets.length} targets`}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTargetPage(0)}
                    disabled={targetPage === 0}
                    className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTargetPage((p) => Math.max(0, p - 1))}
                    disabled={targetPage === 0}
                    className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2">
                    Page {targetPage + 1} of {targetPageCount}
                  </span>
                  <button
                    onClick={() =>
                      setTargetPage((p) => Math.min(targetPageCount - 1, p + 1))
                    }
                    disabled={targetPage === targetPageCount - 1}
                    className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTargetPage(targetPageCount - 1)}
                    disabled={targetPage === targetPageCount - 1}
                    className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && targets.length === 0 && (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-2">
              No targets assigned yet
            </h3>
            <p className="text-muted-foreground mb-6">
              Start by creating target assignments for your salesmen
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-lg hover:bg-accent/90 transition-colors text-xs"
            >
              <Plus className="w-5 h-5" />
              Assign First Target
            </button>
          </div>
        )}
      </div>

      {/* Browse Excel dialog - download a correctly-formatted template, or
          go straight to picking a file to upload */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-popover border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-border/60">
              <h3 className="text-base font-semibold text-foreground">
                Import Targets
              </h3>
              <button
                onClick={() => setShowUploadDialog(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Not sure about the column headers? Download the format file
                first — it has the exact headers we expect, plus one example
                row.
              </p>
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="w-full flex items-center justify-center gap-2 border border-border/70 bg-secondary/80 text-foreground px-4 py-3 rounded-lg hover:bg-secondary transition-colors disabled:opacity-60 text-xs font-semibold"
              >
                {downloadingTemplate ? (
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                ) : (
                  <FileDown className="w-5 h-5 text-accent" />
                )}
                {downloadingTemplate
                  ? "Downloading..."
                  : "Download Format File"}
              </button>
              <button
                onClick={handleChooseUpload}
                className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground px-4 py-3 rounded-lg hover:bg-accent/90 transition-colors text-xs font-semibold"
              >
                <Upload className="w-5 h-5" />
                Upload Excel File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target Form Modal */}
      {showForm && (
        <TargetForm
          onClose={handleCloseForm}
          editingTarget={editingTarget}
          onSuccess={fetchTargets}
        />
      )}
    </DashboardLayout>
  );
}

export default function TargetsPage() {
  return (
    <ProtectedRoute>
      <Targets />
    </ProtectedRoute>
  );
}
