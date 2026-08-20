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
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";

function Targets() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTarget, setExpandedTarget] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null); // { type: 'success' | 'error', text }
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
    if (confirm("Are you sure you want to delete this target assignment?")) {
      try {
        await api.delete(`/targets/${id}`);
        fetchTargets();
      } catch (error) {
        console.error("Error deleting target:", error);
        alert("Failed to delete target");
      }
    }
  };

  // Removing a single product from a target means re-saving the target with
  // that product filtered out, since products live inside the Target document.
  const handleDeleteProduct = async (target, productIndex) => {
    if (
      !confirm("Are you sure you want to remove this product from the target?")
    )
      return;
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

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so selecting the same file again still fires onChange
    if (!file) return;

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
      cell: ({ getValue }) => (getValue() || 0).toLocaleString(),
    },
    {
      accessorKey: "targetRevenue",
      header: "Target Revenue (Rs)",
      cell: ({ getValue }) => `${(getValue() || 0).toLocaleString()}`,
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
        <button
          onClick={() =>
            handleDeleteProduct(target, row.original.__targetIndex)
          }
          className="text-red-600 hover:text-red-700 font-medium"
        >
          Remove
        </button>
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
      value: (t) =>
        t.totalQuantity || calculateTotalQuantity(t.products || []),
    },
    {
      label: "Total Revenue (Rs)",
      value: (t) =>
        t.totalRevenue || calculateTotalRevenue(t.products || []),
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
          <h1 className="text-3xl font-bold text-gray-900">Sales Targets</h1>
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
              onClick={handleUploadClick}
              disabled={uploading}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {uploading ? "Uploading..." : "Upload Excel File"}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
          <div className="space-y-4">
            {targets.map((target) => {
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
                              <h3 className="text-lg font-semibold text-gray-900">
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
                                {(
                                  target.totalRevenue ||
                                  calculateTotalRevenue(target.products)
                                ).toLocaleString()}
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
                        <button
                          onClick={() => handleDelete(target._id)}
                          className="p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
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
                        wrapperClassName="overflow-hidden"
                      />

                      {/* Footer Summary */}
                      <div className="px-6 py-4 bg-gray-100 border-t border-gray-200 flex justify-between items-center">
                        <div className="ml-24 text-sm font-semibold text-gray-900">
                          Total Quantity:{" "}
                          {(
                            target.totalQuantity ||
                            calculateTotalQuantity(target.products)
                          ).toLocaleString()}{" "}
                          {target.products[0]?.unit}
                        </div>
                        <div className="mx-auto text-lg font-bold text-blue-600">
                          Total Revenue: Rs.{" "}
                          {(
                            target.totalRevenue ||
                            calculateTotalRevenue(target.products)
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && targets.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No targets assigned yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start by creating target assignments for your salesmen
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Assign First Target
            </button>
          </div>
        )}
      </div>

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
