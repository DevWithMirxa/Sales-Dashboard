"use client";

import React, { useState, useEffect } from "react";
import { Filter } from "lucide-react";
import api from "@/lib/api";

export default function FilterBar({
  onFilterChange,
  onBreakdownChange,
  breakdown,
}) {
  const [region, setRegion] = useState("all");
  const [product, setProduct] = useState("all");
  const [salesperson, setSalesperson] = useState("all");

  // Breakdown/Duration are controlled by the Dashboard (via the `breakdown`
  // prop) so their selections survive re-renders and page refreshes.
  const [years, setYears] = useState([]);

  // Region / Product / Salesperson are intentionally limited to "All" (these
  // scopes are shown as charts on the dashboard, not as single-select filters).

  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const trendsRes = await api.get("/trends/filters");
        const data = trendsRes.data || {};
        setYears((data.years || []).slice().sort());
      } catch (error) {
        console.error("Error fetching filter data:", error);
      }
    };

    fetchFilterData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newState = {
      region,
      product,
      salesperson,
    };
    newState[name] = value;
    if (name === "region") setRegion(value);
    else if (name === "product") setProduct(value);
    else if (name === "salesperson") setSalesperson(value);

    onFilterChange(newState);
  };

  const handleBreakdownChange = (e) => {
    const { name, value } = e.target;
    // Map the "breakdown" control to the "granularity" field the dashboard
    // expects. The selects are controlled by the `breakdown` prop, so we read
    // the other value from it (this is why changing one never drops the other).
    const current = breakdown || { granularity: "month", year: "all" };
    if (name === "breakdown") {
      onBreakdownChange({ granularity: value, year: current.year });
    } else if (name === "breakdownYear") {
      onBreakdownChange({ granularity: current.granularity, year: value });
    }
  };

  const handleClear = () => {
    setRegion("all");
    setProduct("all");
    setSalesperson("all");
    onFilterChange({
      region: "all",
      product: "all",
      salesperson: "all",
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
      {/* Region Filter */}
      <div className="flex-1 min-w-16">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Region
        </label>
        <select
          name="region"
          value={region}
          onChange={handleChange}
          className="w-full text-sm px-1 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option className="text-sm" value="all">
            All Regions
          </option>
        </select>
      </div>

      {/* Product Filter */}
      <div className="flex-1 min-w-16">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Product
        </label>
        <select
          name="product"
          value={product}
          onChange={handleChange}
          className="w-full px-1 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option className="text-sm" value="all">
            All Products
          </option>
        </select>
      </div>

      {/* Salesperson Filter */}
      <div className="flex-1 min-w-16">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Salesperson
        </label>
        <select
          name="salesperson"
          value={salesperson}
          onChange={handleChange}
          className="w-full px-1 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option className="text-sm" value="all">
            All Salespeople
          </option>
        </select>
      </div>

      {/* Breakdown Filter (Monthly / Quarterly / Yearly) */}
      <div className="flex-1 min-w-16">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Breakdown
        </label>
        <select
          name="breakdown"
          value={breakdown?.granularity || "month"}
          onChange={handleBreakdownChange}
          className="w-full px-1 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option className="text-sm" value="month">
            Monthly
          </option>
          <option className="text-sm" value="quarter">
            Quarterly
          </option>
          <option className="text-sm" value="year">
            Yearly
          </option>
        </select>
      </div>

      {/* Duration Filter (All / 2024 / 2025 / 2026) */}
      <div className="flex-1 min-w-16">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Duration
        </label>
        <select
          name="breakdownYear"
          value={breakdown?.year || "all"}
          onChange={handleBreakdownChange}
          className="w-full px-1 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option className="text-sm" value="all">
            All
          </option>
          {years.map((y) => (
            <option className="text-sm" key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters Button */}
      <button
        onClick={handleClear}
        className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors text-xs"
      >
        Clear
      </button>
    </div>
  );
}
