"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import DownloadButton from "@/components/DownloadButton";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Shared helpers (mirrors the equivalents in the main Reports page) ---

const formatCurrency = (value) =>
  typeof value === "number" ? `Rs ${value.toLocaleString("en-US")}` : "Rs 0";

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

const viewLabel = (view) =>
  view === "monthly"
    ? "Monthly"
    : view === "quarterly"
      ? "Quarterly"
      : "Annual";

const viewUnit = (view) =>
  view === "monthly" ? "month" : view === "quarterly" ? "quarter" : "year";

const getYearFromPeriod = (period) =>
  Number(String(period || "").split("-")[0]);

const getMonthFromPeriod = (period) =>
  Number(String(period || "").split("-")[1]);

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
    return {
      key: String(year),
      label: String(year),
      sortValue: year,
    };
  }

  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    label: monthLabel(period),
    sortValue: year * 100 + month,
  };
};

// Builds the label for each period after `bucket` - e.g. from Q1 2026 with
// count 3 -> ["Q2 2026", "Q3 2026", "Q4 2026"].
const getNextPeriodLabels = (bucket, view, count) => {
  if (!bucket) return Array.from({ length: count }, (_, i) => `P${i + 1}`);

  if (view === "quarterly") {
    const [, yearText, quarterText] =
      bucket.key.match(/^(\d{4})-Q([1-4])$/) || [];
    const startYear = Number(yearText);
    const startQuarter = Number(quarterText);
    return Array.from({ length: count }, (_, index) => {
      const absoluteQuarter = startQuarter + index;
      const year = startYear + Math.floor(absoluteQuarter / 4);
      const quarter = (absoluteQuarter % 4) + 1;
      return `Q${quarter} ${year}`;
    });
  }

  if (view === "yearly") {
    const year = Number(bucket.key);
    return Array.from({ length: count }, (_, index) =>
      String(year + index + 1),
    );
  }

  const [yearText, monthText] = bucket.key.split("-");
  const start = new Date(Number(yearText), Number(monthText) - 1, 1);
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(start.getFullYear(), start.getMonth() + index + 1, 1);
    return monthLabel(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
    );
  });
};

const buildForecast = (historyValues, count) => {
  if (!historyValues.length) return Array.from({ length: count }, () => 0);

  const values = historyValues.map((value) => Number(value || 0));
  const lastValue = values[values.length - 1] || 0;
  const firstValue = values[0] || 0;
  const slope =
    values.length > 1 ? (lastValue - firstValue) / (values.length - 1) : 0;

  return Array.from({ length: count }, (_, index) =>
    Math.max(0, lastValue + slope * (index + 1)),
  );
};

const HORIZON_OPTIONS = [1, 2, 3, 4, 6, 8, 12];

