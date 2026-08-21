"use client";

import React, { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import RegionForm from "@/components/forms/RegionForm";
import { Plus, Trash2, Edit2, Users } from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import ConfirmDelete from "@/components/ConfirmDelete";

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

  const getStatusColor = (percentage) => {
    if (percentage >= 100) return "text-green-600";
    if (percentage >= 80) return "text-yellow-600";
    return "text-red-600";
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold text-gray-900">Regions</h1>
          <div className="flex items-center gap-3">
            <DownloadButton
              onExcel={handleExportExcel}
              onPdf={handleExportPDF}
            />
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs"
            >
              <Plus className="w-5 h-5" />
              Add Region
            </button>
          </div>
        </div>

        {/* Regions Grid */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            Loading regions...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regions.map((regionObj) => {
              const achievement = getAchievementPercentage(
                regionObj.monthlySales || 0,
                regionObj.target || 0,
              );
              const periodLabel = formatPeriod(regionObj.period);
              return (
                <div
                  key={regionObj._id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        {regionObj.region}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {regionObj.salesCount || 0} sales team member
                        {regionObj.salesCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(regionObj)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <ConfirmDelete
                        title="Delete region"
                        description="Are you sure you want to delete this region? This action cannot be undone."
                        onConfirm={() => handleDelete(regionObj._id)}
                      >
                        <button
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </ConfirmDelete>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2">
                        <Users className="w-3.5 h-3.5" />
                        Sales Team
                      </div>
                      {regionObj.salesTeam?.length ? (
                        <ul className="space-y-1 max-h-28 overflow-y-auto pr-1">
                          {regionObj.salesTeam.map((member, i) => (
                            <li
                              key={`${member.salesperson}-${i}`}
                              className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded px-2 py-1.5"
                            >
                              <span className="text-gray-800 font-medium truncate">
                                {member.salesperson}
                              </span>
                              <span className="text-gray-500 truncate">
                                {member.designation || "-"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-400">
                          No sales team assigned to this region yet.
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                      {periodLabel && (
                        <p className="text-xs text-gray-400 mb-2">
                          Latest period: {periodLabel}
                        </p>
                      )}
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Monthly Sales:</span>
                        <span className="font-medium text-gray-900">
                          Rs {((regionObj.monthlySales || 0) / 1000).toFixed(0)}
                          K
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Target:</span>
                        <span className="font-medium text-gray-900">
                          Rs {((regionObj.target || 0) / 1000).toFixed(0)}K
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Achievement:</span>
                        <span
                          className={`font-bold ${
                            achievement === null
                              ? "text-gray-400"
                              : getStatusColor(achievement)
                          }`}
                        >
                          {achievement === null ? "-" : `${achievement}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
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
