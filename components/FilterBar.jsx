"use client";

import React, { useState, useEffect } from "react";
import { Filter, RotateCcw } from "lucide-react";
import api from "@/lib/api";

export default function FilterBar({
  onFilterChange,
  onBreakdownChange,
  breakdown,
}) {
  const [region, setRegion] = useState("all");
  const [product, setProduct] = useState("all");
  const [salesperson, setSalesperson] = useState("all");
  const [years, setYears] = useState([]);

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
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-end bg-card/60 border border-border/60 rounded-xl p-4 shadow-xs">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-full mb-1">
        <Filter className="w-3.5 h-3.5 text-accent" />
        <span>Filter & Scoping Controls</span>
      </div>

      {/* Region Filter */}
      <div className="flex-1 min-w-35">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Region
        </label>
        <select
          name="region"
          value={region}
          onChange={handleChange}
          className="w-full text-xs px-3 py-2 bg-secondary/70 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
        >
          <option
            value="all"
          >
            All Regions
          </option>
        </select>
      </div>

      {/* Product Filter */}
      <div className="flex-1 min-w-35">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Product
        </label>
        <select
          name="product"
          value={product}
          onChange={handleChange}
          className="w-full text-xs px-3 py-2 bg-secondary/70 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
        >
          <option
            value="all"
          >
            All Products
          </option>
        </select>
      </div>

      {/* Salesperson Filter */}
      <div className="flex-1 min-w-35">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Salesperson
        </label>
        <select
          name="salesperson"
          value={salesperson}
          onChange={handleChange}
          className="w-full text-xs px-3 py-2 bg-secondary/70 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
        >
          <option
            value="all"
          >
            All Salespeople
          </option>
        </select>
      </div>

      {/* Breakdown Filter */}
      <div className="flex-1 min-w-35">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Breakdown
        </label>
        <select
          name="breakdown"
          value={breakdown?.granularity || "month"}
          onChange={handleBreakdownChange}
          className="w-full text-xs px-3 py-2 bg-secondary/70 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
        >
          <option
            value="month"
          >
            Monthly
          </option>
          <option
            value="quarter"
          >
            Quarterly
          </option>
          <option
    
            value="year"
          >
            Yearly
          </option>
        </select>
      </div>

      {/* Duration Filter */}
      <div className="flex-1 min-w-35">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Duration (Year)
        </label>
        <select
          name="breakdownYear"
          value={breakdown?.year || "all"}
          onChange={handleBreakdownChange}
          className="w-full text-xs px-3 py-2 bg-secondary/70 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
        >
          <option
            value="all"
          >
            All Years
          </option>
          {years.map((y) => (
            <option
              key={y}
              value={String(y)}
            >
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters Button */}
      <button
        type="button"
        onClick={handleClear}
        className="flex items-center gap-1.5 px-3 py-2 bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60 rounded-lg text-xs font-medium transition-all"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Reset</span>
      </button>
    </div>
  );
}
