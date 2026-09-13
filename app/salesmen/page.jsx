"use client";

import React, { useState, useEffect, useRef } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import SalesPersonForm from "@/components/forms/SalesPersonForm";
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
  Mail,
  MapPin,
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

// Purely presentational - turns "Dr. Abdul Rehman" into "AR" for the avatar
// circle. Doesn't touch any data, just derives a display label.
const HONORIFIC_WORDS = new Set([
  "dr",
  "mr",
  "mrs",
  "ms",
  "engr",
  "eng",
  "prof",
]);

const getInitials = (name) => {
  const words = String(name || "")
    .replace(/\./g, "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !HONORIFIC_WORDS.has(word.toLowerCase()));

  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

function SalesmanCard({ person, index, onEdit, onDelete }) {
  const isActive = (person.status || "active") === "active";
  const hasPhone = Boolean(
    person.contactNumber && person.contactNumber !== "N/A",
  );
  const hasEmail = Boolean(person.email);
  const initials = getInitials(person.name);
  const phoneHref = hasPhone ? `tel:${person.contactNumber}` : undefined;

  return (
    <div
      className="group animate-in fade-in slide-in-from-bottom-4 rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-accent/50"
      style={{
        animationDelay: `${Math.min(index, 10) * 60}ms`,
        animationFillMode: "both",
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent/80 to-chart-1 text-sm font-bold text-accent-foreground">
            {initials}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {person.name}
            </h4>
            <p className="text-xs text-muted-foreground">
              {person.designation || "—"}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            isActive
              ? "shrink-0 border-success/30 bg-success/10 text-success"
              : "shrink-0 border-border bg-secondary text-muted-foreground"
          }
        >
          {isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-chart-1" />
          {person.area || "Region not set"}
        </span>
        <a
          href={phoneHref}
          onClick={(e) => {
            if (!hasPhone) e.preventDefault();
          }}
          title={
            hasPhone
              ? `Call ${person.contactNumber}`
              : "No phone number on file"
          }
          className={
            hasPhone ? "hover:text-chart-1" : "text-muted-foreground/40"
          }
        >
          {hasPhone ? person.contactNumber : "No number"}
        </a>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        {/* Tapping this opens a pre-addressed email draft using the real
            data - same behavior as before, just presented as an icon. */}
        <div className="flex items-center gap-2">
          <a
            href={hasEmail ? `mailto:${person.email}` : undefined}
            onClick={(e) => {
              if (!hasEmail) e.preventDefault();
            }}
            title={hasEmail ? `Email ${person.email}` : "No email on file"}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              hasEmail
                ? "bg-secondary text-muted-foreground hover:bg-chart-1/10 hover:text-chart-1"
                : "cursor-not-allowed bg-secondary/50 text-muted-foreground/40"
            }`}
          >
            <Mail className="h-4 w-4" />
          </a>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(person)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-chart-1/10 hover:text-chart-1"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <ConfirmDelete
            title="Delete salesman"
            description="Are you sure you want to delete this salesman? This action cannot be undone."
            onConfirm={() => onDelete(person._id)}
          >
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </ConfirmDelete>
        </div>
      </div>
    </div>
  );
}

function SalesmanCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-secondary" />
        <div className="space-y-2">
          <div className="h-3.5 w-28 rounded bg-secondary" />
          <div className="h-3 w-20 rounded bg-secondary" />
        </div>
      </div>
      <div className="mb-4 h-3 w-24 rounded bg-secondary" />
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-secondary" />
          <div className="h-8 w-8 rounded-lg bg-secondary" />
        </div>
        <div className="flex gap-1">
          <div className="h-8 w-8 rounded-lg bg-secondary" />
          <div className="h-8 w-8 rounded-lg bg-secondary" />
        </div>
      </div>
    </div>
  );
}

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-accent">Sales Team</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your sales representatives and their territories
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton
              variant="solid"
              label="Export Data"
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
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-accent disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Upload Excel File"}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              <Plus className="h-4 w-4" />
              Add Salesman
            </button>
          </div>
        </div>

        {/* Upload result banner */}
        {uploadMessage && (
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
              uploadMessage.type === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive-soft text-destructive-soft-foreground"
            }`}
          >
            {uploadMessage.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            <span className="flex-1">{uploadMessage.text}</span>
            <button
              onClick={() => setUploadMessage(null)}
              className="text-current opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Upload choice dialog */}
        <Dialog
          open={showUploadDialog}
          onOpenChange={(open) => setShowUploadDialog(open)}
        >
          <DialogContent className="border-border bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Upload Salesmen from Excel
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Not sure of the exact column names? Download the format file
                first — it has the correct headers plus one real example row, so
                the upload can't fail because of a mismatched column name.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground disabled:opacity-60"
              >
                {downloadingTemplate ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                {downloadingTemplate
                  ? "Preparing file..."
                  : "Download Format File"}
              </button>
              <button
                onClick={handleUploadClick}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/90"
              >
                <Upload className="h-5 w-5" />
                Browse Excel File
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Salesman cards - replaces the previous table */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SalesmanCardSkeleton key={i} />
            ))}
          </div>
        ) : salesmen.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
            No salesmen found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {salesmen.map((person, index) => (
              <SalesmanCard
                key={person._id}
                person={person}
                index={index}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

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
