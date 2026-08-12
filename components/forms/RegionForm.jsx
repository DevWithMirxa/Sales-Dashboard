"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import api from "@/lib/api";

export default function RegionForm({ onClose, initialData, onSuccess }) {
  const [formData, setFormData] = useState({
    region: "Lahore",
  });
  const [customRegionName, setCustomRegionName] = useState("");
  const [showCustomRegion, setShowCustomRegion] = useState(false);
  const [loading, setLoading] = useState(false);

  const regions = [
    "Lahore",
    "Rawalpindi/Islamabad",
    "Kamalia/Samundari",
    "Sahiwal",
    "Multan",
    "Karachi",
  ];

  useEffect(() => {
    if (initialData) {
      const selectedRegion = initialData.region || "Lahore";
      const isKnownRegion = regions.includes(selectedRegion);

      setFormData({
        region: selectedRegion,
      });
      setCustomRegionName(isKnownRegion ? "" : selectedRegion);
      setShowCustomRegion(!isKnownRegion && !!selectedRegion);
    } else {
      setFormData({ region: "Lahore" });
      setCustomRegionName("");
      setShowCustomRegion(false);
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setShowCustomRegion(false);
    setCustomRegionName("");
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomRegionNameChange = (e) => {
    const value = e.target.value;
    setCustomRegionName(value);
    setFormData((prev) => ({ ...prev, region: value }));
  };

  const toggleCustomRegion = () => {
    setShowCustomRegion((prev) => {
      const nextValue = !prev;

      if (!nextValue) {
        setCustomRegionName("");
        setFormData((current) => ({ ...current, region: "Lahore" }));
      } else {
        const savedRegion =
          formData.region && !regions.includes(formData.region)
            ? formData.region
            : "";
        setCustomRegionName(savedRegion);
        setFormData((current) => ({ ...current, region: savedRegion }));
      }

      return nextValue;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedRegion = formData.region.trim();

    if (!trimmedRegion) {
      alert("Please select a region or enter a new region name");
      return;
    }

    setLoading(true);
    try {
      const payload = { region: trimmedRegion };

      if (initialData && initialData._id) {
        await api.put(`/regions/${initialData._id}`, payload);
      } else {
        await api.post("/regions", payload);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving region:", error);
      alert("Failed to save region");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Region</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Region
            </label>

            {!showCustomRegion && (
              <div className="space-y-3">
                {regions.map((region) => (
                  <label
                    key={region}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="region"
                      value={region}
                      checked={formData.region === region}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{region}</span>
                  </label>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={toggleCustomRegion}
              className="mt-3 w-full px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors"
            >
              {showCustomRegion ? "Use Existing Region" : "New Region"}
            </button>

            {showCustomRegion && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Region Name
                </label>
                <input
                  type="text"
                  value={customRegionName}
                  onChange={handleCustomRegionNameChange}
                  placeholder="Enter new region name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Region"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
