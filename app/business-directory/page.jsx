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
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const showValue = (v) => (v === null || v === undefined || v === "" ? "-" : v);
const hasValue = (v) =>
  v !== null && v !== undefined && String(v).trim() !== "";

// The primary contact, falling back to the first contact if none is
// flagged primary (shouldn't normally happen - the form always keeps one
// contact marked primary - but this keeps the table from showing nothing).
const getPrimaryContact = (row) => {
  const contacts = row?.contacts || [];
  if (!contacts.length) return null;
  return contacts.find((c) => c.isPrimary) || contacts[0];
};

const columnHelper = createColumnHelper();

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

function BusinessDirectoryContent() {
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState([{ id: "feedMillName", desc: false }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null); // { type: 'success' | 'error', text }
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  // Delete a record via the API and optimistically remove it from the table.
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
      // along with the table itself.
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

  const feedMillColumns = useMemo(
    () => [
      columnHelper.display({
        id: "expand",
        header: "",
        enableSorting: false,
        meta: {
          headerClassName: "w-10",
          cellClassName: "w-10 text-muted-foreground",
        },
        cell: ({ row }) => {
          const rowId =
            row.original._id || row.original.id || row.original.feedMillName;
          const isExpanded = expandedId === rowId;
          return isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          );
        },
      }),
      columnHelper.accessor("feedMillName", {
        header: "Feed Mill",
        meta: {
          headerClassName: "w-[30%] min-w-[220px]",
          cellClassName: "w-[30%] min-w-[220px]",
        },
        cell: (info) => {
          const row = info.row.original;
          const primaryContact = getPrimaryContact(row);
          return (
            <div className="min-w-0 space-y-1">
              <div className="whitespace-normal word-break-words font-medium leading-snug text-foreground">
                {info.getValue()}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {hasValue(row.districtRegion) && (
                  <Badge variant="outline" className="max-w-full truncate">
                    {row.districtRegion}
                  </Badge>
                )}
                {primaryContact && hasValue(primaryContact.name) && (
                  <span className="truncate">
                    {primaryContact.name}
                    {hasValue(primaryContact.designation) &&
                      ` (${primaryContact.designation}${
                        hasValue(primaryContact.department)
                          ? ` - ${primaryContact.department}`
                          : ""
                      })`}
                  </span>
                )}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("millAddress", {
        header: "Address",
        meta: {
          headerClassName: "w-[34%] min-w-[260px]",
          cellClassName: "w-[34%] min-w-[260px]",
        },
        cell: (info) => (
          <div className="line-clamp-2 whitespace-normal word-break-words text-sm leading-relaxed text-muted-foreground">
            {showValue(info.getValue())}
          </div>
        ),
      }),
      columnHelper.accessor("millPhones", {
        header: "Contact",
        meta: {
          headerClassName: "hidden lg:table-cell w-[18%]",
          cellClassName: "hidden lg:table-cell w-[18%]",
        },
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="min-w-0 space-y-1 text-sm">
              <div className="truncate text-foreground">
                {showValue(info.getValue())}
              </div>
              {hasValue(row.email) && (
                <div className="truncate text-muted-foreground">
                  {row.email}
                </div>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("productionCapacity", {
        header: "Capacity",
        meta: {
          headerClassName: "hidden xl:table-cell w-[18%]",
          cellClassName: "hidden xl:table-cell w-[18%]",
        },
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="min-w-0 space-y-1 text-sm">
              <div className="truncate text-foreground">
                {showValue(info.getValue())}
              </div>
              {hasValue(row.bagsPerMonth) && (
                <div className="truncate text-muted-foreground">
                  {row.bagsPerMonth} bags/month
                </div>
              )}
            </div>
          );
        },
      }),
    ],
    [expandedId],
  );

  // Refresh data after a successful form submission (create or update)
  const handleFormSuccess = () => {
    setEditingRecord(null);
    setFormOpen(false);
    fetchDirectoryData();
  };

  // Action column with Edit + Delete buttons (shared by both table views)
  const actionsColumn = useMemo(
    () => [
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: {
          headerClassName: "w-[80px]",
          cellClassName: "w-[80px]",
        },
        cell: ({ row }) => {
          const record = row.original;
          const recordId = record._id || record.id;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setEditingRecord(record)}
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <ConfirmDelete
                title="Delete record"
                description="Are you sure you want to delete this record? This action cannot be undone."
                onConfirm={() => handleDelete(recordId)}
              >
                <button
                  type="button"
                  title="Delete"
                  disabled={deleting?.id === recordId}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center",
                    "text-red-600 hover:text-red-700 disabled:opacity-50",
                  )}
                >
                  {deleting?.id === recordId ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </ConfirmDelete>
            </div>
          );
        },
      },
    ],
    [deleting, handleDelete],
  );

  const columns = [...feedMillColumns, ...actionsColumn];

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const resultCountLabel = useMemo(() => {
    if (rows.length === 0) return "0 results";
    return `Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()} - ${rows.length} results`;
  }, [rows, table]);

  const toggleExpanded = (row) => {
    const rowId = row._id || row.id || row.feedMillName;
    setExpandedId((prev) => (prev === rowId ? null : rowId));
  };

  const renderFeedMillDetails = (row) => {
    const contacts = row.contacts || [];
    return (
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableCell
          colSpan={columns.length}
          className="px-5 py-4 whitespace-normal"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <DetailItem icon={User} label="Owner" value={row.millOwner} />
              <DetailItem
                icon={Phone}
                label="Owner's Contact"
                value={row.ownerContact}
              />
              <DetailItem
                icon={MapPin}
                label="Mill Address"
                value={row.millAddress}
              />
              <DetailItem
                icon={MapPin}
                label="Office Address"
                value={row.officeAddress}
              />
              <DetailItem
                icon={Phone}
                label="Mill Phone(s)"
                value={row.millPhones}
              />
              <DetailItem
                icon={Phone}
                label="Office Phone(s)"
                value={row.officePhones}
              />
              <DetailItem icon={Mail} label="Email" value={row.email} />
              <DetailItem
                icon={Package}
                label="Production"
                value={[
                  row.productionCapacity &&
                    `Capacity: ${row.productionCapacity}`,
                  row.bagsPerMonth && `Bags/month: ${row.bagsPerMonth}`,
                ]
                  .filter(Boolean)
                  .join(" | ")}
              />
            </div>

            {contacts.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  Contacts ({contacts.length})
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {contacts.map((contact, idx) => (
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
        </TableCell>
      </TableRow>
    );
  };

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
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
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
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
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
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800",
          )}
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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>All Feed Mills</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search feed mill, contact, district..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
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
              className="shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Feed Mill
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="table-fixed">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        "select-none whitespace-nowrap px-4 py-3",
                        header.column.getCanSort() && "cursor-pointer",
                        header.column.columnDef.meta?.headerClassName,
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-foreground" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="w-3 h-3 text-foreground" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center py-6"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center py-6 text-muted-foreground"
                  >
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow
                      onClick={() => toggleExpanded(row.original)}
                      className="cursor-pointer align-top hover:bg-muted/40"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "px-4 py-3 align-top whitespace-normal",
                            cell.column.columnDef.meta?.cellClassName,
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {expandedId ===
                    (row.original._id ||
                      row.original.id ||
                      row.original.feedMillName)
                      ? renderFeedMillDetails(row.original)
                      : null}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-4 border-t py-4">
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
              <SelectTrigger className="w-20 h-8">
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
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Browse Excel dialog - download a correctly-formatted template, or
          go straight to picking a file to upload */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-base font-semibold text-foreground">
                Import Feed Mills
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
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="w-full"
              >
                {downloadingTemplate ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                {downloadingTemplate
                  ? "Downloading..."
                  : "Download Format File"}
              </Button>
              <Button onClick={handleChooseUpload} className="w-full">
                <Upload className="w-4 h-4 mr-2" />
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
