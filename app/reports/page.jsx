"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import TanStackDataTable from "@/components/TanStackDataTable";
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  ChevronRight,
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
import {
  KPISkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

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

// Shared paginated table shell for the list-style reports (salesperson,
// product, region, recovery). Holds its own page/page-size state so the
// parent doesn't re-mount it on every keystroke.
function PaginatedListPanel({ items, renderRow, emptyLabel, pageSize = 8 }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);

  const pageCount = Math.max(1, Math.ceil(items.length / rowsPerPage));

  // Keep the current page valid when the filtered item count shrinks.
  useEffect(() => {
    if (pageIndex > pageCount - 1) setPageIndex(pageCount - 1);
  }, [pageCount, pageIndex]);

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const start = pageIndex * rowsPerPage;
  const pageItems = items.slice(start, start + rowsPerPage);

  return (
    <div>
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {pageItems.map(renderRow)}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPageIndex(0);
            }}
            className="rounded-lg border border-border bg-input px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {[8, 10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>
            {items.length
              ? `${start + 1}-${Math.min(start + rowsPerPage, items.length)} of ${items.length}`
              : "0 of 0"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPageIndex(0)}
            disabled={pageIndex === 0}
            className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40 hover:bg-secondary/60"
          >
            First
          </button>
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0}
            className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40 hover:bg-secondary/60"
          >
            Prev
          </button>
          <span className="px-1 text-xs">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            disabled={pageIndex >= pageCount - 1}
            className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40 hover:bg-secondary/60"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => setPageIndex(pageCount - 1)}
            disabled={pageIndex >= pageCount - 1}
            className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40 hover:bg-secondary/60"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [view, setView] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [trendRows, setTrendRows] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [recoveries, setRecoveries] = useState([]);
  const [sales, setSales] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("salesperson");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Icon + row-label + short blurb shown per report in the quick report
  // cards, table headers, and list rows. Keyed by report id so it stays in
  // sync with reportSections below.
  const REPORT_META = {
    trend: {
      icon: TrendingUp,
      entity: "Period",
      description: "Sales vs. target across the period",
      color: "accent",
    },
    salesperson: {
      icon: UserRound,
      entity: "Salesperson",
      description: "Compare achievement across your team",
      color: "chart-3",
    },
    product: {
      icon: Package,
      entity: "Product",
      description: "Volume and value sold by product",
      color: "chart-5",
    },
    region: {
      icon: MapPin,
      entity: "Region",
      description: "Volume and value sold by region",
      color: "chart-4",
    },
    recovery: {
      icon: Wallet,
      entity: "Salesperson",
      description: "Outstanding balances by salesperson",
      color: "chart-1",
    },
    customer: {
      icon: GitCompare,
      entity: "Customer",
      description: "Sales and recovery by customer",
      color: "accent",
    },
  };

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      setFetchError("");

      const results = await Promise.allSettled([
        api.get("/trends", { params: { limit: 50000 } }),
        api.get("/salesmen"),
        api.get("/recovery"),
        api.get("/sales"),
      ]);

      const [trendsResult, salesmenResult, recoveryResult, salesResult] =
        results;

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

      if (salesResult.status === "fulfilled") {
        setSales(salesResult.value.data || []);
      } else {
        console.error("Error loading sales data:", salesResult.reason);
        setFetchError((prev) =>
          prev
            ? prev
            : "Unable to load sales data. Check your network connection or API server.",
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

  // "Sales by region" donut shown alongside the trend chart, in the spirit
  // of the reference dashboard's Lead Sources breakdown. Buckets anything
  // past the top 4 regions into "Other" so the legend stays short.
  const DONUT_COLORS = [
    "oklch(0.7 0.18 220)",
    "oklch(0.7 0.18 145)",
    "oklch(0.75 0.18 55)",
    "oklch(0.65 0.2 25)",
    "oklch(0.7 0.15 300)",
  ];
  const regionDonutData = useMemo(() => {
    const totalSales = regionBreakdown.reduce((sum, r) => sum + r.saleValue, 0);
    if (!totalSales) return [];

    const top = regionBreakdown.slice(0, 4);
    const rest = regionBreakdown.slice(4);
    const restTotal = rest.reduce((sum, r) => sum + r.saleValue, 0);

    const rows = [...top];
    if (restTotal > 0) rows.push({ region: "Other", saleValue: restTotal });

    return rows.map((r, index) => ({
      name: r.region,
      value: r.saleValue,
      percent: (r.saleValue / totalSales) * 100,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
    }));
  }, [regionBreakdown]);

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
          maxDaysOverdue: 0,
        };
      }
      grouped[key].invoiced += Number(r.invoiceAmount || 0);
      grouped[key].recovered += Number(r.amountRecovered || 0);
      grouped[key].outstanding += Number(r.balance || 0);
      if (r.status === "Overdue") grouped[key].overdueCount += 1;
      // Track the single oldest overdue invoice per salesperson - the
      // group's total/average days overdue isn't meaningful once multiple
      // invoices are combined, but "worst case currently outstanding" is.
      if (Number(r.daysOverdue || 0) > grouped[key].maxDaysOverdue) {
        grouped[key].maxDaysOverdue = Number(r.daysOverdue || 0);
      }
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

  // Customer Comparison Report: joins actual Sales records (how much was sold
  // to each customer) with Recovery records (how much was invoiced/recovered/
  // outstanding per customer). Sales "saleValue" comes from totalAmount; the
  // Recovery side aggregates invoiceAmount, amountRecovered, and balance.
  const customerReport = useMemo(() => {
    const groups = {};

    (sales || []).forEach((s) => {
      const name = s.customer || "Unknown";
      if (!groups[name]) {
        groups[name] = {
          customer: name,
          saleValue: 0,
          saleCount: 0,
          invoiced: 0,
          recovered: 0,
          outstanding: 0,
        };
      }
      groups[name].saleValue += Number(s.totalAmount || 0);
      groups[name].saleCount += 1;
    });

    (recoveries || []).forEach((r) => {
      const name = r.customer || "Unknown";
      if (!groups[name]) {
        groups[name] = {
          customer: name,
          saleValue: 0,
          saleCount: 0,
          invoiced: 0,
          recovered: 0,
          outstanding: 0,
        };
      }
      groups[name].invoiced += Number(r.invoiceAmount || 0);
      groups[name].recovered += Number(r.amountRecovered || 0);
      groups[name].outstanding += Number(r.balance || 0);
    });

    return Object.values(groups).sort(
      (left, right) => right.saleValue - left.saleValue,
    );
  }, [sales, recoveries]);
  const searchedCustomerReport = useMemo(
    () =>
      query
        ? customerReport.filter((item) =>
            item.customer.toLowerCase().includes(query),
          )
        : customerReport,
    [customerReport, query],
  );

  // TanStack column defs for the Customer Comparison Report table.
  const customerColumns = useMemo(
    () => [
      {
        accessorKey: "customer",
        header: "Customer ",
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{getValue()}</span>
        ),
      },
      {
        accessorKey: "saleValue",
        header: "Sales (Rs)",
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
        cell: ({ getValue }) => (
          <span className="block text-left">
            {formatCurrency(getValue() || 0)}
          </span>
        ),
      },
      {
        accessorKey: "saleCount",
        header: "Transactions",
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
        cell: ({ getValue }) => formatNumber(getValue() || 0),
      },
      {
        accessorKey: "invoiced",
        header: "Invoiced (Rs)",
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
        cell: ({ getValue }) => formatCurrency(getValue() || 0),
      },
      {
        accessorKey: "recovered",
        header: "Recovered (Rs)",
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
        cell: ({ getValue }) => formatCurrency(getValue() || 0),
      },
      {
        accessorKey: "outstanding",
        header: "Outstanding (Rs)",
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
        cell: ({ getValue }) => {
          const v = getValue() || 0;
          return (
            <span
              className={`font-medium ${v > 0 ? "text-destructive" : "text-foreground"}`}
            >
              {formatCurrency(v)}
            </span>
          );
        },
      },
    ],
    [],
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
    {
      title: "Volume Sold",
      value: `${formatNumber(
        filteredTrendRows.reduce(
          (sum, row) => sum + Number(row.saleVolumeKg || 0),
          0,
        ),
      )} kg`,
      detail: reportPeriodLabel,
      icon: Package,
      trend: sparklineSeries.map((p) => ({ v: p.volume })),
    },
  ];

  // Each entry describes one downloadable report: a label for the dropdown,
  // a filename slug, and a render(doc, ctx) function that draws that section's
  // table(s) using jsPDF + autoTable. All of them read from the same live,
  // API-derived data (trendRows/salesmen -> the memoized reports above).
  const reportSections = useMemo(
    () => [
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
                "Max Days Overdue",
              ],
              recoveryRows.map((item) => [
                item.salesperson,
                item.region,
                formatCurrency(item.invoiced),
                formatCurrency(item.recovered),
                formatCurrency(item.outstanding),
                formatNumber(item.overdueCount),
                formatNumber(item.maxDaysOverdue),
              ]),
            );
          } else {
            ctx.addEmptyNote(doc, ctx, "No recovery history available.");
          }
        },
      },
      {
        id: "customer",
        label: "Customer comparison report",
        fileSlug: "customer-comparison",
        render: (doc, ctx) => {
          ctx.addSectionTitle(
            doc,
            ctx,
            `Customer comparison report - ${reportPeriodLabel}`,
          );
          if (customerReport.length) {
            ctx.addTable(
              doc,
              ctx,
              ["Customer", "Sales", "Invoices", "Recovered", "Outstanding"],
              customerReport.map((item) => [
                item.customer,
                formatCurrency(item.saleValue),
                formatCurrency(item.invoiced),
                formatCurrency(item.recovered),
                formatCurrency(item.outstanding),
              ]),
            );
          } else {
            ctx.addEmptyNote(
              doc,
              ctx,
              "No customer comparison data available.",
            );
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
      customerReport,
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
      ...customerReport.map((r) => ({
        section: "Customer",
        name: r.customer,
        period: reportPeriodLabel,
        saleValue: r.saleValue,
        recoveryAmount: r.invoiced,
        recovered: r.recovered,
      })),
    ];

    exportToCSV(rows, REPORT_EXPORT_COLUMNS, "sales-reports");
  };

  const selectedReport =
    reportSections.find((section) => section.id === selectedReportId) ||
    reportSections[0];

  const renderSelectedReport = () => {
    const AchievementBadge = ({ value }) => (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          value >= 100
            ? "bg-success/10 text-success"
            : value >= 75
              ? "bg-warning/10 text-warning"
              : "bg-destructive/10 text-destructive"
        }`}
      >
        {formatPct(value)}
      </span>
    );

    // Shared row shell for the list-style reports (salesperson, product,
    // region, recovery), styled after the reference dashboard's "Recent
    // Reports" rows: an icon tile on the left, name + meta underneath, and
    // a primary value with a status badge on the right.
    const ListRow = ({ icon: Icon, title, meta, value, valueLabel, badge }) => (
      <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-secondary/40 transition-colors duration-150">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Icon className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {title}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {meta.map((m, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span>·</span>}
                  <span>{m}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{value}</p>
            {valueLabel && (
              <p className="text-xs text-muted-foreground">{valueLabel}</p>
            )}
          </div>
          {badge}
        </div>
      </div>
    );

    switch (selectedReport.id) {
      case "trend":
        return (
          <div className="space-y-5">
            {/* Chart row: sales-vs-target bars alongside a "sales by
                region" donut, mirroring the reference dashboard's
                Conversion Trend + Lead Sources pairing. */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                {chartPeriodSeries.length ? (
                  <div className="h-64 md:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartPeriodSeries}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="oklch(0.22 0.005 260)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "oklch(0.65 0 0)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "oklch(0.65 0 0)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => formatCompact(v)}
                        />
                        <Tooltip
                          cursor={{ fill: "oklch(0.18 0.005 260)" }}
                          contentStyle={{
                            backgroundColor: "oklch(0.12 0.005 260)",
                            border: "1px solid oklch(0.22 0.005 260)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelStyle={{
                            color: "oklch(0.95 0 0)",
                            fontWeight: 600,
                          }}
                          itemStyle={{ color: "oklch(0.85 0 0)" }}
                          formatter={(value) => formatCompact(value)}
                        />
                        <Bar dataKey="sales" name="Sales" radius={[4, 4, 0, 0]}>
                          {chartPeriodSeries.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={
                                entry.key === activePeriod?.key
                                  ? "oklch(0.7 0.18 145)"
                                  : "oklch(0.7 0.18 145 / 0.3)"
                              }
                            />
                          ))}
                        </Bar>
                        <Bar
                          dataKey="target"
                          fill="oklch(0.65 0 0 / 0.3)"
                          name="Target"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground md:h-72">
                    No activity found for the selected period.
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-4 text-sm font-medium text-foreground">
                  Sales by region — {reportPeriodLabel}
                </p>
                {regionDonutData.length ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-35 w-35">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={regionDonutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={64}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {regionDonutData.map((entry, index) => (
                              <Cell
                                key={`region-slice-${index}`}
                                fill={entry.color}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full space-y-2">
                      {regionDonutData.map((entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-foreground">
                              {entry.name}
                            </span>
                          </div>
                          <span className="font-medium text-muted-foreground">
                            {entry.percent.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center text-center text-xs text-muted-foreground">
                    No region data for this period.
                  </div>
                )}
              </div>
            </div>

            {activePeriod && filteredTrendRows.length > 0 && (
              <div className="border-t border-border pt-5">
                <h3 className="mb-3 text-base font-semibold text-foreground">
                  Detailed breakdown — {reportPeriodLabel}
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-accent/10 p-3">
                    <p className="text-xs font-medium text-accent">
                      Sales Value
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {formatCurrency(totals.saleValue)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Target Value (Rs)
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {formatCurrency(totals.targetValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Achievement {formatPct(totals.achievement)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Volume Sold
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">
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
          <PaginatedListPanel
            items={searchedSalespersonReport}
            emptyLabel="No salesperson comparison data is currently available."
            renderRow={(item) => (
              <ListRow
                key={item.salesperson}
                icon={UserRound}
                title={item.salesperson}
                meta={[
                  item.region,
                  `Target ${formatCurrency(item.targetValue)}`,
                ]}
                value={formatCurrency(item.saleValue)}
                valueLabel="Sale value"
                badge={<AchievementBadge value={item.valueAchievement} />}
              />
            )}
          />
        );
      case "product":
        return (
          <PaginatedListPanel
            items={searchedProductBreakdown}
            emptyLabel="No product data available yet."
            renderRow={(item) => (
              <ListRow
                key={item.product}
                icon={Package}
                title={item.product}
                meta={[
                  `${formatNumber(item.volume)} kg`,
                  `Target ${formatCurrency(item.targetValue)}`,
                ]}
                value={formatCurrency(item.saleValue)}
                valueLabel="Sale value"
              />
            )}
          />
        );
      case "region":
        return (
          <PaginatedListPanel
            items={searchedRegionBreakdown}
            emptyLabel="No region breakdown available."
            renderRow={(item) => (
              <ListRow
                key={item.region}
                icon={MapPin}
                title={item.region}
                meta={[
                  `${formatNumber(item.volume)} kg`,
                  `Target ${formatCurrency(item.targetValue)}`,
                ]}
                value={formatCurrency(item.saleValue)}
                valueLabel="Sale value"
              />
            )}
          />
        );
      case "recovery":
        return (
          <PaginatedListPanel
            items={searchedRecoveryRows}
            emptyLabel="No recovery history available."
            renderRow={(item) => (
              <ListRow
                key={item.salesperson}
                icon={Wallet}
                title={item.salesperson}
                meta={[
                  item.region,
                  `Invoiced ${formatCurrency(item.invoiced)}`,
                  `Recovered ${formatCurrency(item.recovered)}`,
                ]}
                value={formatCurrency(item.outstanding)}
                valueLabel="Outstanding"
                badge={
                  item.overdueCount > 0 ? (
                    <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20">
                      {item.overdueCount} overdue
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      0 overdue
                    </Badge>
                  )
                }
              />
            )}
          />
        );
      case "customer":
        return (
          <TanStackDataTable
            columns={customerColumns}
            data={searchedCustomerReport}
            emptyMessage="No customer comparison data available."
            getRowId={(row) => row.customer}
            paginate
            defaultPageSize={10}
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
              <h1 className="text-lg font-semibold text-accent">
                Reports &amp; Forecasting
              </h1>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-2">
              <Tabs value={view} onValueChange={setView}>
                <TabsList className="bg-secondary border border-border p-1">
                  <TabsTrigger
                    value="monthly"
                    className="text-xs data-[state=active]:bg-card data-[state=active]:text-accent"
                  >
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger
                    value="quarterly"
                    className="text-xs data-[state=active]:bg-card data-[state=active]:text-accent"
                  >
                    Quarterly
                  </TabsTrigger>
                  <TabsTrigger
                    value="yearly"
                    className="text-xs data-[state=active]:bg-card data-[state=active]:text-accent"
                  >
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
                className="gap-1.5 text-xs hover:text-accent"
                asChild
              >
                <Link href="/reports/forecasting">
                  <TrendingUp className="h-3.5 w-3.5 hover:text-accent" />
                  Forecasting
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    disabled={loading || !trendRows.length}
                    className="gap-1.5 bg-accent text-xs hover:bg-accent/90"
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
                    <FileSpreadsheet className="h-3.5 w-3.5 text-success" />
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
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
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
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <span>{fetchError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchReportsData}
                className="shrink-0 border-destructive/40 text-xs text-destructive hover:bg-destructive/20"
              >
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <KPISkeleton key={i} />
                ))}
              </div>
              <ChartSkeleton height="h-[280px]" />
              <TableSkeleton rows={4} />
            </div>
          ) : (
            <>
              {/* Quick report cards: one per report section, styled after the
                  reference dashboard's Sales Summary / Conversion Rates /
                  Lead Sources / Forecast cards. Clicking a card selects that
                  report below, and the active one is highlighted. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {reportSections.map((section, index) => {
                  const meta = REPORT_META[section.id] || {};
                  const SectionIcon = meta.icon || BarChart3;
                  const isActive = selectedReportId === section.id;
                  // Static class strings (not interpolated) so Tailwind's
                  // compiler can find and generate them at build time.
                  const REPORT_CARD_COLORS = {
                    "chart-1": "bg-chart-1/10 text-chart-1",
                    "chart-3": "bg-chart-3/10 text-chart-3",
                    "chart-4": "bg-chart-4/10 text-chart-4",
                    "chart-5": "bg-chart-5/10 text-chart-5",
                    accent: "bg-accent/10 text-accent",
                  };
                  const colorClass =
                    REPORT_CARD_COLORS[meta.color] || REPORT_CARD_COLORS.accent;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setSelectedReportId(section.id)}
                      className={`group rounded-xl border p-5 text-left transition-all duration-200 ${
                        isActive
                          ? "border-accent/60 bg-accent/5"
                          : "border-border bg-card hover:border-accent/50"
                      }`}
                    >
                      <div
                        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}
                      >
                        <SectionIcon className="h-5 w-5" />
                      </div>
                      <h3 className="mb-1 text-sm font-semibold text-foreground">
                        {section.label}
                      </h3>
                      <p className="mb-4 text-xs text-muted-foreground">
                        {meta.description}
                      </p>
                      <span
                        className={`flex items-center gap-1 text-xs font-medium transition-all duration-200 ${
                          isActive
                            ? "text-accent"
                            : "text-muted-foreground group-hover:gap-2 group-hover:text-accent"
                        }`}
                      >
                        {isActive ? "Viewing report" : "View Report"}
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* KPI summary cards with a small trend sparkline, styled after
                  the reference dashboard's top stat cards. */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card, cardIndex) => {
                  const CardIcon = card.icon;
                  const badgeColor = [
                    "bg-chart-1/10 text-chart-1",
                    "bg-accent/10 text-accent",
                    "bg-chart-3/10 text-chart-3",
                    "bg-chart-5/10 text-chart-5",
                  ][cardIndex % 4];
                  return (
                    <div
                      key={card.title}
                      className="group rounded-xl border border-border bg-card p-4 hover:border-accent/50 transition-colors duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${badgeColor}`}
                          >
                            <CardIcon className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {card.title}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs font-normal text-muted-foreground"
                        >
                          {viewLabel(view)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold text-foreground">
                            {card.value}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
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
                                      stopColor="oklch(0.7 0.18 145)"
                                      stopOpacity={0.35}
                                    />
                                    <stop
                                      offset="100%"
                                      stopColor="oklch(0.7 0.18 145)"
                                      stopOpacity={0}
                                    />
                                  </linearGradient>
                                </defs>
                                <Area
                                  type="monotone"
                                  dataKey="v"
                                  stroke="oklch(0.7 0.18 145)"
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

              {/* Report detail panel: header shows which quick-card is
                  active, a search box for the list-style reports, and the
                  selected report's chart/list content — styled after the
                  reference dashboard's "Recent Reports" panel. */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {selectedReport.label}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {REPORT_META[selectedReportId]?.description}
                    </p>
                  </div>

                  {[
                    "salesperson",
                    "product",
                    "region",
                    "recovery",
                    "customer",
                  ].includes(selectedReportId) && (
                    <div className="flex items-center gap-2">
                      <div className="relative w-full sm:w-56">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
                          className="h-8 gap-1.5 text-xs hover:text-accent"
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

                <div className="mb-3 mt-4 flex items-center justify-end">
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
