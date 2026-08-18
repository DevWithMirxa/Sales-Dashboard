"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import SalesPersonForm from "@/components/forms/SalesPersonForm";
import RegionForm from "@/components/forms/RegionForm";
import ProductForm from "@/components/forms/ProductForm";
import api from "@/lib/api";
import { Download } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";

const COLORS = ["#0066cc", "#00b4d8", "#90e0ef", "#caf0f8"];

function Dashboard() {
  const [filters, setFilters] = useState({
    region: "all",
    product: "all",
    salesperson: "all",
  });

  // Monthly / Quarterly / Yearly breakdown controls + fetched series
  const [breakdown, setBreakdown] = useState({
    granularity: "month",
    year: "all",
  });
  const [trendSeries, setTrendSeries] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  // Label describing the Breakdown unit so KPI/chart titles stay meaningful
  const periodUnit =
    breakdown.granularity === "quarter"
      ? "Quarter"
      : breakdown.granularity === "year"
        ? "Year"
        : "Month";

  const [activeForm, setActiveForm] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dashboard data state
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

  const buildQuery = useCallback((f, breakdown) => {
    const params = new URLSearchParams();
    // Send the Breakdown granularity so KPIs/charts return per-period figures
    params.set("granularity", breakdown.granularity || "year");
    if (f.region !== "all") params.set("region", f.region);
    if (f.product !== "all") params.set("product", f.product);
    if (f.salesperson !== "all") params.set("salesperson", f.salesperson);
    // "all" (default) = don't filter by year
    if (breakdown.year && breakdown.year !== "all") {
      params.set("year", breakdown.year);
    }
    return params.toString();
  }, []);

  const fetchDashboardData = useCallback(
    async (currentFilters, breakdown) => {
      try {
        setLoading(true);
        const qs = buildQuery(currentFilters, breakdown);

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
          regionProdRes.data || { data: [], products: [] },
        );
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery],
  );

  // Fetch on mount and whenever filters or the breakdown changes
  useEffect(() => {
    fetchDashboardData(filters, breakdown);
  }, [filters, breakdown, fetchDashboardData]);

  // Fetch the Monthly / Quarterly / Yearly breakdown series from /trends/series
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
    // Keep the selection in the URL so it survives a page refresh
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
          : window.location.pathname,
      );
    }
  };

  // Restore Breakdown + Duration from the URL query string on load
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

  // Export the currently-loaded dashboard data as a single CSV combining the
  // sale breakdown, region sales, top products, and top salesmen tables.
  const handleExport = () => {
    const rows = [];

    (trendSeries || []).forEach((t) =>
      rows.push({
        section: "Sale Breakdown",
        name: t.label || t.period || "",
        sales: t.value ?? t.sales ?? "",
        target: "",
        volume: "",
      }),
    );

    (regionSales || []).forEach((r) =>
      rows.push({
        section: "Region Sales",
        name: r.region || "",
        sales: r.sales ?? "",
        target: r.target ?? "",
        volume: "",
      }),
    );

    (topProducts || []).forEach((p) =>
      rows.push({
        section: "Top Products",
        name: p.name || "",
        sales: p.sales ?? "",
        target: "",
        volume: p.volume ?? "",
      }),
    );

    (summary.topSalesmen || []).forEach((s) =>
      rows.push({
        section: "Top Salesmen",
        name: s.name || "",
        region: s.region || "",
        sales: s.sales ?? "",
        target: "",
        volume: s.mt ?? "",
      }),
    );

    exportToCSV(
      rows,
      [
        { label: "Section", key: "section" },
        { label: "Name / Period", key: "name" },
        { label: "Region", key: "region" },
        { label: "Sales (Rs)", key: "sales" },
        { label: "Target (Rs)", key: "target" },
        { label: "Volume (MT)", key: "volume" },
      ],
      "sales-dashboard",
    );
  };

  const recentSalesColumns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Salesman",
        meta: { cellClassName: "text-gray-900" },
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
          return val >= 1000000
            ? `Rs ${(val / 1000000).toFixed(2)}M`
            : `Rs ${(val / 1000).toFixed(0)}K`;
        },
        meta: { cellClassName: "font-medium text-gray-900" },
      },
      {
        accessorKey: "mt",
        header: "Volume (MT)",
        cell: ({ getValue }) => `${getValue()} MT`,
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: () => (
          <span className="px-3 py-1 inline-flex items-center gap-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Sales Dashboard
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <div className="text-sm text-gray-600">
                Last updated: {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
          <FilterBar
            onFilterChange={handleFilterChange}
            onBreakdownChange={handleBreakdownChange}
            breakdown={breakdown}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-125">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Insufficient granularity notice */}
            {summary.insufficientGranularity && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                <strong>Note:</strong> Daily and Weekly breakdowns are not
                available — the underlying data is monthly. Please select
                Monthly, Quarterly, or Yearly for meaningful results.
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <KPICard
                title={`Sale / ${periodUnit} (Rs)`}
                value={`Rs ${(summary.totalSaleRs / 1000000).toFixed(2)}M`}
              />
              <KPICard
                title={`Sale / ${periodUnit} (MT)`}
                value={`${summary.totalSaleMT} MT`}
              />
              <KPICard
                title={`Target / ${periodUnit} (Rs)`}
                value={`Rs ${(summary.totalTargetRs / 1000000).toFixed(2)}M`}
              />
              <KPICard
                title="% Target Achievement"
                value={`${summary.targetAchievement}%`}
              />
              <KPICard
                title="Active Regions"
                value={
                  summary.activeRegions !== undefined
                    ? summary.activeRegions.toString()
                    : "0"
                }
              />
              <KPICard
                title="Recovery"
                value={
                  summary.recovery !== undefined
                    ? `Rs ${(summary.recovery / 1000000).toFixed(2)}M`
                    : "0"
                }
              />
            </div>

            {/* Sales Breakdown (Monthly / Quarterly / Yearly) */}
            <ChartCard
              title={`Sale Breakdown — ${
                breakdown.granularity === "year"
                  ? "Yearly"
                  : breakdown.granularity === "quarter"
                    ? "Quarterly"
                    : "Monthly"
              }${
                breakdown.year && breakdown.year !== "all"
                  ? ` · ${breakdown.year}`
                  : " · All Years"
              }`}
            >
              {seriesLoading ? (
                <div className="flex items-center justify-center h-75">
                  <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              ) : trendSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trendSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="label"
                      stroke="#6b7280"
                      interval={breakdown.granularity === "month" ? 2 : 0}
                    />
                    <YAxis
                      stroke="#6b7280"
                      tickFormatter={(v) =>
                        v >= 1000000
                          ? `${(v / 1000000).toFixed(1)}M`
                          : `${(v / 1000).toFixed(0)}K`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                      }}
                      formatter={(value, _name) => [
                        `Rs ${(value / 1000000).toFixed(2)}M`,
                        "Sale",
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="value" fill="#0066cc" name="Sale (Rs)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-75 text-gray-400">
                  No data for selected breakdown. Choose a year from the filter
                  above.
                </div>
              )}
            </ChartCard>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Region wise Sales */}
              <ChartCard
                title={`Region wise Sale / ${periodUnit} (Rs)`}
                onFormOpen={() => setActiveForm("region")}
              >
                {regionSales.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={regionSales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="region" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="sales" fill="#0066cc" name="Actual Sales" />
                      <Bar dataKey="target" fill="#90e0ef" name="Target" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-75 text-gray-400">
                    No data for selected filters
                  </div>
                )}
              </ChartCard>

              {/* Top 3 Products */}
              <ChartCard
                title={`Top 3 Products / ${periodUnit}`}
                onFormOpen={() => setActiveForm("product")}
              >
                {topProducts.length > 0 ? (
                  <div className="flex gap-8">
                    <ResponsiveContainer width="50%" height={300}>
                      <PieChart>
                        <Pie
                          data={topProducts}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="sales"
                        >
                          {topProducts.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 flex flex-col justify-center space-y-4">
                      {topProducts.map((product, index) => (
                        <div
                          key={product.id || product.name}
                          className="flex items-center gap-3"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Rs {(product.sales / 1000000).toFixed(2)}M •{" "}
                              {product.volume} MT
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-75 text-gray-400">
                    No data for selected filters
                  </div>
                )}
              </ChartCard>
            </div>

            {/* Second Row Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Region wise Product Composition by Volume */}
              <ChartCard
                title={`Region wise Product Comp / ${periodUnit} (Vol)`}
                onFormOpen={() => setActiveForm("region")}
              >
                {regionProductComparison.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={regionProductComparison.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="region" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                        }}
                      />
                      <Legend />
                      {regionProductComparison.products.map((prodName, i) => (
                        <Bar
                          key={prodName}
                          dataKey={prodName}
                          fill={COLORS[i % COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-75 text-gray-400">
                    No data for selected filters
                  </div>
                )}
              </ChartCard>

              {/* Top 3 Salesmen */}
              <ChartCard
                title={`Top 3 Salesmen / ${periodUnit}`}
                onFormOpen={() => setActiveForm("salesperson")}
              >
                {summary.topSalesmen.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={summary.topSalesmen} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" stroke="#6b7280" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="#6b7280"
                        width={120}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                        }}
                      />
                      <Bar dataKey="sales" fill="#0066cc" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-75 text-gray-400">
                    No data for selected filters
                  </div>
                )}
              </ChartCard>
            </div>

            {/* Sales Table */}
            <TableCard title={`Top Salesmen / ${periodUnit}`}>
              <TanStackDataTable
                columns={recentSalesColumns}
                data={summary.topSalesmen}
                emptyMessage="No sales data for selected filters."
                getRowId={(row) => row.name}
                wrapperClassName="overflow-hidden"
              />
            </TableCard>
          </>
        )}
      </div>

      {/* Forms - Modals/Drawers */}
      {activeForm === "customer" && <CustomerForm onClose={closeForm} />}
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
