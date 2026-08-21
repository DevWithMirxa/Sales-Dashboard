"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import SalesPersonForm from "@/components/forms/SalesPersonForm";
import RegionForm from "@/components/forms/RegionForm";
import ProductForm from "@/components/forms/ProductForm";
import DashboardLayout from "@/components/DashboardLayout";

export default function FormsPortal() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [activeForm, setActiveForm] = useState(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  if (!user) {
    return null;
  }

  const closeForm = () => setActiveForm(null);

  return (
    <DashboardLayout>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Forms Portal</h1>
          <p className="text-sm text-gray-600 mt-2">
            Submit data to the backend system.
          </p>
        </div>
        <button
          onClick={logout}
          className="text-red-500 hover:underline text-xs font-semibold"
        >
          Logout
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Render forms cards */}
        <div
          className="bg-white p-6 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition"
          onClick={() => setActiveForm("customer")}
        >
          <h3 className="text-base font-semibold mb-2">Customers</h3>
          <p className="text-gray-500 text-sm">
            Add or edit customers in the system.
          </p>
        </div>

        <div
          className="bg-white p-6 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition"
          onClick={() => setActiveForm("salesperson")}
        >
          <h3 className="text-base font-semibold mb-2">Salesmen</h3>
          <p className="text-gray-500 text-sm">
            Add or manage sales representatives.
          </p>
        </div>

        <div
          className="bg-white p-6 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition"
          onClick={() => setActiveForm("region")}
        >
          <h3 className="text-base font-semibold mb-2">Regions</h3>
          <p className="text-gray-500 text-sm">
            Manage sales regions and territories.
          </p>
        </div>

        <div
          className="bg-white p-6 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition"
          onClick={() => setActiveForm("product")}
        >
          <h3 className="text-base font-semibold mb-2">Products</h3>
          <p className="text-gray-500 text-sm">
            Add new products and manage inventory items.
          </p>
        </div>
      </div>

      {activeForm === "customer" && <CustomerForm onClose={closeForm} />}
      {activeForm === "salesperson" && <SalesPersonForm onClose={closeForm} />}
      {activeForm === "region" && <RegionForm onClose={closeForm} />}
      {activeForm === "product" && <ProductForm onClose={closeForm} />}
      {/* Additional forms for Sales and Targets would be added here as components */}
    </DashboardLayout>
  );
}
