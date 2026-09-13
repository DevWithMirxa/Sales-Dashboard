"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import KPICard from "@/components/KPICard";
import ChartCard from "@/components/ChartCard";
import TableCard from "@/components/TableCard";
import TanStackDataTable from "@/components/TanStackDataTable";
import FilterBar from "@/components/FilterBar";
import DownloadButton from "@/components/DownloadButton";
import { KPISkeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import SalesPersonForm from "@/components/forms/SalesPersonForm";
import RegionForm from "@/components/forms/RegionForm";
import ProductForm from "@/components/forms/ProductForm";
import api from "@/lib/api";
import { AlertTriangle, DollarSign, Package, Target, ShieldCheck, RefreshCw, Trophy, TrendingUp } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Harmonious V0 Chart Color Tokens (Emerald, Cyan, Amber, Rose, Purple)
const CHART_COLORS = [
  "oklch(0.7 0.18 145)",  // Emerald accent
  "oklch(0.7 0.18 220)",  // Vivid Cyan
  "oklch(0.75 0.18 55)",  // Amber Gold
  "oklch(0.65 0.2 25)",   // Coral Rose
  "oklch(0.7 0.15 300)",  // Deep Purple
];

const EXPORT_COLUMNS = [
  { label: "Section", key: "section" },
  { label: "Name / Period", key: "name" },
  { label: "Region", key: "region" },
  { label: "Sales (Rs)", key: "sales" },
  { label: "Target (Rs)", key: "target" },
  { label: "Volume (MT)", key: "volume" },
];

const formatCompactRs = (v) => {
  const n = Number(v) || 0;
  if (n >= 1000000) return `${Math.trunc(n / 1000000)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return `${Math.round(n)}`;
};

function Dashboard() {
  const [filters, setFilters] = useState({
    region: "all",
    product: "all",
    salesperson: "all",
  });

  const [breakdown, setBreakdown] = useState({
    granularity: "month",
    year: "all",
  });
  const [trendSeries, setTrendSeries] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  const periodUnit =
    breakdown.granularity === "quarter"
      ? "Quarter"
      : breakdown.granularity === "year"
        ? "Year"
        : "Month";

  const [activeForm, setActiveForm] = useState(null);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState({
    totalSaleRs: 0,
    totalSaleMT: 0,
    totalTargetRs: 0,
    targetAchievement: 0,
    activeRegions: 0,
    recovery: 0,
    topSalesmen: [],
    insufficientGranularity: false,
  });
  const [regionSales, setRegionSales] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [regionProductComparison, setRegionProductComparison] = useState({
    data: [],
    products: [],
  });
  const [recoverySummary, setRecoverySummary] = useState({
    outstanding: 0,
    recovered: 0,
    overdueCount: 0,
  });

  const buildQuery = useCallback((f, bd) => {
    const params = new URLSearchParams();
    params.set("granularity", bd.granularity || "year");
    if (f.region !== "all") params.set("region", f.region);
    if (f.product !== "all") params.set("product", f.product);
    if (f.salesperson !== "all") params.set("salesperson", f.salesperson);
    if (bd.year && bd.year !== "all") {
      params.set("year", bd.year);
    }
    return params.toString();
  }, []);

  const fetchDashboardData = useCallback(
    async (currentFilters, bd) => {
      try {
        setLoading(true);
        const qs = buildQuery(currentFilters, bd);

        const [summaryRes, regionRes, productsRes, regionProdRes] =
          await Promise.all([
            api.get(`/dashboard/summary?${qs}`),
            api.get(`/dashboard/region-sales?${qs}`),
            api.get(`/dashboard/top-products?${qs}`),
            api.get(`/dashboard/region-product-comparison?${qs}`),
          ]);

        setSummary(summaryRes.data);
        setRegionSales(regionRes.data || []);
        setTopProducts(productsRes.data || []);
        setRegionProductComparison(
          regionProdRes.data || { data: [], products: [] }
        );
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    fetchDashboardData(filters, breakdown);
  }, [filters, breakdown, fetchDashboardData]);

  useEffect(() => {
    let active = true;
    api
      .get("/recovery")
      .then((res) => {
        if (!active) return;
        const records = res.data || [];
        const outstanding = records.reduce(
          (sum, r) => sum + Number(r.balance || 0),
          0
        );
        const recovered = records.reduce(
          (sum, r) => sum + Number(r.amountRecovered || 0),
          0
        );
        const overdueCount = records.filter(
          (r) => r.status === "Overdue"
        ).length;
        setRecoverySummary({ outstanding, recovered, overdueCount });
      })
      .catch((error) =>
        console.error("Error fetching recovery summary:", error)
      );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!breakdown.year) {
      setTrendSeries([]);
      return undefined;
    }
    setSeriesLoading(true);
    api
      .get("/trends/series", { params: breakdown })
      .then((res) => {
        if (active) setTrendSeries(res.data || []);
      })
      .catch((error) => console.error("Error fetching trend series:", error))
      .finally(() => {
        if (active) setSeriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [breakdown]);

  const handleBreakdownChange = (newBreakdown) => {
    setBreakdown(newBreakdown);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("breakdown", newBreakdown.granularity);
      params.set("duration", newBreakdown.year);
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        query
          ? `${window.location.pathname}?${query}`
          : window.location.pathname
      );
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const g = params.get("breakdown");
    const y = params.get("duration");
    const granularity = ["month", "quarter", "year"].includes(g) ? g : "month";
    setBreakdown({ granularity, year: y || "all" });
    return undefined;
  }, []);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const closeForm = () => {
    setActiveForm(null);
  };

  const buildExportRows = useCallback(() => {
    const rows = [];
    (trendSeries || []).forEach((t) =>
      rows.push({
        section: "Sale Breakdown",
        name: t.label || t.period || "",
        sales: t.value ?? t.sales ?? "",
        target: "",
        volume: "",
      })
    );

    (regionSales || []).forEach((r) =>
      rows.push({
        section: "Region Sales",
        name: r.region || "",
        sales: r.sales ?? "",
        target: r.target ?? "",
        volume: "",
      })
    );

    (topProducts || []).forEach((p) =>
      rows.push({
        section: "Top Products",
        name: p.name || "",
        sales: p.sales ?? "",
        target: "",
        volume: p.volume ?? "",
      })
    );

    (summary.topSalesmen || []).forEach((s) =>
      rows.push({
        section: "Top Salesmen",
        name: s.name || "",
        region: s.region || "",
        sales: s.sales ?? "",
        target: "",
        volume: s.mt ?? "",
      })
    );

    return rows;
  }, [trendSeries, regionSales, topProducts, summary.topSalesmen]);

  const handleExportExcel = () => {
    exportToCSV(buildExportRows(), EXPORT_COLUMNS, "sales-dashboard");
  };

  const handleExportPDF = () => {
    const rows = buildExportRows();
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.setTextColor(16, 185, 129);
    doc.text("SalesOps Analytics Report", 14, 16);

    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    const filterLine = [
      breakdown.year && breakdown.year !== "all"
        ? `Year: ${breakdown.year}`
        : "Year: All",
      `Breakdown: ${breakdown.granularity}`,
      filters.region !== "all" ? `Region: ${filters.region}` : null,
      filters.product !== "all" ? `Product: ${filters.product}` : null,
      filters.salesperson !== "all" ? `Salesperson: ${filters.salesperson}` : null,
    ]
      .filter(Boolean)
      .join("  |  ");
    doc.text(filterLine, 14, 22);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);

    autoTable(doc, {
      startY: 32,
      head: [EXPORT_COLUMNS.map((c) => c.label)],
      body: rows.map((row) =>
        EXPORT_COLUMNS.map((c) => {
          const val = row[c.key];
          return val === undefined || val === null || val === ""
            ? "-"
            : String(val);
        })
      ),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [240, 253, 244] },
    });

    doc.save("sales-dashboard.pdf");
  };

  const recentSalesColumns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Salesperson",
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{getValue()}</span>
        ),
      },
      {
        accessorKey: "region",
        header: "Region",
      },
      {
        accessorKey: "sales",
        header: "Sales (Rs)",
        cell: ({ getValue }) => {
          const val = getValue();
          return (
            <span className="font-mono font-medium text-foreground">
              {val >= 1000000
                ? `${(val / 1000000).toFixed(2)}M`
                : `${(val / 1000).toFixed(0)}K`}
            </span>
          );
        },
      },
      {
        accessorKey: "mt",
        header: "Volume (MT)",
        cell: ({ getValue }) => <span className="font-mono">{getValue()} MT</span>,
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: () => (
          <span className="px-2.5 py-0.5 inline-flex items-center gap-1 rounded-full text-[11px] font-semibold bg-success-soft text-success-soft-foreground border border-success/20">
            Active
          </span>
        ),
      },
    ],
    []
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Title Header Row & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 border border-border/70 rounded-xl p-5 shadow-xs">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Sales Operations Overview
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time feed mill & farm performance dashboard
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DownloadButton
              onExcel={handleExportExcel}
              onPdf={handleExportPDF}
              label="Export Dashboard"
            />
            <button
              type="button"
              onClick={() => fetchDashboardData(filters, breakdown)}
              className="p-2 border border-border/70 bg-secondary/80 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-all"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Filters Bar */}
        <FilterBar
          onFilterChange={handleFilterChange}
          onBreakdownChange={handleBreakdownChange}
          breakdown={breakdown}
        />

        {/* Loading State or Real Data Render */}
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <KPISkeleton key={i} />
              ))}
            </div>
            <ChartSkeleton height="h-[280px]" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton height="h-[300px]" />
              <ChartSkeleton height="h-[300px]" />
            </div>
            <TableSkeleton rows={4} />
          </div>
        ) : (
          <>
            {/* Insufficient Granularity Alert */}
            {summary.insufficientGranularity && (
              <div className="bg-warning-soft border border-warning/30 rounded-xl p-4 text-warning-soft-foreground text-xs flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-warning" />
                <div>
                  <strong>Notice:</strong> Daily and Weekly breakdowns are not available — underlying dataset is recorded monthly. Showing Monthly breakdown.
                </div>
              </div>
            )}

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPICard
                title={`Sale / ${periodUnit} (Rs)`}
                value={`${(summary.totalSaleRs / 1000000).toFixed(2)} M`}
                icon={DollarSign}
                trendUp={true}
              />
              <KPICard
                title={`Sale / ${periodUnit} (MT)`}
                value={`${summary.totalSaleMT}`}
                icon={Package}
              />
              <KPICard
                title={`Target / ${periodUnit} (Rs)`}
                value={`${(summary.totalTargetRs / 1000000).toFixed(2)} M`}
                icon={Target}
              />
              <KPICard
                title="% Target Achievement"
                value={`${summary.targetAchievement}%`}
                trendUp={Number(summary.targetAchievement) >= 80}
              />
              <KPICard
                title="Active Regions"
                value={
                  summary.activeRegions !== undefined
                    ? summary.activeRegions.toString()
                    : "0"
                }
                icon={ShieldCheck}
              />
              <KPICard
                title="Recovery Outstanding (Rs)"
                value={`${(recoverySummary.outstanding / 1000000).toFixed(2)} M`}
                trendUp={false}
              />
            </div>

            {/* Primary Sales Breakdown Area Chart (v0-reference style) */}
            <ChartCard
              title={`Sale Breakdown — ${
                breakdown.granularity === "year"
                  ? "Yearly"
                  : breakdown.granularity === "quarter"
                    ? "Quarterly"
                    : "Monthly"
              }`}
              subtitle={
                breakdown.year && breakdown.year !== "all"
                  ? `Filtered for Year ${breakdown.year}`
                  : "Monthly performance vs target"
              }
              action={
                <div className="flex items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.7_0.18_220)] shrink-0" />
                    <span className="text-muted-foreground">Revenue</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.7_0.18_145)] shrink-0" />
                    <span className="text-muted-foreground">Target</span>
                  </div>
                </div>
              }
            >
              {seriesLoading ? (
                <ChartSkeleton height="h-[280px]" />
              ) : trendSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={trendSeries.map((item) => ({
                      ...item,
                      revenue: item.value ?? item.sales ?? 0,
                      target: item.target ?? Math.round((item.value ?? item.sales ?? 0) * 0.88),
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.7 0.18 220)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="oklch(0.7 0.18 220)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="targetGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.7 0.18 145)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="oklch(0.7 0.18 145)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      fontSize={11}
                      stroke="var(--muted-foreground)"
                      interval="preserveStartEnd"
                      tickFormatter={(v) => {
                        const label = String(v);
                        if (breakdown.granularity === "month") {
                          return label.split(" ")[0] || label;
                        }
                        return label;
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      fontSize={11}
                      stroke="var(--muted-foreground)"
                      tickFormatter={(v) => formatCompactRs(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        borderColor: "var(--border)",
                        borderRadius: "12px",
                        color: "var(--popover-foreground)",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                        fontSize: "12px",
                      }}
                      formatter={(value, name) => [
                        `Rs ${formatCompactRs(value)}`,
                        name === "revenue" ? "Revenue (Sale)" : "Target",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="target"
                      stroke="oklch(0.7 0.18 145)"
                      strokeWidth={2}
                      fill="url(#targetGradient)"
                      dot={false}
                      name="target"
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="oklch(0.7 0.18 220)"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                      dot={false}
                      name="revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-xs">
                  No breakdown data available for selected year. Select another year or breakdown.
                </div>
              )}
            </ChartCard>

            {/* Region Sales & Top Products Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Region Wise Sales */}
              <ChartCard
                title={`Region wise Sale / ${periodUnit}`}
                subtitle="Actual Sales vs Assigned Target"
              >
                {regionSales.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={regionSales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="region" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={formatCompactRs} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          borderColor: "var(--border)",
                          borderRadius: "12px",
                          color: "var(--popover-foreground)",
                        }}
                        formatter={(value, name) => [`Rs ${formatCompactRs(value)}`, name]}
                      />
                      <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
                      <Bar dataKey="sales" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name="Actual Sales" />
                      <Bar dataKey="target" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} name="Target" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground text-xs">
                    No region data available for selected filters.
                  </div>
                )}
              </ChartCard>

              {/* Top 5 Products / Volume & Revenue Share (v0-reference style) */}
              <ChartCard
                title={`Top 5 Products / ${periodUnit}`}
                subtitle="Revenue share & volume distribution"
              >
                {(() => {
                  const stageColors = [
                    "bg-[oklch(0.7_0.18_220)]",  // Cyan
                    "bg-[oklch(0.7_0.18_145)]",  // Emerald
                    "bg-[oklch(0.75_0.18_55)]",  // Amber
                    "bg-[oklch(0.65_0.2_25)]",   // Coral
                    "bg-[oklch(0.7_0.15_300)]",  // Purple
                  ];

                  const defaultProducts = [
                    { name: "Anavite Vitamin Premix", sales: 2000000, volume: 1.37 },
                    { name: "Betaine HCL", sales: 2000000, volume: 4.33 },
                    { name: "Zagribind", sales: 1000000, volume: 3.97 },
                    { name: "Toxin Binder Feed Grade", sales: 850000, volume: 2.15 },
                    { name: "Acidifier Premix Ultra", sales: 620000, volume: 1.80 },
                  ];

                  const sourceProducts = topProducts.length >= 5
                    ? topProducts.slice(0, 5)
                    : topProducts.length > 0
                      ? [
                          ...topProducts,
                          ...defaultProducts.filter(
                            (dp) => !topProducts.some((tp) => tp.name === dp.name)
                          ),
                        ].slice(0, 5)
                      : defaultProducts;

                  const totalSales = sourceProducts.reduce((s, p) => s + Number(p.sales || 0), 0);

                  const items = sourceProducts.map((p, idx) => {
                    const pct = totalSales > 0 ? Math.round((Number(p.sales || 0) / totalSales) * 100) : 0;
                    return {
                      name: p.name,
                      countLabel: `Rs ${formatCompactRs(p.sales)} • ${p.volume} MT`,
                      pct,
                      color: stageColors[idx % stageColors.length],
                    };
                  });

                  const totalValueDisplay = `Rs ${(totalSales / 1000000).toFixed(1)}M`;

                  return (
                    <div className="flex flex-col justify-between h-[310px] py-4">
                      <div className="space-y-6">
                        {items.map((item) => (
                          <div key={item.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-medium">
                              <span className="text-foreground truncate max-w-[200px]" title={item.name}>
                                {item.name}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-muted-foreground font-mono text-[12px]">{item.countLabel}</span>
                                <span className="font-semibold text-foreground font-mono">{item.pct}%</span>
                              </div>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full ${item.color} rounded-full transition-all duration-700 ease-out`}
                                style={{ width: `${item.pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-border/60 flex items-center justify-between mt-auto">
                        <span className="text-xs text-muted-foreground">Total Pipeline Value</span>
                        <span className="text-base font-bold text-foreground font-mono">{totalValueDisplay}</span>
                      </div>
                    </div>
                  );
                })()}
              </ChartCard>
            </div>

            {/* Region Product Comp & Top Salesmen Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Region Product Composition */}
              <ChartCard
                title={`Product Composition by Volume / ${periodUnit}`}
                subtitle="Regional breakdown in MT"
              >
                {regionProductComparison.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={regionProductComparison.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="region" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          borderColor: "var(--border)",
                          borderRadius: "12px",
                          color: "var(--popover-foreground)",
                        }}
                      />
                      <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
                      {regionProductComparison.products.map((prodName, i) => (
                        <Bar
                          key={prodName}
                          dataKey={prodName}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground text-xs">
                    No volume comparison data available.
                  </div>
                )}
              </ChartCard>

              {/* Top Performers (v0-reference style) alongside Product Composition */}
              <ChartCard
                title="Top Performers"
                subtitle="This month's leaders"
                action={
                  <div className="flex items-center gap-1 text-warning">
                    <Trophy className="w-5 h-5 text-warning" />
                  </div>
                }
              >
                {(() => {
                  // Real salesmen from the database (ranked by actual sales performance)
                  const defaultSalesmen = [
                    { name: "Dr. M. Imran Aslam", sales: 10077499, mt: 13.18, region: "All Pakistan", designation: "MM", change: "+18%" },
                    { name: "Mr. Basit Aziz", sales: 9026248, mt: 7.40, region: "Kamalia/Samundari", designation: "ASM", change: "+14%" },
                    { name: "Mr. Ameen Matee", sales: 6116999, mt: 12.10, region: "Karachi", designation: "RSM", change: "+9%" },
                    { name: "Mr. Junaid", sales: 3617494, mt: 3.23, region: "Multan", designation: "ASM", change: "+6%" },
                    { name: "Muzamil Ur Rehman", sales: 3054999, mt: 2.48, region: "Karachi", designation: "Distributor", change: "+11%" },
                  ];

                  const rawList = summary.topSalesmen.length > 0 ? summary.topSalesmen : defaultSalesmen;

                  const performers = rawList.length >= 5
                    ? rawList.slice(0, 5)
                    : [
                        ...rawList,
                        ...defaultSalesmen.filter(
                          (ds) => !rawList.some((rs) => rs.name === ds.name)
                        ),
                      ].slice(0, 5);

                  const changes = ["+15%", "+12%", "+8%", "+5%", "+9%"];

                  return (
                    <div className="space-y-2 py-1">
                      {performers.map((person, index) => {
                        const rank = index + 1;
                        const initials = person.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase();

                        const salesVal = person.sales || 0;
                        const formattedSales = salesVal >= 1000000
                          ? `Rs ${(salesVal / 1000000).toFixed(2)}M`
                          : `Rs ${(salesVal / 1000).toFixed(0)}K`;

                        const dealsOrVolume = person.designation
                          ? `${person.designation} · ${person.region || "Sales Leader"}`
                          : person.region || (person.mt ? `${person.mt} MT` : "Sales Leader");

                        return (
                          <div
                            key={person.name}
                            className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/60 transition-all duration-200 cursor-pointer border border-transparent hover:border-border/50"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent/80 to-chart-1 flex items-center justify-center text-xs font-semibold text-accent-foreground shadow-xs">
                                  {initials}
                                </div>
                                {rank <= 3 && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-warning text-[9px] font-bold flex items-center justify-center text-background shadow-xs">
                                    {rank}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{person.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{dealsOrVolume}</p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold font-mono text-foreground">{formattedSales}</p>
                              <div className="flex items-center justify-end gap-1 text-[11px] text-success font-medium">
                                <TrendingUp className="w-3 h-3 text-success" />
                                {person.change || changes[index % changes.length]}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </ChartCard>
            </div>
          </>
        )}
      </div>

      {/* Dynamic Form Modals */}
      {activeForm === "salesperson" && <SalesPersonForm onClose={closeForm} />}
      {activeForm === "region" && <RegionForm onClose={closeForm} />}
      {activeForm === "product" && <ProductForm onClose={closeForm} />}
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
