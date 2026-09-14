"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import ConfirmDelete from "@/components/ConfirmDelete";
import DirectoryForm from "@/components/forms/DirectoryForm";
import axios from "axios";
import {
  Search,
  Factory,
  MapPin,
  Phone,
  Mail,
  Package,
  User,
  Star,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KPISkeleton } from "@/components/ui/skeleton";

const showValue = (v) => (v === null || v === undefined || v === "" ? "-" : v);
const hasValue = (v) =>
  v !== null && v !== undefined && String(v).trim() !== "";

// The primary contact, falling back to the first contact if none is
// flagged primary (shouldn't normally happen - the form always keeps one
// contact marked primary - but this keeps the card from showing nothing).
const getPrimaryContact = (row) => {
  const contacts = row?.contacts || [];
  if (!contacts.length) return null;
  return contacts.find((c) => c.isPrimary) || contacts[0];
};

// Initials for the avatar circle, e.g. "Ahsan Feeds Mill" -> "AF"
const getInitials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

// Turns "30,000" / "30000 bags" / "" into a plain number for totals.
const parseNumber = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-md border bg-background p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      <div className="whitespace-normal word-break-words text-sm text-foreground">
        {showValue(value)}
      </div>
    </div>
  );
}

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

function BusinessDirectoryContent() {
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [viewingRecord, setViewingRecord] = useState(null); // full-details modal
  const [error, setError] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null); // { type: 'success' | 'error', text }
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  // Delete a record via the API and optimistically remove it from the list.
  const handleDelete = useCallback(async (id) => {
    setDeleting({ id });
    try {
      await api.delete("/directory/feed-mills/" + id);
      setRows((prev) => prev.filter((r) => r._id !== id && r.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
      alert(
        err?.response?.data?.message || "Unable to delete. Please try again.",
      );
    } finally {
      setDeleting(null);
    }
  }, []);

  const fetchFilters = (signal) => {
    api
      .get("/directory/filters", { signal })
      .then((res) => {
        setDistricts(res.data.districts || []);
      })
      .catch((err) => {
        if (
          axios.isCancel(err) ||
          err.code === "ERR_CANCELED" ||
          err.name === "CanceledError"
        )
          return;
        console.error("Error fetching directory filters:", err);
        setError(
          "Unable to load filter options. Check your network connection or API server.",
        );
      });
  };

  // Fetch filter dropdown options once. Aborts if the component re-mounts
  // (e.g. React 18 Strict Mode's dev-only double-invoke) before it finishes,
  // so a stale request can never overwrite fresh state or fire a false error.
  useEffect(() => {
    const controller = new AbortController();
    fetchFilters(controller.signal);
    return () => controller.abort();
  }, []);

  // Debounce the search box so we don't fire a request on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const fetchDirectoryData = (signal) => {
    setLoading(true);
    setError("");

    const params = { search: debouncedSearch || undefined, district };

    api
      .get("/directory/feed-mills", { params, signal })
      .then((res) => {
        setRows(res.data.rows || []);
        setLoading(false);
      })
      .catch((err) => {
        if (
          axios.isCancel(err) ||
          err.code === "ERR_CANCELED" ||
          err.name === "CanceledError"
        )
          return;
        console.error("Error fetching directory data:", err);
        setError(
          "Unable to load directory data. Check your network connection or API server.",
        );
        setLoading(false);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    fetchDirectoryData(controller.signal);
    return () => controller.abort();
  }, [debouncedSearch, district]);

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
      const res = await api.get("/directory/feed-mills/upload-template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "feed-mills-upload-template.xlsx");
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
      const res = await api.post("/directory/feed-mills/upload", formData, {
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
      // New districts may have just been added - refresh the filter dropdown
      // along with the list itself.
      fetchFilters();
      fetchDirectoryData();
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

  // Refresh data after a successful form submission (create or update)
  const handleFormSuccess = () => {
    setEditingRecord(null);
    fetchDirectoryData();
  };

  // Sorted, then paginated client-side (the API already applies search/district).
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        String(a.feedMillName || "").localeCompare(
          String(b.feedMillName || ""),
        ),
      ),
    [rows],
  );

  const pageCount = Math.max(
    1,
    Math.ceil(sortedRows.length / pagination.pageSize),
  );

  const paginatedRows = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return sortedRows.slice(start, start + pagination.pageSize);
  }, [sortedRows, pagination]);

  const resultCountLabel =
    rows.length === 0
      ? "0 results"
      : `Page ${pagination.pageIndex + 1} of ${pageCount} - ${rows.length} results`;

  const goToPage = (delta) =>
    setPagination((prev) => ({
      ...prev,
      pageIndex: Math.min(Math.max(prev.pageIndex + delta, 0), pageCount - 1),
    }));

  // Summary stats derived from the currently loaded (filtered) rows.
  const stats = useMemo(() => {
    const districtCount = new Set(
      rows.map((r) => r.districtRegion).filter(hasValue),
    ).size;
    const totalBagsPerMonth = rows.reduce(
      (acc, r) => acc + parseNumber(r.bagsPerMonth),
      0,
    );
    const withContacts = rows.filter(
      (r) => (r.contacts || []).length > 0,
    ).length;
    return { districtCount, totalBagsPerMonth, withContacts };
  }, [rows]);

  const directoryColumns = [
    { label: "Feed Mill", key: "feedMillName" },
    { label: "District/Region", key: "districtRegion" },
    {
      label: "Primary Contact",
      value: (row) => getPrimaryContact(row)?.name || "",
    },
    {
      label: "Designation",
      value: (row) => getPrimaryContact(row)?.designation || "",
    },
    {
      label: "Department",
      value: (row) => getPrimaryContact(row)?.department || "",
    },
    {
      label: "Contact Mobile",
      value: (row) => getPrimaryContact(row)?.mobile || "",
    },
    {
      label: "Contact Landline",
      value: (row) => getPrimaryContact(row)?.landline || "",
    },
    {
      label: "Contact Email",
      value: (row) => getPrimaryContact(row)?.email || "",
    },
    { label: "Mill Address", key: "millAddress" },
    { label: "Office Address", key: "officeAddress" },
    { label: "Mill Phones", key: "millPhones" },
    { label: "Office Phones", key: "officePhones" },
    { label: "Owner's Contact", key: "ownerContact" },
    { label: "Mill Email", key: "email" },
    { label: "Capacity (MT / Hour)", key: "productionCapacity" },
    { label: "Production (Bags / Month)", key: "bagsPerMonth" },
  ];

  const handleExportExcel = () => {
    exportToCSV(rows, directoryColumns, "business-directory");
  };

  const handleExportPDF = () => {
    exportToPDF(rows, directoryColumns, {
      title: "Business Directory",
      subtitle: "Feed mill business directory",
      filename: "business-directory",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-accent">
            Business Directory
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DownloadButton onExcel={handleExportExcel} onPdf={handleExportPDF} />
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button
            variant="outline"
            onClick={handleBrowseClick}
            disabled={uploading}
            className="hover:text-accent"
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Browse Excel File"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchFilters();
              fetchDirectoryData();
            }}
            className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Upload result banner */}
      {uploadMessage && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4 text-sm",
            uploadMessage.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800",
          )}
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

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="Total Feed Mills"
          value={rows.length}
          icon={Factory}
          colorClass="text-foreground"
        />
        <StatCard
          label="Districts Covered"
          value={stats.districtCount}
          icon={MapPin}
          colorClass="text-accent"
        />
        <StatCard
          label="Monthly Production"
          value={`${stats.totalBagsPerMonth.toLocaleString()} bags`}
          icon={Package}
          colorClass="text-chart-3"
        />
        <StatCard
          label="Mills w/ Contacts"
          value={stats.withContacts}
          icon={User}
          colorClass="text-chart-1"
        />
      </div>

      {/* Search, filter, add */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search feed mill, contact, district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-70 pl-8"
            />
          </div>
          <Select value={district} onValueChange={setDistrict}>
            <SelectTrigger className="w-45">
              <SelectValue placeholder="All Districts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Districts</SelectItem>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setEditingRecord({ _view: "feed-mills" })}
          className="shrink-0 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New Feed Mill
        </Button>
      </div>

      {/* Feed mill cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <KPISkeleton key={i} />
          ))}
        </div>
      ) : paginatedRows.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card py-16 text-sm text-muted-foreground">
          No records found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {paginatedRows.map((row, index) => {
            const recordId = row._id || row.id;
            const primaryContact = getPrimaryContact(row);
            const contacts = row.contacts || [];

            return (
              <Card
                key={recordId || row.feedMillName || index}
                className="group border-border bg-card transition-all duration-300 hover:border-accent/50"
              >
                <CardContent className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-foreground">
                        {getInitials(row.feedMillName)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-foreground transition-colors group-hover:text-accent">
                          {showValue(row.feedMillName)}
                        </h3>
                        <p className="truncate text-sm text-muted-foreground">
                          {row.millOwner
                            ? `Owner: ${row.millOwner}`
                            : primaryContact?.name
                              ? `${primaryContact.name}${
                                  primaryContact.designation
                                    ? ` (${primaryContact.designation})`
                                    : ""
                                }`
                              : "\u00A0"}
                        </p>
                      </div>
                    </div>
                    {hasValue(row.districtRegion) && (
                      <Badge
                        variant="outline"
                        className="shrink-0 max-w-[45%] truncate"
                      >
                        {row.districtRegion}
                      </Badge>
                    )}
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-2">
                          {showValue(row.millAddress)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {showValue(row.millPhones)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{showValue(row.email)}</span>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Capacity</span>
                        <span className="truncate font-medium text-foreground">
                          {showValue(row.productionCapacity)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Bags/Month
                        </span>
                        <span className="truncate font-medium text-foreground">
                          {showValue(row.bagsPerMonth)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Contacts</span>
                        <span className="font-medium text-foreground">
                          {contacts.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Primary contact strip */}
                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {primaryContact
                          ? `${primaryContact.name}${
                              primaryContact.mobile
                                ? ` \u00B7 ${primaryContact.mobile}`
                                : ""
                            }`
                          : "No contact on file"}
                      </span>
                    </div>
                    {primaryContact?.isPrimary && (
                      <Badge className="shrink-0 gap-1 bg-blue-100 text-blue-700 hover:bg-blue-100">
                        <Star className="h-3 w-3 fill-current" />
                        Primary
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent text-foreground hover:text-accent"
                      onClick={() => setEditingRecord(row)}
                    >
                      <Edit className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <ConfirmDelete
                      title="Delete record"
                      description="Are you sure you want to delete this record? This action cannot be undone."
                      onConfirm={() => handleDelete(recordId)}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={deleting?.id === recordId}
                        className="flex-1 bg-transparent text-red-600 hover:text-red-700"
                      >
                        {deleting?.id === recordId ? (
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Delete
                      </Button>
                    </ConfirmDelete>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="View full details"
                      onClick={() => setViewingRecord(row)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination footer */}
      <Card>
        <CardFooter className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) =>
                setPagination((prev) => ({
                  ...prev,
                  pageSize: Number(value),
                  pageIndex: 0,
                }))
              }
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {resultCountLabel}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(-1)}
                disabled={pagination.pageIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(1)}
                disabled={pagination.pageIndex >= pageCount - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Full-details modal - opened via the ExternalLink icon on a card */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-background shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b p-6">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {showValue(viewingRecord.feedMillName)}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {hasValue(viewingRecord.districtRegion) && (
                    <Badge variant="outline">
                      {viewingRecord.districtRegion}
                    </Badge>
                  )}
                  {viewingRecord.millOwner && (
                    <span>Owner: {viewingRecord.millOwner}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewingRecord(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  <DetailItem
                    icon={User}
                    label="Owner"
                    value={viewingRecord.millOwner}
                  />
                  <DetailItem
                    icon={Phone}
                    label="Owner's Contact"
                    value={viewingRecord.ownerContact}
                  />
                  <DetailItem
                    icon={MapPin}
                    label="Mill Address"
                    value={viewingRecord.millAddress}
                  />
                  <DetailItem
                    icon={MapPin}
                    label="Office Address"
                    value={viewingRecord.officeAddress}
                  />
                  <DetailItem
                    icon={Phone}
                    label="Mill Phone(s)"
                    value={viewingRecord.millPhones}
                  />
                  <DetailItem
                    icon={Phone}
                    label="Office Phone(s)"
                    value={viewingRecord.officePhones}
                  />
                  <DetailItem
                    icon={Mail}
                    label="Email"
                    value={viewingRecord.email}
                  />
                  <DetailItem
                    icon={Package}
                    label="Production"
                    value={[
                      viewingRecord.productionCapacity &&
                        `Capacity: ${viewingRecord.productionCapacity}`,
                      viewingRecord.bagsPerMonth &&
                        `Bags/month: ${viewingRecord.bagsPerMonth}`,
                    ]
                      .filter(Boolean)
                      .join(" | ")}
                  />
                </div>

                {(viewingRecord.contacts || []).length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      Contacts ({viewingRecord.contacts.length})
                    </div>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                      {viewingRecord.contacts.map((contact, idx) => (
                        <div
                          key={contact._id || idx}
                          className="min-w-0 rounded-md border bg-background p-3"
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {showValue(contact.name)}
                            </span>
                            {contact.isPrimary && (
                              <Badge className="shrink-0 gap-1 bg-blue-100 text-blue-700 hover:bg-blue-100">
                                <Star className="h-3 w-3 fill-current" />
                                Primary
                              </Badge>
                            )}
                          </div>
                          {(hasValue(contact.designation) ||
                            hasValue(contact.department)) && (
                            <div className="mb-1.5 text-xs text-muted-foreground">
                              {[contact.designation, contact.department]
                                .filter(hasValue)
                                .join(" - ")}
                            </div>
                          )}
                          <div className="space-y-0.5 text-xs text-foreground">
                            {hasValue(contact.mobile) && (
                              <div className="truncate">
                                Mobile: {contact.mobile}
                              </div>
                            )}
                            {hasValue(contact.landline) && (
                              <div className="truncate">
                                Landline: {contact.landline}
                              </div>
                            )}
                            {hasValue(contact.email) && (
                              <div className="truncate">{contact.email}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t p-4">
              <Button
                variant="outline"
                className="hover:text-accent"
                onClick={() => {
                  setEditingRecord(viewingRecord);
                  setViewingRecord(null);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button onClick={() => setViewingRecord(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Browse Excel dialog - download a correctly-formatted template, or
          go straight to picking a file to upload */}
      {showUploadDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-base font-semibold text-foreground">
                Import Feed Mills
              </h3>
              <button
                onClick={() => setShowUploadDialog(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-6">
              <p className="text-sm text-muted-foreground">
                Not sure about the column headers? Download the format file
                first — it has the exact headers we expect, plus one example
                row.
              </p>
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="w-full"
              >
                {downloadingTemplate ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                {downloadingTemplate
                  ? "Downloading..."
                  : "Download Format File"}
              </Button>
              <Button onClick={handleChooseUpload} className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                Upload Excel File
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {editingRecord && (
        <DirectoryForm
          key={editingRecord._id || "new"}
          view="feed-mills"
          initialData={editingRecord._id ? editingRecord : undefined}
          onClose={() => setEditingRecord(null)}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}

export default function BusinessDirectoryPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <BusinessDirectoryContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
