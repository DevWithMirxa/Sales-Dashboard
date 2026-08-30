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
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Wallet,
  MapPin,
  StickyNote,
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
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

// Small label+value block used inside the expanded row - same idea as the
// Business Directory page's detail grid.
const DetailItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2">
    {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />}
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-900 wrap-break-word">{value ?? "-"}</p>
    </div>
  </div>
);

function Recovery() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null); // { type: 'success' | 'error', text }
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
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

  const toggleExpanded = (record) => {
    setExpandedId((prev) => (prev === record._id ? null : record._id));
  };

  const renderRecoveryDetails = (record, colSpanCount) => (
    <TableRow className="bg-gray-50 hover:bg-gray-50">
      <TableCell colSpan={colSpanCount} className="px-5 py-4 whitespace-normal">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem
            icon={CalendarDays}
            label="Invoice Date"
            value={formatDate(record.invoiceDate)}
          />
          <DetailItem
            icon={CalendarDays}
            label="Due Date"
            value={formatDate(record.dueDate)}
          />
          <DetailItem
            icon={CalendarDays}
            label="Recovery Date"
            value={
              record.recoveryDate
                ? formatDate(record.recoveryDate)
                : "Not yet recovered"
            }
          />
          <DetailItem
            icon={Wallet}
            label="Invoice Amount (Rs)"
            value={(record.invoiceAmount || 0).toLocaleString()}
          />
          <DetailItem
            icon={Wallet}
            label="Amount Recovered (Rs)"
            value={(record.amountRecovered || 0).toLocaleString()}
          />
          <DetailItem icon={MapPin} label="Region" value={record.region} />
          {record.notes && (
            <div className="sm:col-span-2 lg:col-span-3">
              <DetailItem
                icon={StickyNote}
                label="Notes"
                value={record.notes}
              />
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

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
        id: "expand",
        header: "",
        enableSorting: false,
        meta: {
          headerClassName: "w-[5%]",
          cellClassName: "w-[5%] text-gray-400",
        },
        cell: ({ row }) =>
          expandedId === row.original._id ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      },
      {
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        meta: {
          headerClassName: "w-[12%]",
          cellClassName: "w-[12%] text-gray-900 font-medium",
        },
      },
      {
        accessorKey: "salesperson",
        header: "Salesperson",
        meta: { headerClassName: "w-[15%]", cellClassName: "w-[15%]" },
      },
      {
        accessorKey: "customer",
        header: "Customer",
        meta: { headerClassName: "w-[18%]", cellClassName: "w-[18%]" },
      },
      {
        accessorKey: "balance",
        header: "Balance (Rs)",
        cell: ({ getValue }) => (getValue() || 0).toLocaleString(),
        meta: {
          headerClassName: "w-[13%]",
          cellClassName: "w-[13%] font-semibold text-gray-900",
        },
      },
      {
        accessorKey: "daysOverdue",
        header: "Days Overdue",
        cell: ({ getValue }) => {
          const days = getValue() || 0;
          return days > 0 ? (
            <span className="font-medium text-red-600">{days}</span>
          ) : (
            <span className="text-gray-400">-</span>
          );
        },
        meta: { headerClassName: "w-[10%]", cellClassName: "w-[10%]" },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue() || "Pending";
          return <Badge className={STATUS_STYLES[status]}>{status}</Badge>;
        },
        meta: { headerClassName: "w-[12%]", cellClassName: "w-[12%]" },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: { headerClassName: "w-[15%]", cellClassName: "w-[15%]" },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row.original);
              }}
              className="text-blue-600 hover:text-blue-900"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.original._id);
              }}
              className="text-red-600 hover:text-red-900"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [expandedId],
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
              className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading ? "Uploading..." : "Upload Excel File"}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm px-2 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
          onRowClick={toggleExpanded}
          rowClassName="cursor-pointer"
          renderSubRow={(record, visibleColumns) =>
            expandedId === record._id
              ? renderRecoveryDetails(record, visibleColumns)
              : null
          }
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
