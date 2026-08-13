"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Download,
  MapPin,
  Package,
  Target,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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

const formatCurrency = (value) =>
  typeof value === "number" ? `Rs ${value.toLocaleString("en-US")}` : "Rs 0";

const formatNumber = (value) =>
  typeof value === "number" ? value.toLocaleString("en-US") : "0";

const formatPct = (value) =>
  typeof value === "number" ? `${value.toFixed(1)}%` : "0.0%";

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

const getNextPeriodLabels = (bucket, view, count = 4) => {
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

const buildForecast = (historyValues) => {
  if (!historyValues.length) return Array.from({ length: 4 }, () => 0);

  const values = historyValues.map((value) => Number(value || 0));
  const lastValue = values[values.length - 1] || 0;
  const firstValue = values[0] || 0;
  const slope =
    values.length > 1 ? (lastValue - firstValue) / (values.length - 1) : 0;

  return Array.from({ length: 4 }, (_, index) =>
    Math.max(0, lastValue + slope * (index + 1)),
  );
};

export default function ReportsPage() {
  const [view, setView] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [trendRows, setTrendRows] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("salesperson");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");

  const fetchReportsData = async () => {
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

  const salesmanLookup = useMemo(() => {
    return new Map(
      (salesmen || []).map((salesman) => [salesman.name, salesman]),
    );
  }, [salesmen]);

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
          region: salesmanLookup.get(name)?.area || "Unknown",
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
  }, [filteredTrendRows, salesmanLookup]);

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
      const region = salesmanLookup.get(row.salesperson)?.area || "Unknown";
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
  }, [filteredTrendRows, salesmanLookup]);

  const recoveryRows = useMemo(() => {
    return (salesmen || [])
      .map((salesman) => ({
        salesperson: salesman.name,
        region: salesman.area || "Unknown",
        recoveryAmount: Number(salesman.recovery?.amount || 0),
        recoveryCustomers: Number(salesman.recovery?.customer || 0),
      }))
      .sort((left, right) => right.recoveryAmount - left.recoveryAmount);
  }, [salesmen]);

  const forecastProductRows = useMemo(() => {
    const grouped = {};

    trendRows.forEach((row) => {
      const product = row.product || "Unknown";
      const bucket = getPeriodBucket(row.period, view);
      if (!bucket) return;
      if (!grouped[product]) {
        grouped[product] = {};
      }

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
        const forecast = buildForecast(history);

        return {
          product,
          history: history[history.length - 1] || 0,
          latestPeriod: orderedPeriods[orderedPeriods.length - 1]?.label || "-",
          forecast,
          forecastLabels: getNextPeriodLabels(activePeriod, view),
        };
      })
      .sort((left, right) => right.history - left.history)
      .slice(0, 6);
  }, [trendRows, view, activePeriod]);

  const forecastRegionRows = useMemo(() => {
    const grouped = {};

    trendRows.forEach((row) => {
      const region = salesmanLookup.get(row.salesperson)?.area || "Unknown";
      const bucket = getPeriodBucket(row.period, view);
      if (!bucket) return;
      if (!grouped[region]) {
        grouped[region] = {};
      }

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
        const forecast = buildForecast(history);

        return {
          region,
          history: history[history.length - 1] || 0,
          latestPeriod: orderedPeriods[orderedPeriods.length - 1]?.label || "-",
          forecast,
          forecastLabels: getNextPeriodLabels(activePeriod, view),
        };
      })
      .sort((left, right) => right.history - left.history);
  }, [trendRows, salesmanLookup, view, activePeriod]);

  const totals = useMemo(() => {
    const saleValue = filteredTrendRows.reduce(
      (sum, row) => sum + Number(row.saleValueRs || 0),
      0,
    );
    const targetValue = filteredTrendRows.reduce(
      (sum, row) => sum + Number(row.targetValueRs || 0),
      0,
    );
    const recoveryAmount = recoveryRows.reduce(
      (sum, row) => sum + row.recoveryAmount,
      0,
    );
    const achievement = targetValue > 0 ? (saleValue / targetValue) * 100 : 0;

    return { saleValue, targetValue, recoveryAmount, achievement };
  }, [filteredTrendRows, recoveryRows]);

  const summaryCards = [
    {
      title: "Sales Value",
      value: formatCurrency(totals.saleValue),
      detail: `${formatNumber(filteredTrendRows.reduce((sum, row) => sum + Number(row.saleVolumeKg || 0), 0))} kg sold`,
      icon: Wallet,
    },
    {
      title: "Target Value",
      value: formatCurrency(totals.targetValue),
      detail: `Achievement ${formatPct(totals.achievement)}`,
      icon: Target,
    },
    {
      title: "Recovery",
      value: formatCurrency(totals.recoveryAmount),
      detail: `${recoveryRows.length} salespersons tracked`,
      icon: TrendingUp,
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
          ctx.addSectionTitle(doc, ctx, `Summary - ${reportPeriodLabel}`);
          ctx.addTable(
            doc,
            ctx,
            ["Metric", "Value"],
            [
              ["Report Period", reportPeriodLabel],
              ["Sales Value", formatCurrency(totals.saleValue)],
              ["Target Value", formatCurrency(totals.targetValue)],
              ["Achievement", formatPct(totals.achievement)],
              ["Recovery", formatCurrency(totals.recoveryAmount)],
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
                "Target Value",
                "Sale Value",
                "Value Ach.",
                "Target Vol (kg)",
                "Sale Vol (kg)",
                "Vol Ach.",
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
              ["Product", "Volume (kg)", "Sale Value", "Target Value"],
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
              ["Region", "Volume (kg)", "Sale Value", "Target Value"],
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
                "Recovery Amount",
                "Recovery Customers",
              ],
              recoveryRows.map((item) => [
                item.salesperson,
                item.region,
                formatCurrency(item.recoveryAmount),
                formatNumber(item.recoveryCustomers),
              ]),
            );
          } else {
            ctx.addEmptyNote(doc, ctx, "No recovery history available.");
          }
        },
      },
      {
        id: "forecast",
        label: "Forecasting by product & region",
        fileSlug: "forecasting",
        render: (doc, ctx) => {
          ctx.addSectionTitle(
            doc,
            ctx,
            `Forecasting by product (next 4 ${viewUnit(view)}s)`,
          );
          if (forecastProductRows.length) {
            ctx.addTable(
              doc,
              ctx,
              [
                "Product",
                "Latest Period",
                "Latest Sales",
                ...getNextPeriodLabels(activePeriod, view),
              ],
              forecastProductRows.map((item) => [
                item.product,
                item.latestPeriod,
                formatCurrency(item.history),
                ...item.forecast.map(formatCurrency),
              ]),
            );
          } else {
            ctx.addEmptyNote(doc, ctx, "No forecast history available.");
          }

          ctx.addSectionTitle(
            doc,
            ctx,
            `Forecasting by region (next 4 ${viewUnit(view)}s)`,
          );
          if (forecastRegionRows.length) {
            ctx.addTable(
              doc,
              ctx,
              [
                "Region",
                "Latest Period",
                "Latest Sales",
                ...getNextPeriodLabels(activePeriod, view),
              ],
              forecastRegionRows.map((item) => [
                item.region,
                item.latestPeriod,
                formatCurrency(item.history),
                ...item.forecast.map(formatCurrency),
              ]),
            );
          } else {
            ctx.addEmptyNote(doc, ctx, "No region forecast data available.");
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
      forecastProductRows,
      forecastRegionRows,
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

  const selectedReport =
    reportSections.find((section) => section.id === selectedReportId) ||
    reportSections[0];

  const renderSelectedReport = () => {
    switch (selectedReport.id) {
      case "summary":
        return (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                {selectedReport.label}
                <Badge variant="outline">{reportPeriodLabel}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        {card.title}
                      </span>
                      <Icon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-2xl font-semibold text-gray-900">
                      {card.value}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">{card.detail}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      case "trend":
        return (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Sales trend by {viewUnit(view)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {periodSeries.length ? (
                <div className="h-72 md:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={periodSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="sales" fill="#2563eb" name="Sales" />
                      <Bar dataKey="target" fill="#94a3b8" name="Target" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  No activity found for the selected period.
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "salesperson":
        return (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-blue-600" />
                {selectedReport.label}
                <Badge variant="outline">{reportPeriodLabel}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {salespersonReport.length ? (
                salespersonReport.map((item) => (
                  <div
                    key={item.salesperson}
                    className="rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {item.salesperson}
                        </p>
                        <p className="text-sm text-gray-500">{item.region}</p>
                      </div>
                      <Badge variant="secondary">
                        {formatPct(item.valueAchievement)}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                      <div>Target: {formatCurrency(item.targetValue)}</div>
                      <div>Actual: {formatCurrency(item.saleValue)}</div>
                      <div>
                        Target volume: {formatNumber(item.targetVolume)} kg
                      </div>
                      <div>
                        Actual volume: {formatNumber(item.saleVolume)} kg
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">
                  No salesperson comparison data is currently available.
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "product":
        return (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                {selectedReport.label}
                <Badge variant="outline">{reportPeriodLabel}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {productBreakdown.length ? (
                productBreakdown.map((item) => (
                  <div
                    key={item.product}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.product}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatNumber(item.volume)} kg
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(item.saleValue)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Target {formatCurrency(item.targetValue)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">
                  No product data available yet.
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "region":
        return (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                {selectedReport.label}
                <Badge variant="outline">{reportPeriodLabel}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {regionBreakdown.length ? (
                regionBreakdown.map((item) => (
                  <div
                    key={item.region}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.region}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatNumber(item.volume)} kg
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(item.saleValue)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Target {formatCurrency(item.targetValue)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">
                  No region breakdown available.
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "recovery":
        return (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                {selectedReport.label}
                <Badge variant="outline">{reportPeriodLabel}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recoveryRows.length ? (
                recoveryRows.map((item) => (
                  <div
                    key={item.salesperson}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.salesperson}
                      </p>
                      <p className="text-sm text-gray-500">{item.region}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(item.recoveryAmount)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.recoveryCustomers} customers
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">
                  No recovery history available.
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "forecast":
        return (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Forecasting by product (next 4 {viewUnit(view)}s)
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
                          Latest {item.latestPeriod}:{" "}
                          {formatCurrency(item.history)}
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
                  Forecasting by region (next 4 {viewUnit(view)}s)
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
                          Latest {item.latestPeriod}:{" "}
                          {formatCurrency(item.history)}
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
        );
      default:
        return null;
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Reports & Forecasting
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Review sales performance, recovery, targets, and forecasts for
                the selected reporting period.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{viewLabel(view)}</Badge>
                <Badge variant="outline">
                  Report period: {reportPeriodLabel}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={loading || !trendRows.length}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="h-4 w-4" />
                    Download as PDF
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuItem
                    onClick={() => generatePdf("all")}
                    className="font-semibold"
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
                className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
              >
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              Loading report data...
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Reports
                  </h2>
                  <span className="text-xs text-gray-500">
                    {reportSections.length} available
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {reportSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setSelectedReportId(section.id)}
                      className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                        selectedReportId === section.id
                          ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50"
                      }`}
                    >
                      <span className="block text-sm font-medium leading-5">
                        {section.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1">{renderSelectedReport()}</div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