function Forecasting() {
  const [view, setView] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [trendRows, setTrendRows] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [fetchError, setFetchError] = useState("");

  // Anchor period: the actual (historical) period forecasts are projected
  // forward from - e.g. picking Q1 2026 here projects using only data up to
  // Q1 2026. Defaults to the latest period available, same as before.
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");

  // How many periods ahead to forecast - replaces the old fixed "next 4".
  const [horizon, setHorizon] = useState(4);

  const fetchForecastData = async () => {
    try {
      setLoading(true);
      setFetchError("");

      const results = await Promise.allSettled([
        api.get("/trends", { params: { limit: 50000 } }),
        api.get("/salesmen"),
      ]);

      const [trendsResult, salesmenResult] = results;

      if (trendsResult.status === "fulfilled") {
        setTrendRows(trendsResult.value.data.rows || []);
      } else {
        console.error("Error loading trend data:", trendsResult.reason);
        setFetchError(
          "Unable to load trend data. Check your network connection or API server.",
        );
      }

      if (salesmenResult.status === "fulfilled") {
        setSalesmen(salesmenResult.value.data || []);
      } else {
        console.error("Error loading salesmen data:", salesmenResult.reason);
        setFetchError((prev) =>
          prev
            ? prev
            : "Unable to load salesmen data. Check your network connection or API server.",
        );
      }
    } catch (error) {
      console.error("Error loading forecast data:", error);
      setFetchError(
        "Unable to load forecast data. Check your network connection or API server.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecastData();
  }, []);

  const salesmanLookup = useMemo(() => {
    return new Map(
      (salesmen || []).map((salesman) => [salesman.name, salesman]),
    );
  }, [salesmen]);

  // Every actual period present in the data, bucketed by the current view -
  // drives both the anchor dropdowns and which periods count as "history".
  const periodOptions = useMemo(() => {
    const periods = [
      ...new Set((trendRows || []).map((row) => row.period).filter(Boolean)),
    ].sort();

    const years = [...new Set(periods.map(getYearFromPeriod))]
      .filter(Boolean)
      .sort((left, right) => left - right);

    const monthsByYear = {};
    const quartersByYear = {};

    periods.forEach((period) => {
      const year = getYearFromPeriod(period);
      const month = getMonthFromPeriod(period);
      if (!year || !month) return;

      if (!monthsByYear[year]) monthsByYear[year] = new Set();
      monthsByYear[year].add(month);

      if (!quartersByYear[year]) quartersByYear[year] = new Set();
      quartersByYear[year].add(Math.ceil(month / 3));
    });

    return {
      years,
      monthsByYear: Object.fromEntries(
        Object.entries(monthsByYear).map(([year, months]) => [
          year,
          [...months].sort((left, right) => left - right),
        ]),
      ),
      quartersByYear: Object.fromEntries(
        Object.entries(quartersByYear).map(([year, quarters]) => [
          year,
          [...quarters].sort((left, right) => left - right),
        ]),
      ),
    };
  }, [trendRows]);

  // Default the anchor to the latest available period, same behavior as
  // before this became user-selectable.
  useEffect(() => {
    if (!periodOptions.years.length) return;

    const latestYear = String(
      periodOptions.years[periodOptions.years.length - 1],
    );
    const year = selectedYear || latestYear;
    const availableMonths = periodOptions.monthsByYear[year] || [];
    const availableQuarters = periodOptions.quartersByYear[year] || [];

    if (!selectedYear || !periodOptions.years.includes(Number(selectedYear))) {
      setSelectedYear(latestYear);
      return;
    }

    if (
      view === "monthly" &&
      availableMonths.length &&
      !availableMonths.includes(Number(selectedMonth))
    ) {
      setSelectedMonth(String(availableMonths[availableMonths.length - 1]));
    }

    if (
      view === "quarterly" &&
      availableQuarters.length &&
      !availableQuarters.includes(Number(selectedQuarter))
    ) {
      setSelectedQuarter(
        String(availableQuarters[availableQuarters.length - 1]),
      );
    }
  }, [periodOptions, selectedYear, selectedMonth, selectedQuarter, view]);

  const availableMonths = selectedYear
    ? periodOptions.monthsByYear[selectedYear] || []
    : [];
  const availableQuarters = selectedYear
    ? periodOptions.quartersByYear[selectedYear] || []
    : [];

  const periodSeries = useMemo(() => {
    const groups = {};

    trendRows.forEach((row) => {
      const bucket = getPeriodBucket(row.period, view);
      if (!bucket) return;

      if (!groups[bucket.key]) {
        groups[bucket.key] = {
          key: bucket.key,
          label: bucket.label,
          sortValue: bucket.sortValue,
        };
      }
    });

    return Object.values(groups).sort(
      (left, right) => left.sortValue - right.sortValue,
    );
  }, [trendRows, view]);

  const anchorPeriod = useMemo(() => {
    if (!selectedYear) {
      return periodSeries.length ? periodSeries[periodSeries.length - 1] : null;
    }

    const key =
      view === "monthly"
        ? `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`
        : view === "quarterly"
          ? `${selectedYear}-Q${selectedQuarter}`
          : selectedYear;

    return (
      periodSeries.find((period) => period.key === key) ||
      periodSeries[periodSeries.length - 1] ||
      null
    );
  }, [periodSeries, selectedYear, selectedMonth, selectedQuarter, view]);

  const forecastProductRows = useMemo(() => {
    const grouped = {};

    trendRows.forEach((row) => {
      const bucket = getPeriodBucket(row.period, view);
      // Only use history up to (and including) the chosen anchor period -
      // this is what lets someone "forecast as of Q1" using just Q1-and-
      // earlier data, even if later actuals already exist.
      if (!bucket || !anchorPeriod || bucket.sortValue > anchorPeriod.sortValue)
        return;

      const product = row.product || "Unknown";
      if (!grouped[product]) grouped[product] = {};

      if (!grouped[product][bucket.key]) {
        grouped[product][bucket.key] = {
          label: bucket.label,
          sortValue: bucket.sortValue,
          value: 0,
        };
      }

      grouped[product][bucket.key].value =
        Number(grouped[product][bucket.key].value || 0) +
        Number(row.saleValueRs || 0);
    });

    return Object.entries(grouped)
      .map(([product, periodValues]) => {
        const orderedPeriods = Object.values(periodValues)
          .sort((left, right) => left.sortValue - right.sortValue)
          .slice(-6);
        const history = orderedPeriods.map((period) => period.value);
        const forecast = buildForecast(history, horizon);

        return {
          product,
          history: history[history.length - 1] || 0,
          latestPeriod: orderedPeriods[orderedPeriods.length - 1]?.label || "-",
          forecast,
          forecastLabels: getNextPeriodLabels(anchorPeriod, view, horizon),
        };
      })
      .sort((left, right) => right.history - left.history)
      .slice(0, 6);
  }, [trendRows, view, anchorPeriod, horizon]);

  const forecastRegionRows = useMemo(() => {
    const grouped = {};

    trendRows.forEach((row) => {
      const bucket = getPeriodBucket(row.period, view);
      if (!bucket || !anchorPeriod || bucket.sortValue > anchorPeriod.sortValue)
        return;

      const region = salesmanLookup.get(row.salesperson)?.area || "Unknown";
      if (!grouped[region]) grouped[region] = {};

      if (!grouped[region][bucket.key]) {
        grouped[region][bucket.key] = {
          label: bucket.label,
          sortValue: bucket.sortValue,
          value: 0,
        };
      }

      grouped[region][bucket.key].value =
        Number(grouped[region][bucket.key].value || 0) +
        Number(row.saleValueRs || 0);
    });

    return Object.entries(grouped)
      .map(([region, periodValues]) => {
        const orderedPeriods = Object.values(periodValues)
          .sort((left, right) => left.sortValue - right.sortValue)
          .slice(-6);
        const history = orderedPeriods.map((period) => period.value);
        const forecast = buildForecast(history, horizon);

        return {
          region,
          history: history[history.length - 1] || 0,
          latestPeriod: orderedPeriods[orderedPeriods.length - 1]?.label || "-",
          forecast,
          forecastLabels: getNextPeriodLabels(anchorPeriod, view, horizon),
        };
      })
      .sort((left, right) => right.history - left.history);
  }, [trendRows, salesmanLookup, view, anchorPeriod, horizon]);

  const anchorLabel = anchorPeriod?.label || `No ${viewUnit(view)} data`;

  const generatePdf = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });
    const marginX = 40;
    const ctx = { marginX, cursorY: 48 };
    const generatedAt = new Date().toLocaleString("en-US");

    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text("Forecasting by Product & Region", marginX, ctx.cursorY);
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.setTextColor(100);
    doc.text(
      `View: ${viewLabel(view)}  |  Anchor: ${anchorLabel}  |  Horizon: ${horizon} ${viewUnit(view)}(s)  |  Generated: ${generatedAt}`,
      marginX,
      ctx.cursorY + 16,
    );
    doc.setTextColor(0);
    ctx.cursorY += 34;

    const addSectionTitle = (title) => {
      if (ctx.cursorY > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        ctx.cursorY = 48;
      }
      doc.setFontSize(13);
      doc.setFont(undefined, "bold");
      doc.text(title, ctx.marginX, ctx.cursorY);
      doc.setFont(undefined, "normal");
      ctx.cursorY += 8;
    };

    const addTable = (head, body) => {
      autoTable(doc, {
        startY: ctx.cursorY,
        margin: { left: ctx.marginX, right: ctx.marginX },
        head: [head],
        body,
        theme: "grid",
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8.5 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
      ctx.cursorY = doc.lastAutoTable.finalY + 24;
    };

    const addEmptyNote = (text) => {
      doc.setFontSize(9);
      doc.text(text, ctx.marginX, ctx.cursorY);
      ctx.cursorY += 20;
    };

    addSectionTitle(
      `Forecasting by product (next ${horizon} ${viewUnit(view)}s)`,
    );
    if (forecastProductRows.length) {
      addTable(
        [
          "Product",
          "Anchor Period",
          "Anchor Sales",
          ...getNextPeriodLabels(anchorPeriod, view, horizon),
        ],
        forecastProductRows.map((item) => [
          item.product,
          item.latestPeriod,
          formatCurrency(item.history),
          ...item.forecast.map(formatCurrency),
        ]),
      );
    } else {
      addEmptyNote("No forecast history available.");
    }

    addSectionTitle(
      `Forecasting by region (next ${horizon} ${viewUnit(view)}s)`,
    );
    if (forecastRegionRows.length) {
      addTable(
        [
          "Region",
          "Anchor Period",
          "Anchor Sales",
          ...getNextPeriodLabels(anchorPeriod, view, horizon),
        ],
        forecastRegionRows.map((item) => [
          item.region,
          item.latestPeriod,
          formatCurrency(item.history),
          ...item.forecast.map(formatCurrency),
        ]),
      );
    } else {
      addEmptyNote("No region forecast data available.");
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - marginX - 60,
        doc.internal.pageSize.getHeight() - 20,
      );
    }

    const dateSlug = new Date().toISOString().slice(0, 10);
    doc.save(`sales-forecasting-${dateSlug}.pdf`);
  };

  // Excel (CSV) export that flattens the product + region forecast tables into
  // a single sheet, keeping the labels in sync with the PDF report.
  const handleExportExcel = () => {
    const nextLabels = getNextPeriodLabels(anchorPeriod, view, horizon);
    const columns = [
      { label: "Section", key: "section" },
      { label: "Product / Region", key: "entity" },
      { label: "Anchor Period", key: "latestPeriod" },
      { label: "Anchor Sales (Rs)", key: "history" },
      ...nextLabels.map((label, i) => ({
        label,
        value: (r) => r.forecast[i] ?? "",
      })),
    ];

    const rows = [
      ...forecastProductRows.map((p) => ({
        section: "By Product",
        entity: p.product,
        latestPeriod: p.latestPeriod,
        history: p.history,
        forecast: p.forecast,
      })),
      ...forecastRegionRows.map((r) => ({
        section: "By Region",
        entity: r.region,
        latestPeriod: r.latestPeriod,
        history: r.history,
        forecast: r.forecast,
      })),
    ];

    exportToCSV(rows, columns, "sales-forecasting");
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/reports"
                className="mb-2 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Reports
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Forecasting
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Projected sales for the next {horizon} {viewUnit(view)}
                {horizon === 1 ? "" : "s"}, starting from {anchorLabel}.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{viewLabel(view)}</Badge>
                <Badge variant="outline">Anchor: {anchorLabel}</Badge>
                <Badge variant="outline">
                  Horizon: {horizon} {viewUnit(view)}
                  {horizon === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Tabs
                value={view}
                onValueChange={setView}
                className="w-full lg:w-auto"
              >
                <TabsList>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
                  <TabsTrigger value="yearly">Annual</TabsTrigger>
                </TabsList>
              </Tabs>

              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-25">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {view === "monthly" && (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-30">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {
                          monthLabel(
                            `${selectedYear}-${String(m).padStart(2, "0")}`,
                          ).split(" ")[0]
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {view === "quarterly" && (
                <Select
                  value={selectedQuarter}
                  onValueChange={setSelectedQuarter}
                >
                  <SelectTrigger className="w-25">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableQuarters.map((q) => (
                      <SelectItem key={q} value={String(q)}>
                        Q{q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select
                value={String(horizon)}
                onValueChange={(value) => setHorizon(Number(value))}
              >
                <SelectTrigger className="w-37.5">
                  <SelectValue placeholder="Horizon" />
                </SelectTrigger>
                <SelectContent>
                  {HORIZON_OPTIONS.map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      Next {count} {viewUnit(view)}
                      {count === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DownloadButton
                variant="solid"
                label="Download"
                onExcel={handleExportExcel}
                onPdf={generatePdf}
                disabled={loading || !trendRows.length}
              />
            </div>
          </div>

          {fetchError && !loading && (
            <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
              <span>{fetchError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchForecastData}
                className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
              >
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              Loading forecast data...
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Forecasting by product (next {horizon} {viewUnit(view)}
                    {horizon === 1 ? "" : "s"})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {forecastProductRows.length ? (
                    forecastProductRows.map((item) => (
                      <div
                        key={item.product}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-semibold text-gray-900">
                            {item.product}
                          </p>
                          <p className="text-sm text-gray-500">
                            {item.latestPeriod}: {formatCurrency(item.history)}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.forecast.map((value, index) => (
                            <Badge
                              key={`${item.product}-${index}`}
                              variant="secondary"
                            >
                              {item.forecastLabels[index]}:{" "}
                              {formatCurrency(value)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">
                      No forecast history available.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Forecasting by region (next {horizon} {viewUnit(view)}
                    {horizon === 1 ? "" : "s"})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {forecastRegionRows.length ? (
                    forecastRegionRows.map((item) => (
                      <div
                        key={item.region}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-semibold text-gray-900">
                            {item.region}
                          </p>
                          <p className="text-sm text-gray-500">
                            {item.latestPeriod}: {formatCurrency(item.history)}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.forecast.map((value, index) => (
                            <Badge
                              key={`${item.region}-${index}`}
                              variant="secondary"
                            >
                              {item.forecastLabels[index]}:{" "}
                              {formatCurrency(value)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">
                      No region forecast data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

export default function ForecastingPage() {
  return <Forecasting />;
}
