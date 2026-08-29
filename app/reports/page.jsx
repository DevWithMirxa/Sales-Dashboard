"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import {
  Area,
  AreaChart,
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Download,
  GitCompare,
  MapPin,
  Package,
  Search,
  Target,
  TrendingUp,
  UserRound,
  Wallet,
  FileSpreadsheet,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Compact a number into a short, human-friendly string, e.g.
// 30,820,000 -> "30.82 M" and 21,700 -> "21.7 K".
const formatCompact = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
  return `${Math.round(n)}`;
};

const formatCurrency = (value) =>
  typeof value === "number" ? formatCompact(value) : "Rs 0";

const formatNumber = (value) =>
  typeof value === "number" ? formatCompact(value) : "0";

const formatPct = (value) =>
  typeof value === "number" ? `${value.toFixed(1)}` : "0.0%";

// Shared columns for the all-in-one Excel export of the Reports page.
const REPORT_EXPORT_COLUMNS = [
  { label: "Section", key: "section" },
  { label: "Name", key: "name" },
  { label: "Period", key: "period" },
  { label: "Sale (Rs)", value: (r) => r.saleValue ?? "" },
  { label: "Target (Rs)", value: (r) => r.targetValue ?? "" },
  { label: "Volume (kg)", value: (r) => r.volume ?? "" },
  { label: "Recovery (Rs)", value: (r) => r.recoveryAmount ?? "" },
  { label: "Ach (%)", value: (r) => r.achievement ?? r.valueAchievement ?? "" },
];

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

