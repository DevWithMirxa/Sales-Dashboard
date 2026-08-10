"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
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
  return `${months[Number(month)]} ${year.slice(2)}`;
};

const quarterLabel = (period) => {
  const [year, month] = period.split("-");
  const quarter = Math.ceil(Number(month) / 3);
  return `Q${quarter} ${year}`;
};

const yearLabel = (period) => period.split("-")[0];

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

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      setFetchError("");

      const results = await Promise.allSettled([
        api.get("/trends", { params: { limit: 1000 } }),
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

  const periodSeries = useMemo(() => {
    const groups = {};

    trendRows.forEach((row) => {
      const label =
        view === "monthly"
          ? monthLabel(row.period)
          : view === "quarterly"
            ? quarterLabel(row.period)
            : yearLabel(row.period);

      if (!groups[label]) {
        groups[label] = {
          label,
          sales: 0,
          target: 0,
          volume: 0,
        };
      }

      groups[label].sales += Number(row.saleValueRs || 0);
      groups[label].target += Number(row.targetValueRs || 0);
      groups[label].volume += Number(row.saleVolumeKg || 0);
    });

    return Object.values(groups).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [trendRows, view]);

  const salespersonReport = useMemo(() => {
    const groups = {};

    trendRows.forEach((row) => {
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
  }, [trendRows, salesmanLookup]);

  const productBreakdown = useMemo(() => {
    const groups = {};

    trendRows.forEach((row) => {
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
  }, [trendRows]);

  const regionBreakdown = useMemo(() => {
    const groups = {};

    trendRows.forEach((row) => {
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
  }, [trendRows, salesmanLookup]);

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
      if (!grouped[product]) {
        grouped[product] = {};
      }

      grouped[product][row.period] =
        Number(grouped[product][row.period] || 0) +
        Number(row.saleValueRs || 0);
    });

    return Object.entries(grouped)
      .map(([product, monthlyValues]) => {
        const orderedPeriods = Object.keys(monthlyValues).sort().slice(-6);
        const history = orderedPeriods.map((period) => monthlyValues[period]);
        const forecast = buildForecast(history);

        return {
          product,
          history: history[history.length - 1] || 0,
          forecast1: forecast[0],
          forecast2: forecast[1],
          forecast3: forecast[2],
          forecast4: forecast[3],
        };
      })
      .sort((left, right) => right.history - left.history)
      .slice(0, 6);
  }, [trendRows]);

  const forecastRegionRows = useMemo(() => {
    const grouped = {};

    trendRows.forEach((row) => {
      const region = salesmanLookup.get(row.salesperson)?.area || "Unknown";
      if (!grouped[region]) {
        grouped[region] = {};
      }

      grouped[region][row.period] =
        Number(grouped[region][row.period] || 0) + Number(row.saleValueRs || 0);
    });

    return Object.entries(grouped)
      .map(([region, monthlyValues]) => {
        const orderedPeriods = Object.keys(monthlyValues).sort().slice(-6);
        const history = orderedPeriods.map((period) => monthlyValues[period]);
        const forecast = buildForecast(history);

        return {
          region,
          history: history[history.length - 1] || 0,
          forecast1: forecast[0],
          forecast2: forecast[1],
          forecast3: forecast[2],
          forecast4: forecast[3],
        };
      })
      .sort((left, right) => right.history - left.history);
  }, [trendRows, salesmanLookup]);

  const totals = useMemo(() => {
    const saleValue = trendRows.reduce(
      (sum, row) => sum + Number(row.saleValueRs || 0),
      0,
    );
    const targetValue = trendRows.reduce(
      (sum, row) => sum + Number(row.targetValueRs || 0),
      0,
    );
    const recoveryAmount = recoveryRows.reduce(
      (sum, row) => sum + row.recoveryAmount,
      0,
    );
    const achievement = targetValue > 0 ? (saleValue / targetValue) * 100 : 0;

    return { saleValue, targetValue, recoveryAmount, achievement };
  }, [trendRows, recoveryRows]);

  const summaryCards = [
    {
      title: "Sales Value",
      value: formatCurrency(totals.saleValue),
      detail: `${formatNumber(trendRows.reduce((sum, row) => sum + Number(row.saleVolumeKg || 0), 0))} kg sold`,
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
          ctx.addSectionTitle(doc, ctx, "Summary");
          ctx.addTable(
            doc,
            ctx,
            ["Metric", "Value"],
            [
              ["Sales Value", formatCurrency(totals.saleValue)],
              ["Target Value", formatCurrency(totals.targetValue)],
              ["Achievement", formatPct(totals.achievement)],
              ["Recovery", formatCurrency(totals.recoveryAmount)],
              [
                "Volume Sold",
                `${formatNumber(
                  trendRows.reduce(
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
          ctx.addSectionTitle(doc, ctx, "Salesperson comparison report");
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
          ctx.addSectionTitle(doc, ctx, "Product-wise sales overview");
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
          ctx.addSectionTitle(doc, ctx, "Region-wise sales performance");
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
          ctx.addSectionTitle(doc, ctx, "Recovery overview");
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
            "Forecasting by product (next 4 months)",
          );
          if (forecastProductRows.length) {
            ctx.addTable(
              doc,
              ctx,
              ["Product", "Latest", "M1", "M2", "M3", "M4"],
              forecastProductRows.map((item) => [
                item.product,
                formatCurrency(item.history),
                formatCurrency(item.forecast1),
                formatCurrency(item.forecast2),
                formatCurrency(item.forecast3),
                formatCurrency(item.forecast4),
              ]),
            );
          } else {
            ctx.addEmptyNote(doc, ctx, "No forecast history available.");
          }

          ctx.addSectionTitle(
            doc,
            ctx,
            "Forecasting by region (next 4 months)",
          );
          if (forecastRegionRows.length) {
            ctx.addTable(
              doc,
              ctx,
              ["Region", "Latest", "M1", "M2", "M3", "M4"],
              forecastRegionRows.map((item) => [
                item.region,
                formatCurrency(item.history),
                formatCurrency(item.forecast1),
                formatCurrency(item.forecast2),
                formatCurrency(item.forecast3),
                formatCurrency(item.forecast4),
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
      trendRows,
      view,
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
      `Sales trend view: ${view.charAt(0).toUpperCase() + view.slice(1)}  |  Generated: ${generatedAt}`,
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

    // Footer page numbers
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

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Reports & Forecasting
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Review sales performance, recovery, targets, and next-quarter
                projections in one place.
              </p>
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
            <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
              <div className="grid gap-4 md:grid-cols-3">
                {summaryCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Card
                      key={card.title}
                      className="border-gray-200 shadow-sm"
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                          {card.title}
                        </CardTitle>
                        <Icon className="h-4 w-4 text-blue-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-semibold text-gray-900">
                          {card.value}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {card.detail}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Sales trend by {view === "yearly" ? "year" : view}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {periodSeries.length ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={periodSeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
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

              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserRound className="h-5 w-5 text-blue-600" />
                      Salesperson comparison report
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {salespersonReport.length ? (
                      salespersonReport.map((item) => (
                        <div
                          key={item.salesperson}
                          className="rounded-lg border border-gray-200 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {item.salesperson}
                              </p>
                              <p className="text-sm text-gray-500">
                                {item.region}
                              </p>
                            </div>
                            <Badge variant="secondary">
                              {formatPct(item.valueAchievement)}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                            <div>
                              Target: {formatCurrency(item.targetValue)}
                            </div>
                            <div>Actual: {formatCurrency(item.saleValue)}</div>
                            <div>
                              Target volume: {formatNumber(item.targetVolume)}{" "}
                              kg
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

                <Card className="border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      Product-wise sales overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {productBreakdown.length ? (
                      productBreakdown.map((item) => (
                        <div
                          key={item.product}
                          className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">
                              {item.product}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatNumber(item.volume)} kg
                            </p>
                          </div>
                          <div className="text-right">
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
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      Region-wise sales performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {regionBreakdown.length ? (
                      regionBreakdown.map((item) => (
                        <div
                          key={item.region}
                          className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">
                              {item.region}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatNumber(item.volume)} kg
                            </p>
                          </div>
                          <div className="text-right">
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

                <Card className="border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Recovery overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recoveryRows.length ? (
                      recoveryRows.map((item) => (
                        <div
                          key={item.salesperson}
                          className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">
                              {item.salesperson}
                            </p>
                            <p className="text-sm text-gray-500">
                              {item.region}
                            </p>
                          </div>
                          <div className="text-right">
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
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Forecasting by product (next 4 months)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {forecastProductRows.length ? (
                      forecastProductRows.map((item) => (
                        <div
                          key={item.product}
                          className="rounded-lg border border-gray-200 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-900">
                              {item.product}
                            </p>
                            <p className="text-sm text-gray-500">
                              Latest: {formatCurrency(item.history)}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[
                              item.forecast1,
                              item.forecast2,
                              item.forecast3,
                              item.forecast4,
                            ].map((value, index) => (
                              <Badge
                                key={`${item.product}-${index}`}
                                variant="secondary"
                              >
                                M{index + 1}: {formatCurrency(value)}
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
                      Forecasting by region (next 4 months)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {forecastRegionRows.length ? (
                      forecastRegionRows.map((item) => (
                        <div
                          key={item.region}
                          className="rounded-lg border border-gray-200 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-900">
                              {item.region}
                            </p>
                            <p className="text-sm text-gray-500">
                              Latest: {formatCurrency(item.history)}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[
                              item.forecast1,
                              item.forecast2,
                              item.forecast3,
                              item.forecast4,
                            ].map((value, index) => (
                              <Badge
                                key={`${item.region}-${index}`}
                                variant="secondary"
                              >
                                M{index + 1}: {formatCurrency(value)}
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
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
