import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function KPICard({ title, value, trend, trendUp }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex-nowrap">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {trendUp ? (
          <TrendingUp className="w-4 h-4 text-green-500" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-500" />
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
      <p
        className={`text-sm font-medium ${
          trendUp ? "text-green-600" : "text-red-600"
        }`}
      >
        {trend}
      </p>
    </div>
  );
}
