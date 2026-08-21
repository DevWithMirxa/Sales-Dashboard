"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import SalesPersonForm from "@/components/forms/SalesPersonForm";
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
import ConfirmDelete from "@/components/ConfirmDelete";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function Salesmen() {
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSalesman, setEditingSalesman] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null); // { type: 'success' | 'error', text }
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  const fetchSalesmen = async () => {
    try {
      setLoading(true);
      const res = await api.get("/salesmen");
      setSalesmen(res.data);
    } catch (error) {
      console.error("Error fetching salesmen:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesmen();
  }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/salesmen/${id}`);
      fetchSalesmen();
    } catch (error) {
      console.error("Error deleting salesman:", error);
      alert("Failed to delete salesman");
    }
  };

  const handleEdit = (salesman) => {
    setEditingSalesman(salesman);
    setShowForm(true);
  };

  const salesmanColumns = [
    { label: "Name", key: "name" },
    { label: "Designation", key: "designation" },
    { label: "Region", key: "area" },
    { label: "Mobile", key: "contactNumber" },
    { label: "Email", key: "email" },
    {
      label: "Status",
      value: (row) => (row.status === "inactive" ? "Inactive" : "Active"),
    },
  ];

  const handleExportExcel = () => {
    exportToCSV(salesmen, salesmanColumns, "salesmen");
  };

  const handleExportPDF = () => {
    exportToPDF(salesmen, salesmanColumns, {
      title: "Sales Team",
      subtitle: "Sales representatives",
      filename: "salesmen",
    });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSalesman(null);
  };

  const handleUploadClick = () => {
    setShowUploadDialog(false);
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await api.get("/salesmen/upload-template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "salesmen-upload-template.xlsx");
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
    e.target.value = ""; // reset so selecting the same file again still fires onChange
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/salesmen/upload", formData, {
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
      fetchSalesmen();
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
        accessorKey: "name",
        header: "Name",
        cell: ({ getValue }) => getValue(),
        meta: {
          headerClassName: "w-[22%]",
          cellClassName: "w-[22%] text-gray-900",
        },
      },
      {
        accessorKey: "designation",
        header: "Designation",
        meta: {
          headerClassName: "w-[18%]",
          cellClassName: "w-[18%]",
        },
      },
      {
        accessorKey: "area",
        header: "Region",
        meta: {
          headerClassName: "w-[16%]",
          cellClassName: "w-[16%]",
        },
      },
      {
        accessorKey: "contactNumber",
        header: "Mobile",
        meta: {
          headerClassName: "w-[16%]",
          cellClassName: "w-[16%]",
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const isActive = (getValue() || "active") === "active";
          return (
            <Badge
              className={
                isActive
                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-100"
              }
            >
              {isActive ? "Active" : "Inactive"}
            </Badge>
          );
        },
        meta: {
          headerClassName: "w-[14%]",
          cellClassName: "w-[14%]",
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: {
          headerClassName: "w-[14%]",
          cellClassName: "w-[14%]",
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
              title="Delete salesman"
              description="Are you sure you want to delete this salesman? This action cannot be undone."
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
          <h1 className="text-lg font-bold text-gray-900">Sales Team</h1>
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
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 text-xs"
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
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs"
            >
              <Plus className="w-5 h-5" />
              Add Salesman
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
              <DialogTitle>Upload Salesmen from Excel</DialogTitle>
              <DialogDescription>
                Not sure of the exact column names? Download the format file
                first — it has the correct headers plus one real example row, so
                the upload can't fail because of a mismatched column name.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 text-xs"
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
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                <Upload className="w-5 h-5" />
                Browse Excel File
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <TanStackDataTable
          columns={columns}
          data={salesmen}
          loading={loading}
          emptyMessage="No salesmen found."
          getRowId={(row) => row._id}
          paginate
        />

        {/* Form Modal */}
        {showForm && (
          <SalesPersonForm
            onClose={handleCloseForm}
            initialData={editingSalesman}
            onSuccess={fetchSalesmen}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

export default function SalesmenPage() {
  return (
    <ProtectedRoute>
      <Salesmen />
    </ProtectedRoute>
  );
}
