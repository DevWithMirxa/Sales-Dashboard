"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import UserForm from "@/components/forms/UserForm";
import TanStackDataTable from "@/components/TanStackDataTable";
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api from "@/lib/api";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import ConfirmDelete from "@/components/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton";

// Status badge colors, mapped onto the shared semantic tokens instead of
// hardcoded light-mode pastels.
const STATUS_STYLES = {
  active: "bg-success/20 text-success border-success/30",
  inactive: "bg-muted text-muted-foreground border-border",
  pending: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  suspended: "bg-warning/20 text-warning border-warning/30",
  banned: "bg-destructive/20 text-destructive border-destructive/30",
};

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-teal-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-rose-500",
];

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const getAvatarColor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatRelativeTime = (value) => {
  if (!value) return "Never";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12)
    return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
};

const DATE_RANGES = {
  all: () => true,
  "7d": (date) => Date.now() - new Date(date).getTime() <= 7 * 86400000,
  "30d": (date) => Date.now() - new Date(date).getTime() <= 30 * 86400000,
  "90d": (date) => Date.now() - new Date(date).getTime() <= 90 * 86400000,
  year: (date) => new Date(date).getFullYear() === new Date().getFullYear(),
};

// Shared column definitions used by the PDF export (mirrors the CSV headers
// used in downloadCSV below) so the two formats stay in sync.
const USER_COLUMNS = [
  { label: "Full Name", value: (u) => u.name },
  { label: "Email", value: (u) => u.email },
  { label: "Status", value: (u) => u.status },
  { label: "Role", value: (u) => u.role },
  { label: "Joined Date", value: (u) => formatDate(u.createdAt) },
  { label: "Last Active", value: (u) => formatRelativeTime(u.lastActiveAt) },
];

