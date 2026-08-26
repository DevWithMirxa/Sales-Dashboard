"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import ConfirmDelete from "@/components/ConfirmDelete";

// Compact a number into a short, human-friendly string, e.g.
// 30,820,000 -> "30.82 M" and 21,700 -> "21.7 K".
const formatCompact = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
  return `${Math.round(n)}`;
};

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

  // Client-side pagination for the targets list (shown as cards).
  const [targetPage, setTargetPage] = useState(0);
  const [targetPageSize, setTargetPageSize] = useState(5);

  const targetPageCount = Math.max(
    1,
    Math.ceil(targets.length / targetPageSize),
  );
  const pagedTargets = targets.slice(
    targetPage * targetPageSize,
    (targetPage + 1) * targetPageSize,
  );

  // Keep the current page valid when targets change (e.g. after a delete) or
  // the page size changes.
  useEffect(() => {
    setTargetPage((prev) => Math.min(prev, targetPageCount - 1));
  }, [targets.length, targetPageSize, targetPageCount]);

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
        className: "bg-gray-100 text-gray-700 border border-gray-200",
      };
    }

    if (normalized === "completed") {
      return {
        label: "Completed",
        className: "bg-blue-100 text-blue-700 border border-blue-200",
      };
    }

    return {
      label: "Active",
      className: "bg-green-100 text-green-700 border border-green-200",
    };
  };

  const getProductColumns = (target) => [
    {
      id: "productName",
      header: "Product Name",
      accessorFn: (item) => item.product?.name || "Unknown product",
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2 font-medium text-gray-900">
          <Package className="w-4 h-4 text-blue-600" />
          {getValue()}
        </div>
      ),
      meta: { cellClassName: "text-gray-900 font-medium" },
    },
    {
      accessorKey: "targetQuantity",
      header: "Target Quantity",
      cell: ({ getValue }) => formatCompact(getValue() || 0),
    },
    {
      accessorKey: "targetRevenue",
      header: "Target Revenue (Rs)",
      cell: ({ getValue }) => formatCompact(getValue() || 0),
      meta: { cellClassName: "font-semibold text-gray-900" },
    },
    {
      accessorKey: "unit",
      header: "Unit",
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <ConfirmDelete
          title="Remove product"
          description="Are you sure you want to remove this product from the target?"
          onConfirm={() =>
            handleDeleteProduct(target, row.original.__targetIndex)
          }
        >
          <button
            className="p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900">Sales Targets</h1>
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
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-50 text-xs transition-colors disabled:opacity-60"
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
              Assign Target
            </button>
          </div>
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

        {/* Loading state */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            Loading targets...
          </div>
        )}

        {/* Targets List */}
        {!loading && (
          <>
            <div className="space-y-4">
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
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Header */}
                  <div className="border-b border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {salesmanInitial}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-semibold text-gray-900">
                                {salesmanName}
                                {target.targetName ? (
                                  <span className="ml-2 text-sm font-normal text-gray-500">
                                    ({target.targetName})
                                  </span>
                                ) : null}
                              </h3>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.className}`}
                              >
                                {statusConfig.label}
                              </span>
                            </div>
                            <div className="flex gap-4 text-sm text-gray-600 flex-wrap">
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(target)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
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
                            className="p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </ConfirmDelete>
                        <button
                          onClick={() =>
                            setExpandedTarget(
                              expandedTarget === target._id ? null : target._id,
                            )
                          }
                          className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              No targets assigned yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start by creating target assignments for your salesmen
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-xs"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                Import Targets
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
