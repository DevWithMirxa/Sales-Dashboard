"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import DownloadButton from "@/components/DownloadButton";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  KPISkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

// --- Shared helpers (mirrors the equivalents in the main Reports page) ---

const formatCurrency = (value) =>
  typeof value === "number" ? formatCompact(value) : "Rs 0";

// Compact a number into a short, human-friendly string, e.g.
// 30,820,000 -> "30.82 M" and 21,700 -> "21.7 K".
const formatCompact = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
  return `${Math.round(n)}`;
};

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

// ---- Salesperson -> region resolution (mirrors server/utils/salespersonRegion.js) ----
// The Trend records store the salesperson as a plain string with no region, while
// the Salesmen collection carries { name, area }. Because the raw Trend names are
// sometimes typos/abbreviations, we resolve each one to the best-matching salesman's
// area (preferring a matching honorific) rather than relying on an exact match.
const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "engr", "eng", "prof"]);

const nameTokens = (name) =>
  String(name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
    .filter((t) => !HONORIFICS.has(t));

const titleOf = (name) => {
  const m = String(name || "")
    .trim()
    .match(/^(dr|mr|mrs|ms|engr|eng|prof)(?:\s*\.)?\s/i);
  return m ? m[1].toLowerCase() : null;
};

// These names are typos/abbreviations found in the raw Trend source files that can
// never be matched to a Salesman by name alone. Keep in sync with the server map.
const SALESPERSON_ALIASES = {
  "Ameen Mati": "Mr. Ameen Matee", // typo: Mati -> Matee (Karachi)
  "Dr. A. Rehman": "Dr. Abdul Rehman", // abbreviation (Sahiwal)
  "Dr. Abdul Rrehman": "Dr. Abdul Rehman", // typo: double-r (Sahiwal)
  "Mr. Nasir": "Mr. Nasie Ejaz", // best-effort guess (Lahore)
};

const looselyMatches = (a, b) =>
  a.length > 0 &&
  b.length > 0 &&
  (a.length <= b.length
    ? a.every((t) => b.includes(t))
    : b.every((t) => a.includes(t)));

const scoreMatch = (nameTok, salesmanTok, nameTitle, salesmanTitle) => {
  let score = 0;
  if (
    nameTok.length === salesmanTok.length &&
    nameTok.every((t) => salesmanTok.includes(t))
  ) {
    score += 100;
  }
  if (nameTitle && nameTitle === salesmanTitle) score += 10;
  score += Math.max(nameTok.length, salesmanTok.length);
  return score;
};

const resolveSalespersonToSalesman = (name, salesmen) => {
  const alias = SALESPERSON_ALIASES[name];
  const target = alias || name;
  const lower = (s) => String(s || "").toLowerCase();
  const match = (salesmen || []).find((s) => lower(s.name) === lower(target));
  if (match) return match;

  const nameTok = nameTokens(name);
  const nameTitle = titleOf(name);
  if (!nameTok.length) return null;
  let best = null;
  let bestScore = -1;
  (salesmen || []).forEach((s) => {
    const sTok = nameTokens(s.name);
    if (!looselyMatches(nameTok, sTok)) return;
    const score = scoreMatch(nameTok, sTok, nameTitle, titleOf(s.name));
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  });
  return best;
};

const resolveRegion = (name, salesmen) =>
  resolveSalespersonToSalesman(name, salesmen)?.area || "Unknown";

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

  // Which forecast breakdown the report panel shows, and the name filter
  // for its table - mirrors the pill tabs + search on the main Reports page.
  const [forecastType, setForecastType] = useState("product");
  const [searchQuery, setSearchQuery] = useState("");

  const FORECAST_META = {
    product: { icon: Package, label: "By Product", entity: "product" },
    region: { icon: MapPin, label: "By Region", entity: "region" },
  };

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

  // Total (all products/regions combined) actuals for the last few periods
  // up to the anchor, plus the projected totals for the chosen horizon -
  // drives the combined trend chart and the KPI cards above the table.
  const totalForecastSeries = useMemo(() => {
    const grouped = {};

    trendRows.forEach((row) => {
      const bucket = getPeriodBucket(row.period, view);
      if (!bucket || !anchorPeriod || bucket.sortValue > anchorPeriod.sortValue)
        return;

      if (!grouped[bucket.key]) {
        grouped[bucket.key] = {
          label: bucket.label,
          sortValue: bucket.sortValue,
          value: 0,
        };
      }
      grouped[bucket.key].value += Number(row.saleValueRs || 0);
    });

    const orderedPeriods = Object.values(grouped)
      .sort((left, right) => left.sortValue - right.sortValue)
      .slice(-6);
    const history = orderedPeriods.map((period) => period.value);
    const forecast = buildForecast(history, horizon);
    const forecastLabels = getNextPeriodLabels(anchorPeriod, view, horizon);

    const chartData = [
      ...orderedPeriods.map((period) => ({
        label: period.label,
        actual: period.value,
        forecast: null,
      })),
      ...forecast.map((value, index) => ({
        label: forecastLabels[index],
        actual: null,
        forecast: value,
      })),
    ];

    const anchorSales = history[history.length - 1] || 0;
    const nextForecast = forecast[0] || 0;
    const growthPct =
      anchorSales > 0 ? ((nextForecast - anchorSales) / anchorSales) * 100 : 0;

    return { chartData, anchorSales, nextForecast, forecast, growthPct };
  }, [trendRows, view, anchorPeriod, horizon]);

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

      const region = resolveRegion(row.salesperson, salesmen);
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
  }, [trendRows, salesmen, view, anchorPeriod, horizon]);

  const anchorLabel = anchorPeriod?.label || `No ${viewUnit(view)} data`;

  // Search box in the report panel filters whichever forecast breakdown is
  // currently active, by its name field.
  const query = searchQuery.trim().toLowerCase();
  const searchedProductRows = useMemo(
    () =>
      query
        ? forecastProductRows.filter((item) =>
            item.product.toLowerCase().includes(query),
          )
        : forecastProductRows,
    [forecastProductRows, query],
  );
  const searchedRegionRows = useMemo(
    () =>
      query
        ? forecastRegionRows.filter((item) =>
            item.region.toLowerCase().includes(query),
          )
        : forecastRegionRows,
    [forecastRegionRows, query],
  );

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

  const activeRows =
    forecastType === "region" ? searchedRegionRows : searchedProductRows;
  const forecastLabels = getNextPeriodLabels(anchorPeriod, view, horizon);

  const maxRegionForecast = Math.max(
    1,
    ...forecastRegionRows.map((item) => item.forecast[0] || 0),
  );
  const maxProductForecast = Math.max(
    1,
    ...forecastProductRows.map((item) => item.forecast[0] || 0),
  );

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Page header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Sales Forecasting
              </h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Tabs value={view} onValueChange={setView}>
                <TabsList>
                  <TabsTrigger value="monthly" className="text-xs">
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger value="quarterly" className="text-xs">
                    Quarterly
                  </TabsTrigger>
                  <TabsTrigger value="yearly" className="text-xs">
                    Annual
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-20 text-xs bg-secondary border-border">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.years.map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {view === "monthly" && (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-24 text-xs bg-secondary border-border">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((m) => (
                      <SelectItem key={m} value={String(m)} className="text-xs">
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
                  <SelectTrigger className="w-20 text-xs bg-secondary border-border">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableQuarters.map((q) => (
                      <SelectItem key={q} value={String(q)} className="text-xs">
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
                <SelectTrigger className="w-32 text-xs bg-secondary border-border">
                  <SelectValue placeholder="Horizon" />
                </SelectTrigger>
                <SelectContent>
                  {HORIZON_OPTIONS.map((count) => (
                    <SelectItem
                      key={count}
                      value={String(count)}
                      className="text-xs"
                    >
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
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive-soft-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>{fetchError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchForecastData}
                className="shrink-0 text-xs text-destructive hover:bg-destructive-soft"
              >
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <KPISkeleton key={i} />
                ))}
              </div>
              <ChartSkeleton height="h-[300px]" />
              <TableSkeleton rows={5} />
            </div>
          ) : (
            <>
              {/* KPI Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    title: "Anchor Sales",
                    value: formatCurrency(totalForecastSeries.anchorSales),
                    detail: anchorLabel,
                    icon: Wallet,
                  },
                  {
                    title: "Next Period Forecast",
                    value: formatCurrency(totalForecastSeries.nextForecast),
                    detail: forecastLabels[0] || "-",
                    icon: Target,
                  },
                  {
                    title: "Forecast Growth",
                    value: `${totalForecastSeries.growthPct >= 0 ? "+" : ""}${totalForecastSeries.growthPct.toFixed(1)}%`,
                    detail: `vs ${anchorLabel}`,
                    icon:
                      totalForecastSeries.growthPct >= 0
                        ? TrendingUp
                        : TrendingDown,
                    trendUp: totalForecastSeries.growthPct >= 0,
                  },
                  {
                    title: "Forecast Horizon",
                    value: `${horizon} ${viewUnit(view)}${horizon === 1 ? "" : "s"}`,
                    detail: `${viewLabel(view)} view`,
                    icon: Calendar,
                  },
                ].map((card) => {
                  const CardIcon = card.icon;
                  return (
                    <Card key={card.title} className="border-border bg-card">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {card.title}
                            </p>
                            <p className="text-2xl font-semibold text-foreground mt-1">
                              {card.value}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {card.detail}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <CardIcon
                              className={`w-5 h-5 ${
                                card.trendUp === false
                                  ? "text-destructive"
                                  : "text-chart-1"
                              }`}
                            />
                            <Badge
                              variant="outline"
                              className="text-xs font-normal text-muted-foreground"
                            >
                              {viewLabel(view)}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Combined actual + forecast trend */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-base font-medium">
                        Sales Trend &amp; Forecast
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Anchor: {anchorLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-chart-1" />
                        <span className="text-muted-foreground">Actual</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground/40" />
                        <span className="text-muted-foreground">Forecast</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {totalForecastSeries.chartData.length ? (
                    <div className="h-64 md:h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={totalForecastSeries.chartData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="oklch(0.22 0.005 260)"
                          />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => formatCompact(v)}
                          />
                          <Tooltip
                            contentStyle={{
                              fontSize: 12,
                              borderRadius: 8,
                              backgroundColor: "oklch(0.12 0.005 260)",
                              border: "1px solid oklch(0.22 0.005 260)",
                            }}
                            formatter={(value) => formatCompact(value)}
                          />
                          <Bar
                            dataKey="actual"
                            name="Actual"
                            fill="oklch(0.7 0.18 220)"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="forecast"
                            name="Forecast"
                            fill="oklch(0.55 0.02 260)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
                      No activity found for the selected anchor period.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top forecast by product */}
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">
                      Top Product Forecasts
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Anchor sales vs. next-period forecast
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {forecastProductRows.length ? (
                      forecastProductRows.map((item) => {
                        const nextValue = item.forecast[0] || 0;
                        const pct = Math.round(
                          (nextValue / maxProductForecast) * 100,
                        );
                        return (
                          <div
                            key={item.product}
                            className="p-3 rounded-lg bg-secondary/50 border border-border hover:border-muted-foreground/30 transition-colors duration-300"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <Package className="w-4 h-4 text-chart-1 shrink-0" />
                                <div>
                                  <p className="font-medium text-sm text-foreground">
                                    {item.product}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Anchor: {formatCurrency(item.history)}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm font-semibold text-foreground">
                                {formatCurrency(nextValue)}
                              </p>
                            </div>
                            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-chart-1 transition-all duration-700 ease-out"
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
                        No forecast history available.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top forecast by region */}
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">
                      Forecast by Region
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Next-period forecast, {anchorLabel} anchor
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {forecastRegionRows.length ? (
                      forecastRegionRows.slice(0, 6).map((region) => {
                        const nextValue = region.forecast[0] || 0;
                        const pct = Math.round(
                          (nextValue / maxRegionForecast) * 100,
                        );
                        return (
                          <div
                            key={region.region}
                            className="p-3 rounded-lg bg-secondary/50 border border-border hover:border-muted-foreground/30 transition-colors duration-300"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <MapPin className="w-4 h-4 text-chart-1 shrink-0" />
                                <div>
                                  <p className="font-medium text-sm text-foreground">
                                    {region.region}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Anchor: {formatCurrency(region.history)}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm font-semibold text-foreground">
                                {formatCurrency(nextValue)}
                              </p>
                            </div>
                            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-chart-1 transition-all duration-700 ease-out"
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
                        No region forecast data available.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Report panel: pill tabs, search, and detailed forecast table */}
              <Card className="border-border bg-card overflow-hidden">
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(FORECAST_META).map(([id, meta]) => {
                        const SectionIcon = meta.icon;
                        const isActive = forecastType === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setForecastType(id)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              isActive
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "bg-secondary text-muted-foreground hover:bg-chart-1/10 hover:text-chart-1"
                            }`}
                          >
                            <SectionIcon className="h-3.5 w-3.5" />
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative w-full sm:w-56">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={`Search ${FORECAST_META[forecastType].entity}`}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium">
                      Forecasting{" "}
                      {FORECAST_META[forecastType].label.toLowerCase()} (next{" "}
                      {horizon} {viewUnit(view)}
                      {horizon === 1 ? "" : "s"})
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-normal">
                      {activeRows.length} rows
                    </Badge>
                  </div>

                  {activeRows.length ? (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-border bg-secondary/30">
                            <th className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {forecastType === "region" ? "Region" : "Product"}
                            </th>
                            <th className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Anchor Period
                            </th>
                            <th className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Anchor Sales
                            </th>
                            {forecastLabels.map((label) => (
                              <th
                                key={label}
                                className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {activeRows.map((item) => {
                            const name =
                              forecastType === "region"
                                ? item.region
                                : item.product;
                            return (
                              <tr
                                key={name}
                                className="hover:bg-secondary/30 transition-colors duration-150"
                              >
                                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-foreground">
                                  {name}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                                  {item.latestPeriod}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">
                                  {formatCurrency(item.history)}
                                </td>
                                {item.forecast.map((value, index) => (
                                  <td
                                    key={index}
                                    className="whitespace-nowrap px-4 py-3 text-sm font-medium text-chart-1"
                                  >
                                    {formatCurrency(value)}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                      {forecastType === "region"
                        ? "No region forecast data available."
                        : "No forecast history available."}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

export default function ForecastingPage() {
  return <Forecasting />;
}