function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadCSV(rows) {
  const headers = [
    "Full Name",
    "Email",
    "Status",
    "Role",
    "Joined Date",
    "Last Active",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((u) =>
      [
        u.name,
        u.email,
        u.status,
        u.role,
        formatDate(u.createdAt),
        formatRelativeTime(u.lastActiveAt),
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const [sorting, setSorting] = useState([{ id: "createdAt", desc: true }]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert(error?.response?.data?.message || "Failed to delete user");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  // --- Filtering ---
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (term && !`${u.name} ${u.email}`.toLowerCase().includes(term))
        return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (dateFilter !== "all" && !DATE_RANGES[dateFilter](u.createdAt))
        return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter, dateFilter]);

  // --- Sorting (full filtered dataset, before pagination) ---
  const sortedUsers = useMemo(() => {
    if (!sorting.length) return filteredUsers;
    const { id, desc } = sorting[0];
    const sorted = [...filteredUsers].sort((a, b) => {
      const av = a[id] ?? "";
      const bv = b[id] ?? "";
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return desc ? sorted.reverse() : sorted;
  }, [filteredUsers, sorting]);

  // Reset to page 1 whenever the filtered set changes underneath the user
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, dateFilter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedUsers = useMemo(
    () =>
      sortedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedUsers, currentPage, pageSize],
  );

  const pageIds = useMemo(
    () => paginatedUsers.map((u) => u._id),
    [paginatedUsers],
  );
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await api.delete("/users", { data: { ids: Array.from(selectedIds) } });
      setSelectedIds(new Set());
      fetchUsers();
    } catch (error) {
      console.error("Error bulk deleting users:", error);
      alert(
        error?.response?.data?.message || "Failed to delete selected users",
      );
    }
  };

  const getExportRows = () =>
    selectedIds.size > 0
      ? sortedUsers.filter((u) => selectedIds.has(u._id))
      : sortedUsers;

  const handleExportExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) {
      alert("No users to export.");
      return;
    }
    downloadCSV(rows);
  };

  const handleExportPDF = () => {
    const rows = getExportRows();
    if (rows.length === 0) {
      alert("No users to export.");
      return;
    }
    exportToPDF(rows, USER_COLUMNS, {
      title: "Users",
      subtitle: "User accounts",
      filename: "users",
    });
  };

  const roles = useMemo(
    () => Array.from(new Set(users.map((u) => u.role))).sort(),
    [users],
  );
  const statuses = useMemo(
    () => Array.from(new Set(users.map((u) => u.status))).sort(),
    [users],
  );

  const columns = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={allPageSelected}
            onChange={toggleSelectAllOnPage}
            className="h-4 w-4 rounded border-border accent-accent"
          />
        ),
        enableSorting: false,
        meta: { headerClassName: "w-10", cellClassName: "w-10" },
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original._id)}
            onChange={() => toggleSelectOne(row.original._id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-border accent-accent"
          />
        ),
      },
      {
        accessorKey: "name",
        header: "Full Name",
        meta: { headerClassName: "w-[22%]", cellClassName: "w-[22%]" },
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                  getAvatarColor(u.name),
                )}
              >
                {getInitials(u.name)}
              </div>
              <span className="truncate font-medium text-foreground">
                {u.name}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        meta: { headerClassName: "w-[20%]", cellClassName: "w-[20%] truncate" },
        cell: ({ getValue }) => (
          <span
            className="block truncate text-muted-foreground"
            title={getValue()}
          >
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: { headerClassName: "w-[11%]", cellClassName: "w-[11%]" },
        cell: ({ getValue }) => {
          const status = getValue() || "active";
          return (
            <Badge
              className={cn(
                "border capitalize whitespace-nowrap",
                STATUS_STYLES[status] || STATUS_STYLES.active,
              )}
            >
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        meta: { headerClassName: "w-[9%]", cellClassName: "w-[9%]" },
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap capitalize text-foreground">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Joined",
        meta: {
          headerClassName: "w-[11%] whitespace-nowrap",
          cellClassName: "w-[11%] whitespace-nowrap",
        },
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatDate(getValue())}
          </span>
        ),
      },
      {
        accessorKey: "lastActiveAt",
        header: "Last Active",
        meta: {
          headerClassName: "w-[11%] whitespace-nowrap",
          cellClassName: "w-[11%] whitespace-nowrap",
        },
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatRelativeTime(getValue())}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: { headerClassName: "w-16", cellClassName: "w-16" },
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(row.original)}
              className="text-accent hover:text-accent/80"
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <ConfirmDelete
              title="Delete user"
              description="Are you sure you want to delete this user? This action cannot be undone."
              onConfirm={() => handleDelete(row.original._id)}
            >
              <button
                className="text-red-500 hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </ConfirmDelete>
          </div>
        ),
      },
    ],
    [selectedIds, allPageSelected, pageIds],
  );

  const rangeStart =
    sortedUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, sortedUsers.length);

  const pageNumbers = useMemo(() => {
    const nums = [];
    const span = 2;
    for (
      let p = Math.max(1, currentPage - span);
      p <= Math.min(pageCount, currentPage + span);
      p++
    ) {
      nums.push(p);
    }
    return nums;
  }, [currentPage, pageCount]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-accent">
            User Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage all users in one place. Control access, assign roles, and
            monitor activity across your platform.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-50 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-full border border-border bg-secondary py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-full border border-border bg-secondary px-4 py-2 text-sm capitalize text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="all">All Roles</option>
            {roles.map((r) => (
              <option key={r} value={r} className="capitalize">
                {r}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-border bg-secondary px-4 py-2 text-sm capitalize text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="all">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-full border border-border bg-secondary px-4 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="year">This Year</option>
          </select>

          <DownloadButton
            onExcel={handleExportExcel}
            onPdf={handleExportPDF}
            buttonClassName="!rounded-full"
          />

          <Button
            onClick={() => setShowForm(true)}
            className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5">
            <span className="text-sm font-medium text-destructive">
              {selectedIds.size} user{selectedIds.size === 1 ? "" : "s"}{" "}
              selected
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </button>
              <ConfirmDelete
                title="Delete selected users"
                description={`Delete ${selectedIds.size} selected user${selectedIds.size === 1 ? "" : "s"}? This cannot be undone.`}
                onConfirm={handleBulkDelete}
              >
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
              </ConfirmDelete>
            </div>
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <TanStackDataTable
            columns={columns}
            data={paginatedUsers}
            emptyMessage="No users found."
            getRowId={(row) => row._id}
            sorting={sorting}
            onSortingChange={setSorting}
            wrapperClassName="bg-card border border-border rounded-xl overflow-hidden [&_table]:table-fixed [&_table]:w-full [&_th]:px-3 [&_td]:px-3 [&_th]:py-2.5 [&_td]:py-3"
          />
        )}

        {/* Pagination */}
        {!loading && sortedUsers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-border bg-secondary px-2 py-1 text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>
                {rangeStart}-{rangeEnd} of {sortedUsers.length} rows
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={currentPage === 1}
                className="rounded-full border border-border p-2 hover:bg-secondary disabled:opacity-40"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-border p-2 hover:bg-secondary disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    "h-8 w-8 rounded-full text-sm font-medium",
                    p === currentPage
                      ? "bg-accent text-accent-foreground"
                      : "border border-border text-foreground hover:bg-secondary",
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage === pageCount}
                className="rounded-full border border-border p-2 hover:bg-secondary disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(pageCount)}
                disabled={currentPage === pageCount}
                className="rounded-full border border-border p-2 hover:bg-secondary disabled:opacity-40"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <UserForm
            onClose={handleCloseForm}
            initialData={editingUser}
            onSuccess={fetchUsers}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

export default function UsersPage() {
  return (
    <ProtectedRoute>
      <Users />
    </ProtectedRoute>
  );
}
