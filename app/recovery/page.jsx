"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import RecoveryForm from "@/components/forms/RecoveryForm";
import TanStackDataTable from "@/components/TanStackDataTable";
import { TableSkeleton } from "@/components/ui/skeleton";
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
  Search,
  SlidersHorizontal,
  RotateCcw,
  DollarSign,
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TableRow, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  Paid: "border-0 bg-green-500/15 text-green-400 hover:bg-green-500/15",
  Partial: "border-0 bg-amber-500/15 text-amber-400 hover:bg-amber-500/15",
  Overdue: "border-0 bg-red-500/15 text-red-400 hover:bg-red-500/15",
  Pending: "border-0 bg-secondary text-muted-foreground hover:bg-secondary",
};

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : "-");

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

// Small label+value block used inside the expanded row - same idea as the
// Business Directory page's detail grid.
const DetailItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2">
    {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground wrap-break-word">{value ?? "-"}</p>
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [selectedSalesperson, setSelectedSalesperson] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
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
    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
      <TableCell colSpan={colSpanCount} className="px-5 py-5 whitespace-normal">
        <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
          <p className="text-sm font-semibold text-foreground">
            Recovery details
          </p>
          <span className="text-xs text-muted-foreground">
            {record.invoiceNumber}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

  const regions = useMemo(
    () =>
      [
        ...new Set(records.map((record) => record.region).filter(Boolean)),
      ].sort(),
    [records],
  );
  const salespeople = useMemo(
    () =>
      [
        ...new Set(records.map((record) => record.salesperson).filter(Boolean)),
      ].sort(),
    [records],
  );
  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSearch =
        !query ||
        [
          record.invoiceNumber,
          record.customer,
          record.salesperson,
          record.region,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        );
      const matchesStatus =
        statusFilter === "All" || record.status === statusFilter;
      const matchesRegion =
        selectedRegion === "All" || record.region === selectedRegion;
      const matchesSalesperson =
        selectedSalesperson === "All" ||
        record.salesperson === selectedSalesperson;
      return (
        matchesSearch && matchesStatus && matchesRegion && matchesSalesperson
      );
    });
  }, [records, searchTerm, selectedRegion, selectedSalesperson, statusFilter]);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setSelectedRegion("All");
    setSelectedSalesperson("All");
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

  // Summary stats derived from the full (unfiltered) dataset.
  const stats = useMemo(() => {
    const totalRecords = records.length;
    const paidCount = records.filter((r) => r.status === "Paid").length;
    const overdueCount = records.filter((r) => r.status === "Overdue").length;
    const totalBalance = records.reduce((sum, r) => sum + (r.balance || 0), 0);
    return { totalRecords, paidCount, overdueCount, totalBalance };
  }, [records]);

  const columns = useMemo(
    () => [
      {
        id: "expand",
        header: "",
        enableSorting: false,
        meta: {
          headerClassName: "w-[5%]",
          cellClassName: "w-[5%] text-muted-foreground",
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
        header: "Invoice",
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{getValue()}</span>
        ),
        meta: {
          headerClassName: "w-[12%]",
          cellClassName: "w-[12%]",
        },
      },
      {
        accessorKey: "customer",
        header: "Customer",
        cell: ({ row, getValue }) => (
          <div>
            <p className="font-medium text-foreground">{getValue()}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.original.region}
            </p>
          </div>
        ),
        meta: { headerClassName: "w-[20%]", cellClassName: "w-[20%]" },
      },
      {
        accessorKey: "balance",
        header: "Balance (Rs)",
        cell: ({ getValue }) => (getValue() || 0).toLocaleString(),
        meta: {
          headerClassName: "w-[13%]",
          cellClassName: "w-[13%] font-semibold text-foreground",
        },
      },
      {
        accessorKey: "daysOverdue",
        header: "Days Overdue",
        cell: ({ getValue }) => {
          const days = getValue() || 0;
          return days > 0 ? (
            <span className="font-medium text-red-400">{days}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
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
        accessorKey: "salesperson",
        header: "Salesperson",
        meta: { headerClassName: "w-[15%]", cellClassName: "w-[15%]" },
      },
      {
        accessorKey: "dueDate",
        header: "Due date",
        cell: ({ getValue }) => formatDate(getValue()),
        meta: {
          headerClassName: "w-[12%]",
          cellClassName: "w-[12%] whitespace-nowrap",
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: { headerClassName: "w-[8%]", cellClassName: "w-[8%]" },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row.original);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.original._id);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-destructive-soft hover:text-destructive-soft-foreground"
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
          <div>
            <h1 className="text-xl font-bold text-accent">Recovery</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage all outstanding invoice recoveries in one place.
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
              onClick={() => setShowUploadDialog(true)}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-accent disabled:opacity-60"
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
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              <Plus className="w-4 h-4" />
              Add Recovery
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            label="Total Invoices"
            value={stats.totalRecords}
            icon={Wallet}
            colorClass="text-foreground"
          />
          <StatCard
            label="Paid"
            value={stats.paidCount}
            icon={CheckCircle2}
            colorClass="text-green-400"
          />
          <StatCard
            label="Overdue"
            value={stats.overdueCount}
            icon={AlertCircle}
            colorClass="text-red-400"
          />
          <StatCard
            label="Outstanding Balance"
            value={`Rs ${stats.totalBalance.toLocaleString()}`}
            icon={DollarSign}
            colorClass="text-amber-400"
          />
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

        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search invoices..."
                  className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent sm:w-56"
                />
              </label>
              {["All", "Paid", "Partial", "Overdue", "Pending"].map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${statusFilter === status ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-accent"}`}
                  >
                    {status}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={() => setShowFilters((open) => !open)}
              className={`flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-xs font-medium transition-colors lg:self-auto ${showFilters ? "border-accent bg-secondary text-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-accent"}`}
            >
              <SlidersHorizontal className="h-4 w-4 " /> More filters
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Region
                <select
                  value={selectedRegion}
                  onChange={(event) => setSelectedRegion(event.target.value)}
                  className="min-w-44 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  <option value="All">All regions</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Salesperson
                <select
                  value={selectedSalesperson}
                  onChange={(event) =>
                    setSelectedSalesperson(event.target.value)
                  }
                  className="min-w-44 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  <option value="All">All salespeople</option>
                  {salespeople.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          )}

          {loading ? (
            <TableSkeleton rows={8} />
          ) : (
            <TanStackDataTable
              columns={columns}
              data={filteredRecords}
              emptyMessage="No recovery records match these filters."
              getRowId={(row) => row._id}
              onRowClick={toggleExpanded}
              rowClassName="cursor-pointer"
              paginate
              defaultPageSize={8}
              renderSubRow={(record, visibleColumns) =>
                expandedId === record._id
                  ? renderRecoveryDetails(record, visibleColumns)
                  : null
              }
            />
          )}
          {!loading && (
            <p className="px-1 text-xs text-muted-foreground">
              Showing {filteredRecords.length} of {records.length} recovery
              records
            </p>
          )}
        </section>

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
