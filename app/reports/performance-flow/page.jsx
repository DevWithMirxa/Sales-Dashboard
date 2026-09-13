"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import { ArrowLeft, Package, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/ui/skeleton";
// Ribbon/flow comparison chart - shows how each salesperson's or product's
// share of team revenue shifts from one period to the next. Generic despite
// the filename (id/name/value in, ribbons out), reused here for both types.
import SalespersonPerformanceFlow from "@/components/charts/SalespersonPerformanceFlow";

// How many top salespeople/products get their own ribbon. Keeps the chart
// readable - everyone outside the top N still counts toward each period's
// total, they just don't get a labeled block of their own.
const FLOW_CHART_TOP_N = 6;

const viewLabel = (view) =>
  view === "monthly"
    ? "Monthly"
    : view === "quarterly"
      ? "Quarterly"
      : "Annual";

const viewUnit = (view) =>
  view === "monthly" ? "month" : view === "quarterly" ? "quarter" : "year";

const monthLabel = (period) => {
  const [year, month] = period.split("-");
  const months = [
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
  return `${months[Number(month) - 1] || "Unknown"} ${year}`;
};

const getYearFromPeriod = (period) =>
  Number(String(period || "").split("-")[0]);

const getPeriodBucket = (period, view) => {
  if (!period) return null;
  const [yearText, monthText] = period.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return null;

  if (view === "quarterly") {
    const quarter = Math.ceil(month / 3);
    return {
      key: `${year}-Q${quarter}`,
      label: `Q${quarter} ${year}`,
      sortValue: year * 10 + quarter,
    };
  }
  if (view === "yearly") {
    return { key: String(year), label: String(year), sortValue: year };
  }
  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    label: monthLabel(period),
    sortValue: year * 100 + month,
  };
};

