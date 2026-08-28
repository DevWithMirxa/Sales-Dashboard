"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import RecoveryForm from "@/components/forms/RecoveryForm";
import TanStackDataTable from "@/components/TanStackDataTable";
import {
  Plus,
  Trash2,
  Edit2,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const STATUS_STYLES = {
  Paid: "bg-green-100 text-green-800 hover:bg-green-100",
  Partial: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  Overdue: "bg-red-100 text-red-800 hover:bg-red-100",
  Pending: "bg-gray-100 text-gray-600 hover:bg-gray-100",
};

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : "-");

function Recovery() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null); // { type: 'success' | 'error', text }
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await api.get("/recovery");
      setRecords(res.data);
    } catch (error) {
      console.error("Error fetching recovery records:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this recovery record?")) {
      try {
        await api.delete(`/recovery/${id}`);
        fetchRecords();
      } catch (error) {
        console.error("Error deleting recovery record:", error);
        alert("Failed to delete recovery record");
      }
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRecord(null);
  };

  const handleUploadClick = () => {
    setShowUploadDialog(false);
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await api.get("/recovery/upload-template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "recovery-upload-template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Failed to download the template file.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/recovery/upload", formData, {
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
        text: `Imported ${inserted + updated} of ${totalRows} rows (${inserted} new, ${updated} updated${
          skipped ? `, ${skipped} skipped` : ""
        }).`,
      });
      fetchRecords();
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

  const recoveryColumns = [
    { label: "Invoice #", key: "invoiceNumber" },
    { label: "Salesperson", key: "salesperson" },
    { label: "Customer", key: "customer" },
    { label: "Region", key: "region" },
    { label: "Invoice Date", value: (r) => formatDate(r.invoiceDate) },
    { label: "Due Date", value: (r) => formatDate(r.dueDate) },
    { label: "Invoice Amount (Rs)", key: "invoiceAmount" },
    { label: "Amount Recovered (Rs)", key: "amountRecovered" },
    { label: "Balance (Rs)", key: "balance" },
    { label: "Days Overdue", key: "daysOverdue" },
    { label: "Status", key: "status" },
    { label: "Recovery Date", value: (r) => formatDate(r.recoveryDate) },
  ];

  const handleExportExcel = () => {
    exportToCSV(records, recoveryColumns, "recovery");
  };

  const handleExportPDF = () => {
    exportToPDF(records, recoveryColumns, {
      title: "Recovery",
      subtitle: "Invoice recovery tracking",
      filename: "recovery",
    });
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        meta: {
          headerClassName: "w-[10%]",
          cellClassName: "w-[10%] text-gray-900 font-medium",
        },
      },
      {
        accessorKey: "salesperson",
        header: "Salesperson",
        meta: { headerClassName: "w-[12%]", cellClassName: "w-[12%]" },
      },
      {
        accessorKey: "customer",
        header: "Customer",
        meta: { headerClassName: "w-[13%]", cellClassName: "w-[13%]" },
      },
      {
        accessorKey: "invoiceDate",
        header: "Invoice Date",
        cell: ({ getValue }) => formatDate(getValue()),
        meta: { headerClassName: "w-[8%]", cellClassName: "w-[8%]" },
      },
      {
        accessorKey: "dueDate",
        header: "Due Date",
        cell: ({ getValue }) => formatDate(getValue()),
        meta: { headerClassName: "w-[8%]", cellClassName: "w-[8%]" },
      },
      {
        accessorKey: "invoiceAmount",
        header: "Invoice (Rs)",
        cell: ({ getValue }) => (getValue() || 0).toLocaleString(),
        meta: { headerClassName: "w-[10%]", cellClassName: "w-[10%]" },
      },
      {
        accessorKey: "amountRecovered",
        header: "Recovered (Rs)",
        cell: ({ getValue }) => (getValue() || 0).toLocaleString(),
        meta: { headerClassName: "w-[10%]", cellClassName: "w-[10%]" },
      },
      {
        accessorKey: "balance",
        header: "Balance (Rs)",
        cell: ({ getValue }) => (getValue() || 0).toLocaleString(),
        meta: {
          headerClassName: "w-[10%]",
          cellClassName: "w-[10%] font-semibold text-gray-900",
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue() || "Pending";
          return <Badge className={STATUS_STYLES[status]}>{status}</Badge>;
        },
        meta: { headerClassName: "w-[9%]", cellClassName: "w-[9%]" },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: { headerClassName: "w-[10%]", cellClassName: "w-[10%]" },
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
          <h1 className="text-xl font-bold text-gray-900">Recovery</h1>
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
              onClick={() => setShowUploadDialog(true)}
              disabled={uploading}
              className="flex items-center text-sm gap-2 border border-gray-300 text-gray-700 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading ? "Uploading..." : "Upload Excel File"}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm bg-blue-600 text-white px-2 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Recovery
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

        {/* Upload choice dialog */}
        <Dialog
          open={showUploadDialog}
          onOpenChange={(open) => setShowUploadDialog(open)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Recovery Records from Excel</DialogTitle>
              <DialogDescription>
                Not sure of the exact column names? Download the format file
                first — it has the correct headers plus one real example row.
                Note: Balance, Days Overdue, and Status are always calculated
                automatically and don't need to be filled in.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                {downloadingTemplate ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                {downloadingTemplate
                  ? "Preparing file..."
                  : "Download Format File"}
              </button>
              <button
                onClick={handleUploadClick}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-5 h-5" />
                Browse Excel File
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <TanStackDataTable
          columns={columns}
          data={records}
          loading={loading}
          emptyMessage="No recovery records found."
          getRowId={(row) => row._id}
        />

        {/* Form Modal */}
        {showForm && (
          <RecoveryForm
            onClose={handleCloseForm}
            initialData={editingRecord}
            onSuccess={fetchRecords}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

export default function RecoveryPage() {
  return (
    <ProtectedRoute>
      <Recovery />
    </ProtectedRoute>
  );
}
