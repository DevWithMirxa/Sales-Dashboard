"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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

const STATUS_STYLES = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  pending: "bg-slate-800 text-white",
  suspended: "bg-orange-100 text-orange-700",
  banned: "bg-red-100 text-red-700",
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
            className="w-4 h-4 rounded border-gray-300"
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
            className="w-4 h-4 rounded border-gray-300"
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
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${getAvatarColor(u.name)}`}
              >
                {getInitials(u.name)}
              </div>
              <span className="text-gray-900 font-medium truncate">
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
          <span className="truncate block" title={getValue()}>
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
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize whitespace-nowrap ${STATUS_STYLES[status] || STATUS_STYLES.active}`}
            >
              {status}
            </span>
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        meta: { headerClassName: "w-[9%]", cellClassName: "w-[9%]" },
        cell: ({ getValue }) => (
          <span className="capitalize whitespace-nowrap">{getValue()}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Joined",
        meta: {
          headerClassName: "w-[11%] whitespace-nowrap",
          cellClassName: "w-[11%] whitespace-nowrap",
        },
        cell: ({ getValue }) => formatDate(getValue()),
      },
      {
        accessorKey: "lastActiveAt",
        header: "Last Active",
        meta: {
          headerClassName: "w-[11%] whitespace-nowrap",
          cellClassName: "w-[11%] whitespace-nowrap",
        },
        cell: ({ getValue }) => formatRelativeTime(getValue()),
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
              className="text-blue-600 hover:text-blue-900"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <ConfirmDelete
              title="Delete user"
              description="Are you sure you want to delete this user? This action cannot be undone."
              onConfirm={() => handleDelete(row.original._id)}
            >
              <button
                className="text-red-600 hover:text-red-700"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
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
          <h1 className="text-lg font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage all users in one place. Control access, assign roles, and
            monitor activity across your platform.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-50">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-full text-sm capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 border border-gray-300 rounded-full text-sm capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <span className="text-sm font-medium text-red-700">
              {selectedIds.size} user{selectedIds.size === 1 ? "" : "s"}{" "}
              selected
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear selection
              </button>
              <ConfirmDelete
                title="Delete selected users"
                description={`Delete ${selectedIds.size} selected user${selectedIds.size === 1 ? "" : "s"}? This cannot be undone.`}
                onConfirm={handleBulkDelete}
              >
                <button className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
              </ConfirmDelete>
            </div>
          </div>
        )}

        <TanStackDataTable
          columns={columns}
          data={paginatedUsers}
          loading={loading}
          emptyMessage="No users found."
          getRowId={(row) => row._id}
          sorting={sorting}
          onSortingChange={setSorting}
          wrapperClassName="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden [&_table]:table-fixed [&_table]:w-full [&_th]:px-3 [&_td]:px-3 [&_th]:py-2.5 [&_td]:py-3"
        />

        {/* Pagination */}
        {!loading && sortedUsers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-full text-sm font-medium ${
                    p === currentPage
                      ? "bg-slate-800 text-white"
                      : "border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage === pageCount}
                className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(pageCount)}
                disabled={currentPage === pageCount}
                className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronsRight className="w-4 h-4" />
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