// Stable id for a name so the chart can draw a ribbon connecting the same
// salesperson/product across periods even if display casing varies.
const slugify = (name) =>
  String(name || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";

// Buckets rows by period and by the given field ("salesperson" or "product"),
// then keeps only the top N groups by total sale value. Shape matches what
// SalespersonPerformanceFlow expects: [{ period, entries: [{id,name,value}] }].
const buildFlowData = (rows, groupField, view) => {
  const byBucket = {};

  rows.forEach((row) => {
    const bucket = getPeriodBucket(row.period, view);
    if (!bucket) return;
    const groupName = row[groupField] || "Unknown";
    if (!byBucket[bucket.key]) {
      byBucket[bucket.key] = {
        label: bucket.label,
        sortValue: bucket.sortValue,
        totals: {},
      };
    }
    byBucket[bucket.key].totals[groupName] =
      (byBucket[bucket.key].totals[groupName] || 0) +
      Number(row.saleValueRs || 0);
  });

  const buckets = Object.values(byBucket).sort(
    (a, b) => a.sortValue - b.sortValue,
  );

  const grandTotals = {};
  buckets.forEach((b) => {
    Object.entries(b.totals).forEach(([name, val]) => {
      grandTotals[name] = (grandTotals[name] || 0) + val;
    });
  });

  const topNames = Object.entries(grandTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, FLOW_CHART_TOP_N)
    .map(([name]) => name);

  return buckets.map((b) => ({
    period: b.label,
    entries: topNames
      .filter((name) => b.totals[name] > 0)
      .map((name) => ({ id: slugify(name), name, value: b.totals[name] })),
  }));
};

function PerformanceFlow() {
  const searchParams = useSearchParams();

  const [trendRows, setTrendRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [reportType, setReportType] = useState(
    searchParams.get("type") === "product" ? "product" : "salesperson",
  );
  const [view, setView] = useState(() => {
    const v = searchParams.get("view");
    return ["monthly", "quarterly", "yearly"].includes(v) ? v : "monthly";
  });
  const [selectedYear, setSelectedYear] = useState(
    searchParams.get("year") || "",
  );

  const fetchTrends = async () => {
    try {
      setLoading(true);
      setFetchError("");
      const res = await api.get("/trends", { params: { limit: 50000 } });
      setTrendRows(res.data.rows || []);
    } catch (error) {
      console.error("Error loading trend data:", error);
      setFetchError(
        "Unable to load trend data. Check your network connection or API server.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const years = useMemo(() => {
    const set = new Set(
      (trendRows || [])
        .map((row) => getYearFromPeriod(row.period))
        .filter(Boolean),
    );
    return [...set].sort((a, b) => a - b);
  }, [trendRows]);

  // Default to the latest year once trend data has loaded, if none was
  // supplied via the query string (or it doesn't match any real year).
  useEffect(() => {
    if (!years.length) return;
    if (!selectedYear || !years.includes(Number(selectedYear))) {
      setSelectedYear(String(years[years.length - 1]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years]);

  // Bounded the same way as the main Reports page's trend chart: scoped to
  // the selected year unless Annual view, where every year is its own bar.
  const flowSourceRows = useMemo(() => {
    if (view === "yearly" || !selectedYear) return trendRows;
    return trendRows.filter(
      (row) => getYearFromPeriod(row.period) === Number(selectedYear),
    );
  }, [trendRows, view, selectedYear]);

  const flowChartData = useMemo(
    () => buildFlowData(flowSourceRows, reportType, view),
    [flowSourceRows, reportType, view],
  );

  // Give each period column more room as the period count grows, so Monthly
  // view (up to 12 columns) doesn't feel any more cramped than Annual (a
  // handful of columns) - this is the whole reason this moved off a dialog.
  const chartWidth = Math.max(1200, flowChartData.length * 230);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2 gap-1.5 text-xs text-muted-foreground"
              asChild
            >
              <Link href="/reports">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Reports
              </Link>
            </Button>
            <h1 className="text-lg font-semibold text-foreground">
              Performance Flow
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              How each{" "}
              {reportType === "product" ? "product's" : "salesperson's"} share
              of total sale value shifts from one {viewUnit(view)} to the next.
            </p>
          </div>

          <div className="flex max-w-full flex-wrap items-center gap-2">
            <Tabs value={reportType} onValueChange={setReportType}>
              <TabsList className="bg-secondary border border-border p-1">
                <TabsTrigger
                  value="salesperson"
                  className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:text-foreground"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  Salesperson
                </TabsTrigger>
                <TabsTrigger
                  value="product"
                  className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:text-foreground"
                >
                  <Package className="h-3.5 w-3.5" />
                  Product
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={view} onValueChange={setView}>
              <TabsList className="bg-secondary border border-border p-1">
                <TabsTrigger
                  value="monthly"
                  className="text-xs data-[state=active]:bg-card data-[state=active]:text-foreground"
                >
                  Monthly
                </TabsTrigger>
                <TabsTrigger
                  value="quarterly"
                  className="text-xs data-[state=active]:bg-card data-[state=active]:text-foreground"
                >
                  Quarterly
                </TabsTrigger>
                <TabsTrigger
                  value="yearly"
                  className="text-xs data-[state=active]:bg-card data-[state=active]:text-foreground"
                >
                  Annual
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {view !== "yearly" && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-20 text-xs">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {fetchError && !loading && (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{fetchError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTrends}
              className="shrink-0 border-destructive/40 text-xs text-destructive hover:bg-destructive/20"
            >
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <ChartSkeleton height="h-[400px]" />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {reportType === "product" ? "Product" : "Salesperson"}{" "}
                  comparison — {viewLabel(view)}
                  {view !== "yearly" && selectedYear
                    ? ` · ${selectedYear}`
                    : ""}
                </h2>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-normal text-muted-foreground"
              >
                Top {FLOW_CHART_TOP_N} by sale value
              </Badge>
            </div>

            {flowChartData.length >= 2 ? (
              <SalespersonPerformanceFlow
                data={flowChartData}
                metricLabel="k"
                height={640}
                width={chartWidth}
                colW={200}
              />
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Not enough periods with data to draw a comparison graph yet. Try
                Quarterly or Annual view, or a year with more history.
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function PerformanceFlowPage() {
  return (
    <ProtectedRoute>
      <PerformanceFlow />
    </ProtectedRoute>
  );
}
