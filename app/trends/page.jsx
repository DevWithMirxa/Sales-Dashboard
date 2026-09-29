"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Trophy,
  Package,
  Percent,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileDown,
  Loader2,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const formatCompact = (n) => {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "-";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)} K`;
  return `${Math.round(v)}`;
};
const formatNumber = (n) => (n || n === 0 ? formatCompact(n) : "-");
const formatRs = (n) => (n || n === 0 ? formatCompact(n) : "-");
const formatPct = (n) =>
  n === null || n === undefined ? "-" : `${n.toFixed(1)}`;

const achievementVariant = (pct) => {
  if (pct === null || pct === undefined) return "outline";
  if (pct >= 100) return "default";
  return "secondary";
};

const achievementClass = (pct) => {
  if (pct === null || pct === undefined)
    return "text-muted-foreground border-muted";
  if (pct >= 100)
    return "border-0 bg-green-500/15 text-green-400 hover:bg-green-500/15";
  if (pct >= 70)
    return "border-0 bg-amber-500/15 text-amber-400 hover:bg-amber-500/15";
  return "border-0 bg-red-500/15 text-red-400 hover:bg-red-500/15";
};

// "2025-01" -> "Jan 25"
const formatPeriodLabel = (period) => {
  const [year, month] = period.split("-");
  const months = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[Number(month)]} ${year.slice(2)}`;
};

const columnHelper = createColumnHelper();

