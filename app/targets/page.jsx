"use client";

import React, { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import TargetForm from "@/components/forms/TargetForm";
import TanStackDataTable from "@/components/TanStackDataTable";
import { Plus, Trash2, Edit2, Package } from "lucide-react";
import api from "@/lib/api";

function Targets() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTarget, setExpandedTarget] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const res = await api.get("/targets");
      // controller responds with { success, count, data: [...] }
      setTargets(res.data.data || []);
    } catch (error) {
      console.error("Error fetching targets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this target assignment?")) {
      try {
        await api.delete(`/targets/${id}`);
        fetchTargets();
      } catch (error) {
        console.error("Error deleting target:", error);
        alert("Failed to delete target");
      }
    }
  };

  // Removing a single product from a target means re-saving the target with
  // that product filtered out, since products live inside the Target document.
  const handleDeleteProduct = async (target, productIndex) => {
    if (
      !confirm("Are you sure you want to remove this product from the target?")
    )
      return;
    try {
      const updatedProducts = target.products
        .filter((_, i) => i !== productIndex)
        .map((p) => ({
          product: p.product?._id || p.product,
          targetQuantity: p.targetQuantity,
          targetRevenue: p.targetRevenue,
          unit: p.unit,
        }));

      if (updatedProducts.length === 0) {
        alert(
          "A target must have at least one product. Delete the whole target assignment instead.",
        );
        return;
      }

      await api.put(`/targets/${target._id}`, {
        targetName: target.targetName,
        period: target.period,
        assignedTo: target.assignedTo?._id || target.assignedTo,
        region: target.region || "",
        products: updatedProducts,
        status: target.status,
      });
      fetchTargets();
    } catch (error) {
      console.error("Error removing product from target:", error);
      alert("Failed to remove product");
    }
  };

  const handleEdit = (target) => {
    setEditingTarget(target);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTarget(null);
  };

  const calculateTotalRevenue = (products) =>
    products.reduce((sum, p) => sum + (p.targetRevenue || 0), 0);
  const calculateTotalQuantity = (products) =>
    products.reduce((sum, p) => sum + (p.targetQuantity || 0), 0);
  const getProductColumns = (target) => [
    {
      id: "productName",
      header: "Product Name",
      accessorFn: (item) => item.product?.name || "Unknown product",
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2 font-medium text-gray-900">
          <Package className="w-4 h-4 text-blue-600" />
          {getValue()}
        </div>
      ),
      meta: { cellClassName: "text-gray-900 font-medium" },
    },
    {
      accessorKey: "targetQuantity",
      header: "Target Quantity",
      cell: ({ getValue }) => (getValue() || 0).toLocaleString(),
    },
    {
      accessorKey: "targetRevenue",
      header: "Target Revenue",
      cell: ({ getValue }) => `Rs. ${(getValue() || 0).toLocaleString()}`,
      meta: { cellClassName: "font-semibold text-gray-900" },
    },
    {
      accessorKey: "unit",
      header: "Unit",
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <button
          onClick={() => handleDeleteProduct(target, row.original.__targetIndex)}
          className="text-red-600 hover:text-red-700 font-medium"
        >
          Remove
        </button>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Sales Targets</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Assign Target
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            Loading targets...
          </div>
        )}

        {/* Targets List */}
        {!loading && (
          <div className="space-y-4">
            {targets.map((target) => {
              const salesmanName = target.assignedTo?.name || "Unassigned";
              const salesmanInitial = salesmanName.charAt(0).toUpperCase();
              // region is a plain string on the target; fall back to the salesman's area if not set
              const regionLabel =
                target.region || target.assignedTo?.area || "-";

              return (
                <div
                  key={target._id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Header */}
                  <div className="border-b border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {salesmanInitial}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {salesmanName}
                              {target.targetName ? (
                                <span className="ml-2 text-sm font-normal text-gray-500">
                                  ({target.targetName})
                                </span>
                              ) : null}
                            </h3>
                            <div className="flex gap-4 text-sm text-gray-600">
                              <span>Region: {regionLabel}</span>
                              <span>{target.period}</span>
                              <span>{target.products.length} Products</span>
                              <span className="font-semibold text-blue-600">
                                Rs.{" "}
                                {(
                                  target.totalRevenue ||
                                  calculateTotalRevenue(target.products)
                                ).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(target)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(target._id)}
                          className="p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() =>
                            setExpandedTarget(
                              expandedTarget === target._id ? null : target._id,
                            )
                          }
                          className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          {expandedTarget === target._id ? "Hide" : "View"}{" "}
                          Products
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Products List - Expandable */}
                  {expandedTarget === target._id && (
                    <div className="bg-gray-50 border-t border-gray-200">
                      <TanStackDataTable
                        columns={getProductColumns(target)}
                        data={target.products.map((product, index) => ({
                          ...product,
                          __targetIndex: index,
                        }))}
                        emptyMessage="No products found for this target."
                        getRowId={(row) => row.product?._id || String(row.__targetIndex)}
                        wrapperClassName="overflow-hidden"
                      />

                      {/* Footer Summary */}
                      <div className="px-6 py-4 bg-gray-100 border-t border-gray-200 flex justify-between items-center">
                        <div className="text-sm font-semibold text-gray-900">
                          Total Quantity:{" "}
                          {(
                            target.totalQuantity ||
                            calculateTotalQuantity(target.products)
                          ).toLocaleString()}{" "}
                          {target.products[0]?.unit}
                        </div>
                        <div className="text-lg font-bold text-blue-600">
                          Total Revenue: Rs.{" "}
                          {(
                            target.totalRevenue ||
                            calculateTotalRevenue(target.products)
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && targets.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No targets assigned yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start by creating target assignments for your salesmen
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Assign First Target
            </button>
          </div>
        )}
      </div>

      {/* Target Form Modal */}
      {showForm && (
        <TargetForm
          onClose={handleCloseForm}
          editingTarget={editingTarget}
          onSuccess={fetchTargets}
        />
      )}
    </DashboardLayout>
  );
}

export default function TargetsPage() {
  return (
    <ProtectedRoute>
      <Targets />
    </ProtectedRoute>
  );
}
