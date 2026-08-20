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
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";

function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null); // { type: 'success' | 'error', text }
  const fileInputRef = useRef(null);

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

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this sale?")) {
      try {
        await api.delete(`/sales/${id}`);
        fetchSales();
      } catch (error) {
        console.error("Error deleting sale:", error);
        alert("Failed to delete sale");
      }
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
    exportToCSV(sales, saleColumns, "sales");
  };

  const handleExportPDF = () => {
    exportToPDF(sales, saleColumns, {
      title: "Sales",
      subtitle: "Sales records",
      filename: "sales",
    });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSale(null);
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
          headerClassName: "w-[9%]",
          cellClassName: "w-[9%]",
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
          headerClassName: "w-[13%]",
          cellClassName: "w-[13%]",
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
        cell: ({ getValue }) => `${(getValue() || 0).toLocaleString()}`,
        meta: {
          headerClassName: "w-[15%]",
          cellClassName: "w-[15%] font-semibold text-gray-900",
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
            <button
              onClick={() => handleDelete(row.original._id)}
              className="text-red-600 hover:text-red-900"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
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
          <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
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
              Add Sales
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

        <TanStackDataTable
          columns={columns}
          data={sales}
          loading={loading}
          emptyMessage="No sales recorded yet."
          getRowId={(row) => row._id}
        />

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
