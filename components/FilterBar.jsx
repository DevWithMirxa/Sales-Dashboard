"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Filter } from "lucide-react";
import api from "@/lib/api";

export default function FilterBar({ onFilterChange }) {
  const [dateRange, setDateRange] = useState("M");
  const [region, setRegion] = useState("all");
  const [product, setProduct] = useState("all");
  const [salesperson, setSalesperson] = useState("all");

  const [regions, setRegions] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesmen, setSalesmen] = useState([]);

  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [regionsRes, productsRes, salesmenRes] = await Promise.all([
          api.get("/regions"),
          api.get("/products"),
          api.get("/salesmen"),
        ]);
        setRegions(regionsRes.data || []);
        setProducts(productsRes.data || []);
        setSalesmen(salesmenRes.data || []);
      } catch (error) {
        console.error("Error fetching filter data:", error);
      }
    };
    fetchFilterData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newState = {
      dateRange,
      region,
      product,
      salesperson,
    };
    newState[name] = value;
    if (name === "dateRange") setDateRange(value);
    else if (name === "region") setRegion(value);
    else if (name === "product") setProduct(value);
    else if (name === "salesperson") setSalesperson(value);

    onFilterChange(newState);
  };

  const handleClear = () => {
    setDateRange("M");
    setRegion("all");
    setProduct("all");
    setSalesperson("all");
    onFilterChange({
      dateRange: "M",
      region: "all",
      product: "all",
      salesperson: "all",
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
      {/* Date Range Filter */}
      <div className="flex-1 min-w-40">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Calendar className="w-4 h-4 inline mr-2" />
          Period
        </label>
        <select
          name="dateRange"
          value={dateRange}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="D">Daily (D)</option>
          <option value="W">Weekly (W)</option>
          <option value="M">Monthly (M)</option>
          <option value="Q">Quarterly (Q)</option>
          <option value="Y">Yearly (Y)</option>
        </select>
      </div>

      {/* Region Filter */}
      <div className="flex-1 min-w-40">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Region
        </label>
        <select
          name="region"
          value={region}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Regions</option>
          {regions.map((r) => (
            <option key={r._id} value={r.region}>
              {r.region}
            </option>
          ))}
        </select>
      </div>

      {/* Product Filter */}
      <div className="flex-1 min-w-40">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Product
        </label>
        <select
          name="product"
          value={product}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Products</option>
          {products.map((p) => (
            <option key={p._id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Salesperson Filter */}
      <div className="flex-1 min-w-40">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Salesperson
        </label>
        <select
          name="salesperson"
          value={salesperson}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Salespeople</option>
          {salesmen.map((s) => (
            <option key={s._id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters Button */}
      <button
        onClick={handleClear}
        className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
      >
        Clear
      </button>
    </div>
  );
}