function TrendsContent() {
  const [view, setView] = useState("product"); // 'product' | 'salesperson'
  const [years, setYears] = useState([]);
  const [year, setYear] = useState("all");
  const [rows, setRows] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [sorting, setSorting] = useState([{ id: "saleValueRs", desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const entityKey = view === "product" ? "product" : "salesperson";

  const fetchFilters = () => {
    api
      .get("/trends/filters")
      .then((res) => setYears(res.data.years || []))
      .catch((err) => console.error("Error fetching trend filters:", err));
  };

  const fetchTableData = () => {
    setLoading(true);
    const endpoint =
      view === "product" ? "/trends/by-product" : "/trends/by-salesperson";
    const params = year !== "all" ? { year } : {};
    api
      .get(endpoint, { params })
      .then((res) => {
        setRows(res.data.rows || []);
        setSeries(res.data.series || []);
      })
      .catch((err) => console.error("Error fetching trend data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchFilters, []);

  // ---- Excel upload / template download (Trend collection) ----
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null); // { ok, message, details }

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file); // backend expects the field name "file"

    setUploading(true);
    setUploadResult(null);
    try {
      const res = await api.post("/trends/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = res.data || {};
      setUploadResult({
        ok: true,
        message: `Upload complete: ${d.inserted ?? 0} added, ${d.updated ?? 0} updated, ${d.skipped ?? 0} skipped (of ${d.totalRows ?? 0} rows).`,
        details: d.errors || [],
      });
      fetchFilters();
      fetchTableData();
    } catch (err) {
      setUploadResult({
        ok: false,
        message:
          err?.response?.data?.message ||
          "Upload failed. Please check the file and try again.",
        details: err?.response?.data?.errors || [],
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get("/trends/upload-template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "trends-upload-template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading trends template:", err);
      setUploadResult({
        ok: false,
        message: "Could not download the template.",
        details: [],
      });
    }
  };

  useEffect(() => {
    setSelectedEntity(null);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    fetchTableData();
  }, [view, year]);

  const columns = useMemo(
    () => [
      columnHelper.accessor(entityKey, {
        header: view === "product" ? "Product" : "Salesperson",
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("targetVolumeKg", {
        header: "Target Vol (Kg)",
        cell: (info) => formatNumber(info.getValue()),
      }),
      columnHelper.accessor("saleVolumeKg", {
        header: "Sale Vol (Kg)",
        cell: (info) => formatNumber(info.getValue()),
      }),
      columnHelper.accessor("volumeAchievementPct", {
        header: "Vol Achv%",
        cell: (info) => (
          <Badge
            variant={achievementVariant(info.getValue())}
            className={cn(achievementClass(info.getValue()))}
          >
            {formatPct(info.getValue())}
          </Badge>
        ),
      }),
      columnHelper.accessor("targetValueRs", {
        header: "Target Value (Rs)",
        cell: (info) => formatRs(info.getValue()),
      }),
      columnHelper.accessor("saleValueRs", {
        header: "Sale Value (Rs)",
        cell: (info) => formatRs(info.getValue()),
      }),
      columnHelper.accessor("valueAchievementPct", {
        header: "Value Achv%",
        cell: (info) => (
          <Badge
            variant={achievementVariant(info.getValue())}
            className={cn(achievementClass(info.getValue()))}
          >
            {formatPct(info.getValue())}
          </Badge>
        ),
      }),
    ],
    [view, entityKey],
  );

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

  // Preset options for the "Sort by" dropdown, in addition to clicking column headers directly.
  const sortOptions = useMemo(
    () => [
      {
        value: "entity-asc",
        label: `${view === "product" ? "Product" : "Salesperson"} (A–Z)`,
        id: entityKey,
        desc: false,
      },
      {
        value: "entity-desc",
        label: `${view === "product" ? "Product" : "Salesperson"} (Z–A)`,
        id: entityKey,
        desc: true,
      },
      {
        value: "saleValueRs-desc",
        label: "Sale Value (High–Low)",
        id: "saleValueRs",
        desc: true,
      },
      {
        value: "saleValueRs-asc",
        label: "Sale Value (Low–High)",
        id: "saleValueRs",
        desc: false,
      },
      {
        value: "targetValueRs-desc",
        label: "Target Value (High–Low)",
        id: "targetValueRs",
        desc: true,
      },
      {
        value: "targetValueRs-asc",
        label: "Target Value (Low–High)",
        id: "targetValueRs",
        desc: false,
      },
      {
        value: "saleVolumeKg-desc",
        label: "Sale Volume (High–Low)",
        id: "saleVolumeKg",
        desc: true,
      },
      {
        value: "saleVolumeKg-asc",
        label: "Sale Volume (Low–High)",
        id: "saleVolumeKg",
        desc: false,
      },
      {
        value: "valueAchievementPct-desc",
        label: "Value Achv % (High–Low)",
        id: "valueAchievementPct",
        desc: true,
      },
      {
        value: "valueAchievementPct-asc",
        label: "Value Achv % (Low–High)",
        id: "valueAchievementPct",
        desc: false,
      },
    ],
    [view, entityKey],
  );

  const currentSortValue = useMemo(() => {
    const current = sorting[0];
    if (!current) return "saleValueRs-desc";
    const match = sortOptions.find(
      (o) => o.id === current.id && o.desc === current.desc,
    );
    return match ? match.value : "saleValueRs-desc";
  }, [sorting, sortOptions]);

  const handleSortChange = (value) => {
    const option = sortOptions.find((o) => o.value === value);
    if (option) setSorting([{ id: option.id, desc: option.desc }]);
  };

  const top10 = useMemo(() => rows.slice(0, 10), [rows]);

  // Powers the summary cards above the chart: top performer by sale value, by volume,
  // by achievement %, plus overall totals for the current view/year filter.
  const stats = useMemo(() => {
    if (!rows.length) return null;

    const bySale = [...rows].sort((a, b) => b.saleValueRs - a.saleValueRs)[0];
    const byVolume = [...rows].sort(
      (a, b) => b.saleVolumeKg - a.saleVolumeKg,
    )[0];
    const withAchv = rows.filter(
      (r) =>
        r.valueAchievementPct !== null && r.valueAchievementPct !== undefined,
    );
    const byAchv = withAchv.length
      ? [...withAchv].sort(
          (a, b) => b.valueAchievementPct - a.valueAchievementPct,
        )[0]
      : null;

    const totalSaleValueRs = rows.reduce(
      (sum, r) => sum + (r.saleValueRs || 0),
      0,
    );
    const totalTargetValueRs = rows.reduce(
      (sum, r) => sum + (r.targetValueRs || 0),
      0,
    );
    const overallAchvPct = totalTargetValueRs
      ? (totalSaleValueRs / totalTargetValueRs) * 100
      : null;

    return {
      bySale,
      byVolume,
      byAchv,
      totalSaleValueRs,
      totalTargetValueRs,
      overallAchvPct,
    };
  }, [rows]);

  const entityChartData = useMemo(() => {
    if (!selectedEntity) return [];
    return series
      .filter((s) => s[entityKey] === selectedEntity)
      .map((s) => ({
        period: formatPeriodLabel(s.period),
        Target: s.targetValueRs,
        Sale: s.saleValueRs,
      }));
  }, [series, selectedEntity, entityKey]);

  const trendColumns = [
    {
      label: view === "product" ? "Product" : "Salesperson",
      key: entityKey,
    },
    { label: "Target Vol (Kg)", key: "targetVolumeKg" },
    { label: "Sale Vol (Kg)", key: "saleVolumeKg" },
    { label: "Volume Achievement (%)", key: "volumeAchievementPct" },
    { label: "Target Value (Rs)", key: "targetValueRs" },
    { label: "Sale Value (Rs)", key: "saleValueRs" },
    { label: "Value Achievement (%)", key: "valueAchievementPct" },
  ];

  const handleExportExcel = () => {
    exportToCSV(rows, trendColumns, `trends-${view}`);
  };

  const handleExportPDF = () => {
    exportToPDF(rows, trendColumns, {
      title: "Trends",
      subtitle: `${view === "product" ? "By Product" : "By Salesperson"}`,
      filename: `trends-${view}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-accent">
            Sales Trends
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare sales performance against targets across products and
            salespeople.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleUploadFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs bg-background text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-background dark:text-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
            onClick={handleDownloadTemplate}
          >
            <FileDown className="h-4 w-4" />
            Download Format
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs bg-background text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-background dark:text-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload Excel"}
          </Button>
          <DownloadButton
            onExcel={handleExportExcel}
            onPdf={handleExportPDF}
            disabled={!rows.length}
          />
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="product">By Product</TabsTrigger>
              <TabsTrigger value="salesperson">By Salesperson</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-35">
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={currentSortValue} onValueChange={handleSortChange}>
            <SelectTrigger className="w-55">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {uploadResult && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            uploadResult.ok
              ? "border-success/30 bg-success/10 text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{uploadResult.message}</span>
            <button
              type="button"
              className="text-xs underline shrink-0"
              onClick={() => setUploadResult(null)}
            >
              Dismiss
            </button>
          </div>
          {uploadResult.details?.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs space-y-0.5">
              {uploadResult.details.slice(0, 5).map((d, i) => (
                <li key={i}>{typeof d === "string" ? d : JSON.stringify(d)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Top performer summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card transition-colors hover:border-accent/40">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Top {view === "product" ? "Product" : "Salesperson"} · Sale
                  Value
                </p>
                {loading || !stats ? (
                  <Skeleton className="h-6 w-32 mt-2" />
                ) : (
                  <>
                    <p className="text-lg font-semibold truncate mt-1">
                      {stats.bySale[entityKey]}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatRs(stats.bySale.saleValueRs)}
                    </p>
                  </>
                )}
              </div>
              <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card transition-colors hover:border-accent/40">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Top {view === "product" ? "Product" : "Salesperson"} · Volume
                </p>
                {loading || !stats ? (
                  <Skeleton className="h-6 w-32 mt-2" />
                ) : (
                  <>
                    <p className="text-lg font-semibold truncate mt-1">
                      {stats.byVolume[entityKey]}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatNumber(stats.byVolume.saleVolumeKg)} Kg sold
                    </p>
                  </>
                )}
              </div>
              <Package className="w-5 h-5 text-blue-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card transition-colors hover:border-accent/40">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Best Achievement %
                </p>
                {loading || !stats ? (
                  <Skeleton className="h-6 w-32 mt-2" />
                ) : stats.byAchv ? (
                  <>
                    <p className="text-lg font-semibold truncate mt-1">
                      {stats.byAchv[entityKey]}
                    </p>
                    <p className="text-sm text-accent font-medium">
                      {formatPct(stats.byAchv.valueAchievementPct)}
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-semibold mt-1">-</p>
                )}
              </div>
              <Percent className="w-5 h-5 text-green-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card transition-colors hover:border-accent/40">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Total Sale Value
                </p>
                {loading || !stats ? (
                  <Skeleton className="h-6 w-32 mt-2" />
                ) : (
                  <>
                    <p className="text-lg font-semibold truncate mt-1">
                      {formatRs(stats.totalSaleValueRs)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      vs {formatRs(stats.totalTargetValueRs)} target ·{" "}
                      {formatPct(stats.overallAchvPct)}
                    </p>
                  </>
                )}
              </div>
              <Wallet className="w-5 h-5 text-violet-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 overview chart */}
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border pb-5">
          <CardTitle>
            Top 10 {view === "product" ? "Products" : "Salespeople"} by Sale
            Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : top10.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
              No data for this filter.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={top10}
                margin={{ top: 10, right: 20, left: 0, bottom: 60 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.22 0.005 260)"
                  vertical={false}
                />
                <XAxis
                  dataKey={entityKey}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={80}
                  tick={{ fontSize: 11, fill: "oklch(0.65 0 0)" }}
                />
                <YAxis
                  tickFormatter={(v) => formatCompact(v)}
                  tick={{ fontSize: 11, fill: "oklch(0.65 0 0)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "oklch(0.12 0.005 260)",
                    border: "1px solid oklch(0.22 0.005 260)",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "oklch(0.95 0 0)" }}
                  itemStyle={{ color: "oklch(0.95 0 0)" }}
                  formatter={(v) => formatRs(v)}
                />
                <Bar
                  dataKey="saleValueRs"
                  name="Sale Value"
                  radius={[4, 4, 0, 0]}
                  onClick={(data) => setSelectedEntity(data[entityKey])}
                  cursor="pointer"
                >
                  {top10.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry[entityKey] === selectedEntity
                          ? "oklch(0.7 0.18 145)"
                          : "oklch(0.7 0.18 220)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Drill-down monthly trend chart */}
      {selectedEntity && (
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border pb-5">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Monthly Trend — {selectedEntity}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entityChartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                No monthly data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={entityChartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.22 0.005 260)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: "oklch(0.65 0 0)" }}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCompact(v)}
                    tick={{ fontSize: 11, fill: "oklch(0.65 0 0)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.12 0.005 260)",
                      border: "1px solid oklch(0.22 0.005 260)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "oklch(0.95 0 0)" }}
                    itemStyle={{ color: "oklch(0.95 0 0)" }}
                    formatter={(v) => formatRs(v)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Target"
                    stroke="oklch(0.65 0 0)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Sale"
                    stroke="oklch(0.7 0.18 145)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data table */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="border-b border-border pb-5">
          <CardTitle>
            {view === "product" ? "All Products" : "All Salespeople"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-border/70">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-semibold text-foreground hover:text-accent"
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
                    No data found.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={() => setSelectedEntity(row.original[entityKey])}
                    className={cn(
                      "cursor-pointer border-border/50 hover:bg-secondary/40",
                      selectedEntity === row.original[entityKey] &&
                        "bg-muted/60",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="whitespace-nowrap px-4 py-3 text-xs text-foreground/90"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-secondary/30 py-4">
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
              {rows.length === 0
                ? "0 results"
                : `Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()} · ${rows.length} results`}
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

export default function TrendsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TrendsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
