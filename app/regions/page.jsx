"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import RegionForm from "@/components/forms/RegionForm";
import {
  Plus,
  Trash2,
  Edit2,
  Users,
  MapPin,
  TrendingUp,
  Target,
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import ConfirmDelete from "@/components/ConfirmDelete";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KPISkeleton } from "@/components/ui/skeleton";

// Compact a number into a short, human-friendly string, e.g.
// 30,820,000 -> "30.82 M" and 21,700 -> "21.7 K".
const formatCompact = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
  return `${Math.round(n)}`;
};

function StatCard({ label, value, icon: Icon, colorClass }) {
  return (
    <Card className="border-border bg-card transition-all duration-300 hover:border-muted-foreground/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-2xl font-semibold", colorClass)}>
              {value}
            </p>
          </div>
          <Icon className={cn("h-8 w-8 opacity-50", colorClass)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Regions() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRegion, setEditingRegion] = useState(null);

  const fetchRegions = async () => {
    try {
      setLoading(true);
      const res = await api.get("/regions");
      setRegions(res.data);
    } catch (error) {
      console.error("Error fetching regions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegions();
  }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/regions/${id}`);
      fetchRegions();
    } catch (error) {
      console.error("Error deleting region:", error);
      alert("Failed to delete region");
    }
  };

  const handleEdit = (region) => {
    setEditingRegion(region);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRegion(null);
  };

  const getAchievementPercentage = (sales, target) => {
    if (!target) return null;
    return Math.round((sales / target) * 100);
  };

  const formatPeriod = (period) => {
    if (!period) return null;
    const [year, month] = period.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString("en-US", { month: "short", year: "numeric" });
  };

  // Semantic color + label for an achievement percentage, matching the
  // success/warning/destructive thresholds used across the dashboard.
  const getAchievementStatus = (percentage) => {
    if (percentage === null)
      return {
        color: "text-muted-foreground",
        bar: "bg-muted-foreground",
        label: "No Target",
      };
    if (percentage >= 100)
      return { color: "text-success", bar: "bg-success", label: "On Track" };
    if (percentage >= 80)
      return { color: "text-warning", bar: "bg-warning", label: "Near Target" };
    return {
      color: "text-destructive",
      bar: "bg-destructive",
      label: "Behind",
    };
  };

  const regionColumns = [
    { label: "Region", key: "region" },
    { label: "Sales Team Members", value: (r) => r.salesCount || 0 },
    {
      label: "Sales Team Names",
      value: (r) =>
        (r.salesTeam || [])
          .map((m) => m.salesperson)
          .filter(Boolean)
          .join(", "),
    },
    {
      label: "Latest Period",
      value: (r) => formatPeriod(r.period) || r.period || "-",
    },
    { label: "Monthly Sales (Rs)", value: (r) => r.monthlySales || 0 },
    { label: "Target (Rs)", value: (r) => r.target || 0 },
    {
      label: "Achievement (%)",
      value: (r) => {
        const pct = getAchievementPercentage(
          r.monthlySales || 0,
          r.target || 0,
        );
        return pct === null ? "-" : pct;
      },
    },
  ];

  const handleExportExcel = () => {
    exportToCSV(regions, regionColumns, "regions");
  };

  const handleExportPDF = () => {
    exportToPDF(regions, regionColumns, {
      title: "Regions",
      subtitle: "Sales team regions with performance",
      filename: "regions",
    });
  };

  // Summary stats derived from the loaded regions.
  const stats = useMemo(() => {
    const totalSalesTeam = regions.reduce(
      (acc, r) => acc + (r.salesCount || 0),
      0,
    );
    const totalMonthlySales = regions.reduce(
      (acc, r) => acc + (r.monthlySales || 0),
      0,
    );
    const withTarget = regions
      .map((r) => getAchievementPercentage(r.monthlySales || 0, r.target || 0))
      .filter((p) => p !== null);
    const avgAchievement = withTarget.length
      ? Math.round(withTarget.reduce((a, b) => a + b, 0) / withTarget.length)
      : null;
    return { totalSalesTeam, totalMonthlySales, avgAchievement };
  }, [regions]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-bold tracking-tight text-accent">
            Regions
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton
              onExcel={handleExportExcel}
              onPdf={handleExportPDF}
            />
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
              onClick={() => setShowForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Region
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            label="Total Regions"
            value={regions.length}
            icon={MapPin}
            colorClass="text-foreground"
          />
          <StatCard
            label="Sales Team Members"
            value={stats.totalSalesTeam}
            icon={Users}
            colorClass="text-chart-1"
          />
          <StatCard
            label="Total Monthly Sales"
            value={`Rs ${formatCompact(stats.totalMonthlySales)}`}
            icon={TrendingUp}
            colorClass="text-accent"
          />
          <StatCard
            label="Avg Achievement"
            value={
              stats.avgAchievement === null ? "-" : `${stats.avgAchievement}%`
            }
            icon={Target}
            colorClass="text-chart-3"
          />
        </div>

        {/* Regions Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <KPISkeleton key={i} />
            ))}
          </div>
        ) : regions.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-border bg-card py-16 text-sm text-muted-foreground">
            No regions found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {regions.map((regionObj) => {
              const achievement = getAchievementPercentage(
                regionObj.monthlySales || 0,
                regionObj.target || 0,
              );
              const periodLabel = formatPeriod(regionObj.period);
              const status = getAchievementStatus(achievement);

              return (
                <Card
                  key={regionObj._id}
                  className="group border-border bg-card transition-all duration-300 hover:border-accent/50"
                >
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-foreground transition-colors group-hover:text-accent">
                          {regionObj.region}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {regionObj.salesCount || 0} sales team member
                          {regionObj.salesCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(regionObj)}
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <ConfirmDelete
                          title="Delete region"
                          description="Are you sure you want to delete this region? This action cannot be undone."
                          onConfirm={() => handleDelete(regionObj._id)}
                        >
                          <button
                            type="button"
                            title="Delete"
                            className="flex h-8 w-8 shrink-0 items-center justify-center text-red-500 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </ConfirmDelete>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          Sales Team
                        </div>
                        {regionObj.salesTeam?.length ? (
                          <ul className="max-h-28 space-y-1 overflow-y-auto pr-1">
                            {regionObj.salesTeam.map((member, i) => (
                              <li
                                key={`${member.salesperson}-${i}`}
                                className="flex items-center justify-between gap-2 rounded-md bg-secondary px-2 py-1.5 text-xs"
                              >
                                <span className="truncate font-medium text-foreground">
                                  {member.salesperson}
                                </span>
                                <span className="truncate text-muted-foreground">
                                  {member.designation || "-"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground/70">
                            No sales team assigned to this region yet.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2 border-t border-border pt-4">
                        {periodLabel && (
                          <p className="mb-1 text-xs text-muted-foreground/70">
                            Latest period: {periodLabel}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Monthly Sales
                          </span>
                          <span className="font-medium text-foreground">
                            Rs {formatCompact(regionObj.monthlySales || 0)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Target</span>
                          <span className="font-medium text-foreground">
                            Rs {formatCompact(regionObj.target || 0)}
                          </span>
                        </div>

                        {/* Achievement bar, styled after the health-score bar in the reference */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Achievement
                            </span>
                            {achievement !== null && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "border-current/30",
                                  status.color,
                                )}
                              >
                                {status.label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {achievement !== null && (
                              <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-1000 ease-out",
                                    status.bar,
                                  )}
                                  style={{
                                    width: `${Math.min(achievement, 100)}%`,
                                  }}
                                />
                              </div>
                            )}
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                status.color,
                              )}
                            >
                              {achievement === null ? "-" : `${achievement}%`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <RegionForm
            onClose={handleCloseForm}
            initialData={editingRegion}
            onSuccess={fetchRegions}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

export default function RegionsPage() {
  return (
    <ProtectedRoute>
      <Regions />
    </ProtectedRoute>
  );
}
