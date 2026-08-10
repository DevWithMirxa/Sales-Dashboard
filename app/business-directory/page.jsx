"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
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
  Users,
  MapPin,
  Phone,
  Mail,
  Package,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const columnHelper = createColumnHelper();

const salesTeamColumns = [
  columnHelper.accessor("salesperson", {
    header: "Salesperson",
    cell: (info) => (
      <span className="font-medium text-foreground">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("designation", {
    header: "Designation",
    cell: (info) => showValue(info.getValue()),
  }),
  columnHelper.accessor("region", {
    header: "Region",
    cell: (info) => showValue(info.getValue()),
  }),
];

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
  const [view, setView] = useState("feed-mills"); // 'feed-mills' | 'sales-team'
  const [districts, setDistricts] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [district, setDistrict] = useState("all");
  const [designation, setDesignation] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState("");

  const fetchFilters = (signal) => {
    api
      .get("/directory/filters", { signal })
      .then((res) => {
        setDistricts(res.data.districts || []);
        setDesignations(res.data.designations || []);
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

  // Reset pagination and default sort whenever the view changes.
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setExpandedId(null);
    setSorting(
      view === "feed-mills"
        ? [{ id: "feedMillName", desc: false }]
        : [{ id: "salesperson", desc: false }],
    );
  }, [view]);

  // Debounce the search box so we don't fire a request on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const fetchDirectoryData = (signal) => {
    setLoading(true);
    setError("");

    const endpoint =
      view === "feed-mills" ? "/directory/feed-mills" : "/directory/sales-team";
    const params = { search: debouncedSearch || undefined };
    if (view === "feed-mills") params.district = district;
    if (view === "sales-team") params.designation = designation;

    api
      .get(endpoint, { params, signal })
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
  }, [view, debouncedSearch, district, designation]);

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
                {hasValue(row.millOwner) && (
                  <span className="truncate">Owner: {row.millOwner}</span>
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

  const columns = view === "feed-mills" ? feedMillColumns : salesTeamColumns;

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
    if (view !== "feed-mills") return;
    const rowId = row._id || row.id || row.feedMillName;
    setExpandedId((prev) => (prev === rowId ? null : rowId));
  };

  const renderFeedMillDetails = (row) => (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell
        colSpan={columns.length}
        className="px-5 py-4 whitespace-normal"
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
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
              row.productionCapacity && `Capacity: ${row.productionCapacity}`,
              row.bagsPerMonth && `Bags/month: ${row.bagsPerMonth}`,
            ]
              .filter(Boolean)
              .join(" | ")}
          />
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Business Directory
        </h1>
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="feed-mills" className="gap-1.5">
              <Factory className="w-4 h-4" />
              Feed Mills
            </TabsTrigger>
            <TabsTrigger value="sales-team" className="gap-1.5">
              <Users className="w-4 h-4" />
              Sales Team
            </TabsTrigger>
          </TabsList>
        </Tabs>
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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              {view === "feed-mills" ? "All Feed Mills" : "All Sales Team"}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    view === "feed-mills"
                      ? "Search name, owner, district..."
                      : "Search name, designation, region..."
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              {view === "feed-mills" ? (
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
              ) : (
                <Select value={designation} onValueChange={setDesignation}>
                  <SelectTrigger className="w-45">
                    <SelectValue placeholder="All Designations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Designations</SelectItem>
                    {designations.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className={view === "feed-mills" ? "table-fixed" : ""}>
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
                      className={cn(
                        view === "feed-mills" &&
                          "cursor-pointer align-top hover:bg-muted/40",
                      )}
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
                    {view === "feed-mills" &&
                    expandedId ===
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
