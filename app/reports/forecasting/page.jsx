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
  MapPin,
  Package,
  Search,
  Target,
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

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-5">
          {/* Page header */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/reports"
                className="mb-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Reports
              </Link>
              <h1 className="text-lg font-semibold text-gray-900">
                Forecasting
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
                <SelectTrigger className="w-20 text-xs">
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
                  <SelectTrigger className="w-24 text-xs">
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
                  <SelectTrigger className="w-20 text-xs">
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
                <SelectTrigger className="w-32 text-xs">
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
            <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
              <span>{fetchError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchForecastData}
                className="shrink-0 border-red-300 text-xs text-red-700 hover:bg-red-100"
              >
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              Loading forecast data...
            </div>
          ) : (
            <>
              {/* KPI cards: anchor sales, next-period forecast, growth -
                  same layout language as the main Reports page. */}
              <div className="grid gap-4 sm:grid-cols-3">
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
                    icon: TrendingUp,
                  },
                ].map((card) => {
                  const CardIcon = card.icon;
                  return (
                    <div
                      key={card.title}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <CardIcon className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-medium text-gray-600">
                            {card.title}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs font-normal text-gray-500"
                        >
                          {viewLabel(view)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-lg font-semibold text-gray-900">
                        {card.value}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {card.detail}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Combined actual + forecast trend */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-gray-900">
                    Sales trend &amp; forecast
                  </h2>
                  <Badge variant="outline" className="text-xs font-normal">
                    Anchor: {anchorLabel}
                  </Badge>
                </div>
                {totalForecastSeries.chartData.length ? (
                  <div className="h-64 md:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={totalForecastSeries.chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(value) => formatCompact(value)}
                        />
                        <Bar
                          dataKey="actual"
                          name="Actual"
                          fill="#2563eb"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="forecast"
                          name="Forecast"
                          fill="#bfdbfe"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
                    No activity found for the selected anchor period.
                  </div>
                )}
              </div>

              {/* Report panel: pill tabs to switch between product / region
                  forecasts, a search box, and the forecast table. */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
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
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                          }`}
                        >
                          <SectionIcon className="h-3.5 w-3.5" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search ${FORECAST_META[forecastType].entity}`}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>

                <div className="mb-3 mt-4 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-gray-900">
                    Forecasting{" "}
                    {FORECAST_META[forecastType].label.toLowerCase()} (next{" "}
                    {horizon} {viewUnit(view)}
                    {horizon === 1 ? "" : "s"})
                  </h2>
                  <Badge variant="outline" className="text-xs font-normal">
                    {activeRows.length} rows
                  </Badge>
                </div>

                {activeRows.length ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                            {forecastType === "region" ? "Region" : "Product"}
                          </th>
                          <th className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                            Anchor Period
                          </th>
                          <th className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                            Anchor Sales
                          </th>
                          {forecastLabels.map((label) => (
                            <th
                              key={label}
                              className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {activeRows.map((item) => {
                          const name =
                            forecastType === "region"
                              ? item.region
                              : item.product;
                          return (
                            <tr key={name} className="hover:bg-gray-50">
                              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                {name}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                                {item.latestPeriod}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                                {formatCurrency(item.history)}
                              </td>
                              {item.forecast.map((value, index) => (
                                <td
                                  key={index}
                                  className="whitespace-nowrap px-4 py-3 text-sm font-medium text-blue-700"
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
                  <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
                    {forecastType === "region"
                      ? "No region forecast data available."
                      : "No forecast history available."}
                  </div>
                )}
              </div>
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
