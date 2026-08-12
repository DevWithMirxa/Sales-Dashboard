"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import SalesPersonForm from "@/components/forms/SalesPersonForm";
import TanStackDataTable from "@/components/TanStackDataTable";
import { Plus, Trash2, Edit2 } from "lucide-react";
import api from "@/lib/api";

function Salesmen() {
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSalesman, setEditingSalesman] = useState(null);

  const fetchSalesmen = async () => {
    try {
      setLoading(true);
      const res = await api.get("/salesmen");
      setSalesmen(res.data);
    } catch (error) {
      console.error("Error fetching salesmen:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesmen();
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this salesman?")) {
      try {
        await api.delete(`/salesmen/${id}`);
        fetchSalesmen();
      } catch (error) {
        console.error("Error deleting salesman:", error);
        alert("Failed to delete salesman");
      }
    }
  };

  const handleEdit = (salesman) => {
    setEditingSalesman(salesman);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSalesman(null);
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ getValue }) => getValue(),
        meta: { cellClassName: "text-gray-900" },
      },
      {
        accessorKey: "designation",
        header: "Designation",
      },
      {
        accessorKey: "area",
        header: "Region",
      },
      {
        accessorKey: "contactNumber",
        header: "Mobile",
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(row.original)}
              className="text-blue-600 hover:text-blue-900"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(row.original._id)}
              className="text-red-600 hover:text-red-900"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Sales Team</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Salesman
          </button>
        </div>

        <TanStackDataTable
          columns={columns}
          data={salesmen}
          loading={loading}
          emptyMessage="No salesmen found."
          getRowId={(row) => row._id}
        />

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
              <SalesPersonForm
                onClose={handleCloseForm}
                initialData={editingSalesman}
                onSuccess={fetchSalesmen}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function SalesmenPage() {
  return (
    <ProtectedRoute>
      <Salesmen />
    </ProtectedRoute>
  );
}