// Resolves a Trend salesperson name to the Salesman it refers to, honoring
// explicit aliases first and falling back to a tolerant best-name match that
// prefers a matching honorific (fixes the "Mr. Junaid" vs "Dr. Junaid" clash).
const resolveSalespersonToSalesman = (name, salesmen) => {
  const alias = SALESPERSON_ALIASES[name];
  const target = alias || name;

  // Exact match (alias target, or letter/period/case-insensitive exact name)
  const lower = (s) => String(s || "").toLowerCase();
  const match = (salesmen || []).find((s) => lower(s.name) === lower(target));
  if (match) return match;

  // Tolerant best-match across all salesmen
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

export default function ReportsPage() {
  const [view, setView] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [trendRows, setTrendRows] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [recoveries, setRecoveries] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("salesperson");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Icon + row-label shown per report in the pill tabs and table headers.
  // Keyed by report id so it stays in sync with reportSections below.
  const REPORT_META = {
    summary: { icon: BarChart3, entity: "Metric" },
    trend: { icon: TrendingUp, entity: "Period" },
    salesperson: { icon: UserRound, entity: "Salesperson" },
    product: { icon: Package, entity: "Product" },
    region: { icon: MapPin, entity: "Region" },
    recovery: { icon: Wallet, entity: "Salesperson" },
  };

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      setFetchError("");

      const results = await Promise.allSettled([
        api.get("/trends", { params: { limit: 50000 } }),
        api.get("/salesmen"),
        api.get("/recovery"),
      ]);

      const [trendsResult, salesmenResult, recoveryResult] = results;

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

      if (recoveryResult.status === "fulfilled") {
        setRecoveries(recoveryResult.value.data || []);
      } else {
        console.error("Error loading recovery data:", recoveryResult.reason);
        setFetchError((prev) =>
          prev
            ? prev
            : "Unable to load recovery data. Check your network connection or API server.",
        );
      }
    } catch (error) {
      console.error("Error loading reports data:", error);
      setFetchError(
        "Unable to load reports data. Check your network connection or API server.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

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
          sales: 0,
          target: 0,
          volume: 0,
        };
      }

      groups[bucket.key].sales += Number(row.saleValueRs || 0);
      groups[bucket.key].target += Number(row.targetValueRs || 0);
      groups[bucket.key].volume += Number(row.saleVolumeKg || 0);
    });

    return Object.values(groups).sort(
      (left, right) => left.sortValue - right.sortValue,
    );
  }, [trendRows, view]);

  const activePeriod = useMemo(() => {
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

  const reportPeriodLabel =
    activePeriod?.label || `No ${viewUnit(view)} selected`;

  const filteredTrendRows = useMemo(() => {
    if (!activePeriod) return [];
    return trendRows.filter(
      (row) => getPeriodBucket(row.period, view)?.key === activePeriod.key,
    );
  }, [trendRows, view, activePeriod]);

  const availableMonths = selectedYear
    ? periodOptions.monthsByYear[selectedYear] || []
    : [];
  const availableQuarters = selectedYear
    ? periodOptions.quartersByYear[selectedYear] || []
    : [];

  // The "Sales trend by period" chart shows every month/quarter within the
  // selected year (so it stays a real trend, not a single point), while the
  // bar for the exact period picked above (activePeriod) is highlighted -
  // that's how a user finds "how much did March sell" inside the chart.
  // Annual view has no year-scoping since each bar already is a year.
  const chartPeriodSeries = useMemo(() => {
    if (view === "yearly" || !selectedYear) return periodSeries;
    return periodSeries.filter(
      (row) => row.key.split("-")[0] === String(selectedYear),
    );
  }, [periodSeries, view, selectedYear]);

  const salespersonReport = useMemo(() => {
    const groups = {};

    filteredTrendRows.forEach((row) => {
      const name = row.salesperson || "Unassigned";
      if (!groups[name]) {
        groups[name] = {
          salesperson: name,
          targetValue: 0,
          saleValue: 0,
          targetVolume: 0,
          saleVolume: 0,
          region: resolveRegion(name, salesmen),
        };
      }

      groups[name].targetValue += Number(row.targetValueRs || 0);
      groups[name].saleValue += Number(row.saleValueRs || 0);
      groups[name].targetVolume += Number(row.targetVolumeKg || 0);
      groups[name].saleVolume += Number(row.saleVolumeKg || 0);
    });

    return Object.values(groups)
      .map((item) => ({
        ...item,
        valueAchievement:
          item.targetValue > 0 ? (item.saleValue / item.targetValue) * 100 : 0,
        volumeAchievement:
          item.targetVolume > 0
            ? (item.saleVolume / item.targetVolume) * 100
            : 0,
      }))
      .sort((left, right) => right.saleValue - left.saleValue);
  }, [filteredTrendRows, salesmen]);

  const productBreakdown = useMemo(() => {
    const groups = {};

    filteredTrendRows.forEach((row) => {
      const name = row.product || "Unknown";
      if (!groups[name]) {
        groups[name] = {
          product: name,
          targetValue: 0,
          saleValue: 0,
          volume: 0,
        };
      }

      groups[name].targetValue += Number(row.targetValueRs || 0);
      groups[name].saleValue += Number(row.saleValueRs || 0);
      groups[name].volume += Number(row.saleVolumeKg || 0);
    });

    return Object.values(groups).sort(
      (left, right) => right.saleValue - left.saleValue,
    );
  }, [filteredTrendRows]);

  const regionBreakdown = useMemo(() => {
    const groups = {};

    filteredTrendRows.forEach((row) => {
      const region = resolveRegion(row.salesperson, salesmen);
      if (!groups[region]) {
        groups[region] = {
          region,
          targetValue: 0,
          saleValue: 0,
          volume: 0,
        };
      }

      groups[region].targetValue += Number(row.targetValueRs || 0);
      groups[region].saleValue += Number(row.saleValueRs || 0);
      groups[region].volume += Number(row.saleVolumeKg || 0);
    });

    return Object.values(groups).sort(
      (left, right) => right.saleValue - left.saleValue,
    );
  }, [filteredTrendRows, salesmen]);

  // Recovery records already carry their own region string per invoice (set
  // when the invoice was created), so unlike the Trend-based reports above,
  // no fuzzy salesperson->region resolution is needed here.
  const recoveryRows = useMemo(() => {
    const grouped = {};

    (recoveries || []).forEach((r) => {
      const key = r.salesperson || "Unknown";
      if (!grouped[key]) {
        grouped[key] = {
          salesperson: key,
          region: r.region || "Unknown",
          invoiced: 0,
          recovered: 0,
          outstanding: 0,
          overdueCount: 0,
        };
      }
      grouped[key].invoiced += Number(r.invoiceAmount || 0);
      grouped[key].recovered += Number(r.amountRecovered || 0);
      grouped[key].outstanding += Number(r.balance || 0);
      if (r.status === "Overdue") grouped[key].overdueCount += 1;
    });

    return Object.values(grouped).sort(
      (left, right) => right.outstanding - left.outstanding,
    );
  }, [recoveries]);

  // Search box in the report panel filters whichever list-style report is
  // currently active, by its name/label field. Card + chart reports ignore it.
  const query = searchQuery.trim().toLowerCase();
  const searchedSalespersonReport = useMemo(
    () =>
      query
        ? salespersonReport.filter((item) =>
            item.salesperson.toLowerCase().includes(query),
          )
        : salespersonReport,
    [salespersonReport, query],
  );
  const searchedProductBreakdown = useMemo(
    () =>
      query
        ? productBreakdown.filter((item) =>
            item.product.toLowerCase().includes(query),
          )
        : productBreakdown,
    [productBreakdown, query],
  );
  const searchedRegionBreakdown = useMemo(
    () =>
      query
        ? regionBreakdown.filter((item) =>
            item.region.toLowerCase().includes(query),
          )
        : regionBreakdown,
    [regionBreakdown, query],
  );
  const searchedRecoveryRows = useMemo(
    () =>
      query
        ? recoveryRows.filter((item) =>
            item.salesperson.toLowerCase().includes(query),
          )
        : recoveryRows,
    [recoveryRows, query],
  );

  const totals = useMemo(() => {
    const saleValue = filteredTrendRows.reduce(
      (sum, row) => sum + Number(row.saleValueRs || 0),
      0,
    );
    const targetValue = filteredTrendRows.reduce(
      (sum, row) => sum + Number(row.targetValueRs || 0),
      0,
    );
    // Headline "Recovery" figure is the outstanding balance - the
    // actionable number for a recovery report - with total recovered and
    // overdue-invoice count available as secondary detail.
    const recoveryAmount = recoveryRows.reduce(
      (sum, row) => sum + row.outstanding,
      0,
    );
    const recoveryRecovered = recoveryRows.reduce(
      (sum, row) => sum + row.recovered,
      0,
    );
    const recoveryOverdueCount = recoveryRows.reduce(
      (sum, row) => sum + row.overdueCount,
      0,
    );
    const achievement = targetValue > 0 ? (saleValue / targetValue) * 100 : 0;

    return {
      saleValue,
      targetValue,
      recoveryAmount,
      recoveryRecovered,
      recoveryOverdueCount,
      achievement,
    };
  }, [filteredTrendRows, recoveryRows]);

  // Last few points of the period series, used to draw the small trend
  // sparkline on each KPI card (mirrors the recovery/sales cadence, not a
  // full chart — the full breakdown lives in the "Sales trend" report).
  const sparklineSeries = periodSeries.slice(-8);

  const summaryCards = [
    {
      title: "Sales Value",
      value: formatCurrency(totals.saleValue),
      detail: `${formatNumber(filteredTrendRows.reduce((sum, row) => sum + Number(row.saleVolumeKg || 0), 0))} kg sold`,
      icon: Wallet,
      trend: sparklineSeries.map((p) => ({ v: p.sales })),
    },
    {
      title: "Target Value",
      value: formatCurrency(totals.targetValue),
      detail: `Achievement ${formatPct(totals.achievement)}`,
      icon: Target,
      trend: sparklineSeries.map((p) => ({ v: p.target })),
    },
    {
      title: "Recovery Outstanding",
      value: formatCurrency(totals.recoveryAmount),
      detail: `${formatCurrency(totals.recoveryRecovered)} recovered · ${totals.recoveryOverdueCount} overdue`,
      icon: Wallet,
      trend: recoveryRows.slice(0, 8).map((r) => ({ v: r.outstanding })),
    },
  ];

  // Each entry describes one downloadable report: a label for the dropdown,
  // a filename slug, and a render(doc, ctx) function that draws that section's
  // table(s) using jsPDF + autoTable. All of them read from the same live,
  // API-derived data (trendRows/salesmen -> the memoized reports above).
  const reportSections = useMemo(
    () => [
      {
        id: "summary",
        label: "Summary",
        fileSlug: "summary",
        render: (doc, ctx) => {
          ctx.addSectionTitle(doc, ctx, `Summary - ${reportPeriodRLabel}`);
          ctx.addTable(
            doc,
            ctx,
            ["Metric", "Value"],
            [
              ["Report Period", reportPeriodLabel],
              ["Sales Value", formatCurrency(totals.saleValue)],
              ["Target Value", formatCurrency(totals.targetValue)],
              ["Achievement", formatPct(totals.achievement)],
              ["Recovery Outstanding", formatCurrency(totals.recoveryAmount)],
              ["Recovery Recovered", formatCurrency(totals.recoveryRecovered)],
              [
                "Volume Sold",
                `${formatNumber(
                  filteredTrendRows.reduce(
                    (sum, row) => sum + Number(row.saleVolumeKg || 0),
                    0,
                  ),
                )} kg`,
              ],
            ],
          );
        },
      },
      {
        id: "trend",
        label: "Sales trend by period",
        fileSlug: "sales-trend",
        render: (doc, ctx) => {
          ctx.addSectionTitle(
            doc,
            ctx,
            `Sales trend by ${view === "yearly" ? "year" : view}`,
          );
          if (periodSeries.length) {
            ctx.addTable(
              doc,
              ctx,
              ["Period", "Sales", "Target", "Volume (kg)"],
              periodSeries.map((row) => [
                row.label,
                formatCurrency(row.sales),
                formatCurrency(row.target),
                formatNumber(row.volume),
              ]),
            );
          } else {
            ctx.addEmptyNote(
              doc,
              ctx,
              "No activity found for the selected period.",
            );
          }
        },
      },
      {
        id: "salesperson",
        label: "Salesperson comparison report",
        fileSlug: "salesperson-comparison",
        render: (doc, ctx) => {
          ctx.addSectionTitle(
            doc,
            ctx,
            `Salesperson comparison report - ${reportPeriodLabel}`,
          );
          if (salespersonReport.length) {
            ctx.addTable(
              doc,
              ctx,
              [
                "Salesperson",
                "Region",
                "Target Value (Rs)",
                "Sale Value (Rs)",
                "Value Ach %",
                "Target Vol (kg)",
                "Sale Vol (kg)",
                "Vol Ach %",
              ],
              salespersonReport.map((item) => [
                item.salesperson,
                item.region,
                formatCurrency(item.targetValue),
                formatCurrency(item.saleValue),
                formatPct(item.valueAchievement),
                formatNumber(item.targetVolume),
                formatNumber(item.saleVolume),
                formatPct(item.volumeAchievement),
              ]),
            );
          } else {
            ctx.addEmptyNote(
              doc,
              ctx,
              "No salesperson comparison data is currently available.",
            );
          }
        },
      },
      {
        id: "product",
        label: "Product-wise sales overview",
        fileSlug: "product-overview",
        render: (doc, ctx) => {
          ctx.addSectionTitle(
            doc,
            ctx,
            `Product-wise sales overview - ${reportPeriodLabel}`,
          );
          if (productBreakdown.length) {
            ctx.addTable(
              doc,
              ctx,
              [
                "Product",
                "Volume (kg)",
                "Sale Value (Rs)",
                "Target Value (Rs)",
              ],
              productBreakdown.map((item) => [
                item.product,
                formatNumber(item.volume),
                formatCurrency(item.saleValue),
                formatCurrency(item.targetValue),
              ]),
            );
          } else {
            ctx.addEmptyNote(doc, ctx, "No product data available yet.");
          }
        },
      },
      {
        id: "region",
        label: "Region-wise sales performance",
        fileSlug: "region-performance",
        render: (doc, ctx) => {
          ctx.addSectionTitle(
            doc,
            ctx,
            `Region-wise sales performance - ${reportPeriodLabel}`,
          );
          if (regionBreakdown.length) {
            ctx.addTable(
              doc,
              ctx,
              ["Region", "Volume (kg)", "Sale Value (Rs)", "Target Value (Rs)"],
              regionBreakdown.map((item) => [
                item.region,
                formatNumber(item.volume),
                formatCurrency(item.saleValue),
                formatCurrency(item.targetValue),
              ]),
            );
          } else {
            ctx.addEmptyNote(doc, ctx, "No region breakdown available.");
          }
        },
      },
      {
        id: "recovery",
        label: "Recovery overview",
        fileSlug: "recovery-overview",
        render: (doc, ctx) => {
          ctx.addSectionTitle(
            doc,
            ctx,
            `Recovery overview - ${reportPeriodLabel}`,
          );
          if (recoveryRows.length) {
            ctx.addTable(
              doc,
              ctx,
              [
                "Salesperson",
                "Region",
                "Invoiced",
                "Recovered",
                "Outstanding",
                "Overdue Invoices",
              ],
              recoveryRows.map((item) => [
                item.salesperson,
                item.region,
                formatCurrency(item.invoiced),
                formatCurrency(item.recovered),
                formatCurrency(item.outstanding),
                formatNumber(item.overdueCount),
              ]),
            );
          } else {
            ctx.addEmptyNote(doc, ctx, "No recovery history available.");
          }
        },
      },
    ],
    [
      totals,
      filteredTrendRows,
      view,
      activePeriod,
      reportPeriodLabel,
      periodSeries,
      salespersonReport,
      productBreakdown,
      regionBreakdown,
      recoveryRows,
    ],
  );

  // sectionIds: "all" to export every section in one PDF, or a single id
  // (e.g. "summary", "salesperson") to export just that report.
  const generatePdf = (sectionIds) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });
    const marginX = 40;
    const ctx = { marginX, cursorY: 48 };
    const generatedAt = new Date().toLocaleString("en-US");

    const sectionsToRender =
      sectionIds === "all"
        ? reportSections
        : reportSections.filter((section) => section.id === sectionIds);

    const titleText =
      sectionIds === "all"
        ? "Reports & Forecasting"
        : sectionsToRender[0]?.label || "Report";

    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text(titleText, marginX, ctx.cursorY);
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.setTextColor(100);
    doc.text(
      `View: ${viewLabel(view)}  |  Report period: ${reportPeriodLabel}  |  Generated: ${generatedAt}`,
      marginX,
      ctx.cursorY + 16,
    );
    doc.setTextColor(0);
    ctx.cursorY += 34;

    ctx.addSectionTitle = (docRef, ctxRef, title) => {
      if (ctxRef.cursorY > docRef.internal.pageSize.getHeight() - 80) {
        docRef.addPage();
        ctxRef.cursorY = 48;
      }
      docRef.setFontSize(13);
      docRef.setFont(undefined, "bold");
      docRef.text(title, ctxRef.marginX, ctxRef.cursorY);
      docRef.setFont(undefined, "normal");
      ctxRef.cursorY += 8;
    };

    ctx.addTable = (docRef, ctxRef, head, body, options = {}) => {
      autoTable(docRef, {
        startY: ctxRef.cursorY,
        margin: { left: ctxRef.marginX, right: ctxRef.marginX },
        head: [head],
        body,
        theme: "grid",
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8.5 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        ...options,
      });
      ctxRef.cursorY = docRef.lastAutoTable.finalY + 24;
    };

    ctx.addEmptyNote = (docRef, ctxRef, text) => {
      docRef.setFontSize(9);
      docRef.text(text, ctxRef.marginX, ctxRef.cursorY);
      ctxRef.cursorY += 20;
    };

    sectionsToRender.forEach((section) => section.render(doc, ctx));

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
    const fileSlug =
      sectionIds === "all"
        ? "full-report"
        : sectionsToRender[0]?.fileSlug || "report";
    doc.save(`sales-${fileSlug}-${dateSlug}.pdf`);
  };

  // Flatten every report section into a single Excel (CSV) download that uses
  // the same API-derived data as the PDF reports.
  const generateExcel = () => {
    const volumeSold = filteredTrendRows.reduce(
      (sum, row) => sum + Number(row.saleVolumeKg || 0),
      0,
    );

    const rows = [
      {
        section: "Summary",
        name: "Sales Value",
        period: reportPeriodLabel,
        saleValue: totals.saleValue,
      },
      {
        section: "Summary",
        name: "Target Value",
        period: reportPeriodLabel,
        targetValue: totals.targetValue,
      },
      {
        section: "Summary",
        name: "Achievement",
        period: reportPeriodLabel,
        achievement: totals.achievement,
      },
      {
        section: "Summary",
        name: "Recovery",
        period: reportPeriodLabel,
        recoveryAmount: totals.recoveryAmount,
      },
      {
        section: "Summary",
        name: "Volume Sold",
        period: reportPeriodLabel,
        volume: volumeSold,
      },
      ...salespersonReport.map((r) => ({
        section: "Salesperson",
        name: r.salesperson,
        period: reportPeriodLabel,
        saleValue: r.saleValue,
        targetValue: r.targetValue,
        volume: r.saleVolume,
        achievement: r.valueAchievement,
      })),
      ...productBreakdown.map((r) => ({
        section: "Product",
        name: r.product,
        period: reportPeriodLabel,
        saleValue: r.saleValue,
        targetValue: r.targetValue,
        volume: r.volume,
      })),
      ...regionBreakdown.map((r) => ({
        section: "Region",
        name: r.region,
        period: reportPeriodLabel,
        saleValue: r.saleValue,
        targetValue: r.targetValue,
        volume: r.volume,
      })),
      ...recoveryRows.map((r) => ({
        section: "Recovery",
        name: r.salesperson,
        period: reportPeriodLabel,
        recoveryAmount: r.outstanding,
      })),
    ];

    exportToCSV(rows, REPORT_EXPORT_COLUMNS, "sales-reports");
  };

  const selectedReport =
    reportSections.find((section) => section.id === selectedReportId) ||
    reportSections[0];

  const renderSelectedReport = () => {
    // Small reusable table shell so the four list-style reports (salesperson,
    // product, region, recovery) share one consistent look.
    const ListTable = ({ columns, rows, emptyLabel }) =>
      rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">{rows}</tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
          {emptyLabel}
        </div>
      );

    const AchievementBadge = ({ value }) => (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          value >= 100
            ? "bg-green-50 text-green-700"
            : value >= 75
              ? "bg-amber-50 text-amber-700"
              : "bg-red-50 text-red-700"
        }`}
      >
        {formatPct(value)}
      </span>
    );

    switch (selectedReport.id) {
      case "summary":
        return (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      {card.title}
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                      <CardIcon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {card.value}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{card.detail}</p>
                </div>
              );
            })}
            <div className="rounded-lg border border-gray-200 p-4 sm:col-span-2 xl:col-span-4">
              <p className="mb-1 text-sm font-medium text-gray-600">
                Volume sold — {reportPeriodLabel}
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {formatNumber(
                  filteredTrendRows.reduce(
                    (sum, row) => sum + Number(row.saleVolumeKg || 0),
                    0,
                  ),
                )}{" "}
                kg
              </p>
            </div>
          </div>
        );
      case "trend":
        return (
          <div>
            {chartPeriodSeries.length ? (
              <div className="h-64 md:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartPeriodSeries}>
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
                    <Bar dataKey="sales" name="Sales" radius={[4, 4, 0, 0]}>
                      {chartPeriodSeries.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={
                            entry.key === activePeriod?.key
                              ? "#2563eb"
                              : "#bfdbfe"
                          }
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="target"
                      fill="#e2e8f0"
                      name="Target"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
                No activity found for the selected period.
              </div>
            )}

            {activePeriod && filteredTrendRows.length > 0 && (
              <div className="mt-5 border-t border-gray-100 pt-5">
                <h3 className="mb-3 text-base font-semibold text-gray-900">
                  Detailed breakdown — {reportPeriodLabel}
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-700">
                      Sales Value
                    </p>
                    <p className="mt-1 text-base font-semibold text-blue-900">
                      {formatCurrency(totals.saleValue)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-600">
                      Target Value (Rs)
                    </p>
                    <p className="mt-1 text-base font-semibold text-gray-900">
                      {formatCurrency(totals.targetValue)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Achievement {formatPct(totals.achievement)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-600">
                      Volume Sold
                    </p>
                    <p className="mt-1 text-base font-semibold text-gray-900">
                      {formatNumber(
                        filteredTrendRows.reduce(
                          (sum, row) => sum + Number(row.saleVolumeKg || 0),
                          0,
                        ),
                      )}{" "}
                      kg
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case "salesperson":
        return (
          <ListTable
            columns={[
              "Salesperson",
              "Region",
              "Target Value (Rs)",
              "Sale Value (Rs)",
              "Value Ach %",
              "Volume Ach %",
            ]}
            emptyLabel="No salesperson comparison data is currently available."
            rows={searchedSalespersonReport.map((item) => (
              <tr key={item.salesperson} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {item.salesperson}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {item.region}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                  {formatCurrency(item.targetValue)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {formatCurrency(item.saleValue)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <AchievementBadge value={item.valueAchievement} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <AchievementBadge value={item.volumeAchievement} />
                </td>
              </tr>
            ))}
          />
        );
      case "product":
        return (
          <ListTable
            columns={[
              "Product",
              "Volume (kg)",
              "Sale Value (Rs)",
              "Target Value",
            ]}
            emptyLabel="No product data available yet."
            rows={searchedProductBreakdown.map((item) => (
              <tr key={item.product} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {item.product}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {formatNumber(item.volume)} kg
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {formatCurrency(item.saleValue)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {formatCurrency(item.targetValue)}
                </td>
              </tr>
            ))}
          />
        );
      case "region":
        return (
          <ListTable
            columns={[
              "Region",
              "Volume (kg)",
              "Sale Value (Rs)",
              "Target Value (Rs)",
            ]}
            emptyLabel="No region breakdown available."
            rows={searchedRegionBreakdown.map((item) => (
              <tr key={item.region} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {item.region}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {formatNumber(item.volume)} kg
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {formatCurrency(item.saleValue)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {formatCurrency(item.targetValue)}
                </td>
              </tr>
            ))}
          />
        );
      case "recovery":
        return (
          <ListTable
            columns={[
              "Salesperson",
              "Region",
              "Invoiced (Rs)",
              "Recovered (Rs)",
              "Outstanding (Rs)",
              "Overdue",
            ]}
            emptyLabel="No recovery history available."
            rows={searchedRecoveryRows.map((item) => (
              <tr key={item.salesperson} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {item.salesperson}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {item.region}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {formatCurrency(item.invoiced)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {formatCurrency(item.recovered)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {formatCurrency(item.outstanding)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  {item.overdueCount > 0 ? (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                      {item.overdueCount}
                    </Badge>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
              </tr>
            ))}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-5">
          {/* Page header */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Reports &amp; Forecasting
              </h1>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-2">
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
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                asChild
              >
                <Link href="/reports/forecasting">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Forecasting
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    disabled={loading || !trendRows.length}
                    className="gap-1.5 bg-blue-600 text-xs hover:bg-blue-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    onClick={generateExcel}
                    className="gap-2 text-xs font-semibold"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                    Export all reports (Excel)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => generatePdf("all")}
                    className="text-xs font-semibold"
                  >
                    All reports (full PDF)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-gray-500">
                    Individual reports
                  </DropdownMenuLabel>
                  {reportSections.map((section) => (
                    <DropdownMenuItem
                      key={section.id}
                      onClick={() => generatePdf(section.id)}
                      className="text-xs"
                    >
                      {section.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {fetchError && !loading && (
            <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
              <span>{fetchError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchReportsData}
                className="shrink-0 border-red-300 text-xs text-red-700 hover:bg-red-100"
              >
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              Loading report data...
            </div>
          ) : (
            <>
              {/* KPI summary cards with a small trend sparkline, styled after
                  the reference dashboard's top stat cards. */}
              <div className="grid gap-4 sm:grid-cols-3">
                {summaryCards.map((card) => {
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
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold text-gray-900">
                            {card.value}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {card.detail}
                          </p>
                        </div>
                        {card.trend.length > 1 && (
                          <div className="h-10 w-24">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={card.trend}>
                                <defs>
                                  <linearGradient
                                    id={`spark-${card.title}`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="0%"
                                      stopColor="#2563eb"
                                      stopOpacity={0.35}
                                    />
                                    <stop
                                      offset="100%"
                                      stopColor="#2563eb"
                                      stopOpacity={0}
                                    />
                                  </linearGradient>
                                </defs>
                                <Area
                                  type="monotone"
                                  dataKey="v"
                                  stroke="#2563eb"
                                  strokeWidth={1.5}
                                  fill={`url(#spark-${card.title})`}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Report panel: pill tabs to switch reports, a search box for
                  the list-style reports, and the selected report's content. */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {reportSections.map((section) => {
                      const SectionIcon =
                        REPORT_META[section.id]?.icon || BarChart3;
                      const isActive = selectedReportId === section.id;
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => setSelectedReportId(section.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                          }`}
                        >
                          <SectionIcon className="h-3.5 w-3.5" />
                          {section.label}
                        </button>
                      );
                    })}
                  </div>

                  {["salesperson", "product", "region", "recovery"].includes(
                    selectedReportId,
                  ) && (
                    <div className="flex items-center gap-2">
                      <div className="relative w-full sm:w-56">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={`Search ${REPORT_META[selectedReportId]?.entity || "rows"}`}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                      {["salesperson", "product"].includes(
                        selectedReportId,
                      ) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          asChild
                        >
                          <Link
                            href={`/reports/performance-flow?type=${selectedReportId}&view=${view}${
                              selectedYear ? `&year=${selectedYear}` : ""
                            }`}
                          >
                            <GitCompare className="h-3.5 w-3.5" />
                            Graph
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mb-3 mt-4 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-gray-900">
                    {selectedReport.label}
                  </h2>
                  <Badge variant="outline" className="text-xs font-normal">
                    {reportPeriodLabel}
                  </Badge>
                </div>

                {renderSelectedReport()}
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
