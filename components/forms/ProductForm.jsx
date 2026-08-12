"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import api from "@/lib/api";

const productOptions = [
  "Anavite Layer Premix",
  "Anavite Mineral Premix",
  "Anavite Vitamin Premix",
  "Betaine HCL",
  "Butifour CCB",
  "Chelatrix Breeder",
  "Chelatrix Broiler (Gran)",
  "Chelatrix Broiler (Pwd)",
  "Chelatrix Broiler Premix",
  "Chelatrix Layer",
  "Chelatrix Layer Premix",
  "Chelatrix Layer Super Plus",
  "DCP 18%",
  "DCP 18% MCP 22%",
  "Ecocell",
  "Elife",
  "Elitox",
  "Emulsifier",
  "Essention Red",
  "Feedox NE",
  "Glycin Cu",
  "Glycin Fe",
  "Glycin Mn",
  "Glycin Zn",
  "Hepzag",
  "Himix Super Elite",
  "Hydroxy Zn (58%)",
  "MCP 22%",
  "Methionine Zn",
  "Min Grow (Min Premix)",
  "Nano Se",
  "Org Cu",
  "Org. Mn",
  "Org. Zn",
  "Phytase 10000",
  "Pigments/FeSO4",
  "Pigments/Mingrow",
  "Pigments/Zymyeast",
  "Pigments/Zypmex 006",
  "Poultry Grow 250",
  "Salstop",
  "Selimpex 5%",
  "Synbio",
  "Taurine",
  "Vital Min (Min Premix)",
  "Zagribind",
  "Zagribind/Zagrisorb",
  "Zagrisorb",
  "Zagromix Min Premix",
  "Zagromix Vit Min Premix",
  "Zymyeast",
  "Zypmex 006",
  "Zypmex 008",
];

export default function ProductForm({ onClose, initialData, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    pricePerKg: "",
    packingKg: "",
  });
  const [customProductName, setCustomProductName] = useState("");
  const [showCustomProduct, setShowCustomProduct] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      const selectedName = initialData.name || "";
      const isKnownProduct = productOptions.includes(selectedName);

      setFormData({
        name: selectedName,
        pricePerKg: initialData.pricePerKg || "",
        packingKg: initialData.packingKg || "",
      });
      setCustomProductName(isKnownProduct ? "" : selectedName);
      setShowCustomProduct(!isKnownProduct && !!selectedName);
    } else {
      setFormData({
        name: "",
        pricePerKg: "",
        packingKg: "",
      });
      setCustomProductName("");
      setShowCustomProduct(false);
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProductNameChange = (e) => {
    const { value } = e.target;
    setShowCustomProduct(false);
    setCustomProductName("");
    setFormData((prev) => ({ ...prev, name: value }));
  };

  const handleCustomProductNameChange = (e) => {
    const value = e.target.value;
    setCustomProductName(value);
    setFormData((prev) => ({ ...prev, name: value }));
  };

  const toggleCustomProduct = () => {
    setShowCustomProduct((prev) => {
      const nextValue = !prev;

      if (!nextValue) {
        setCustomProductName("");
        setFormData((current) => ({ ...current, name: "" }));
      } else {
        const savedName =
          formData.name && !productOptions.includes(formData.name)
            ? formData.name
            : "";
        setCustomProductName(savedName);
        setFormData((current) => ({ ...current, name: savedName }));
      }

      return nextValue;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      alert("Please select a product or enter a new product name");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...formData, name: trimmedName };

      if (initialData && initialData._id) {
        await api.put(`/products/${initialData._id}`, payload);
      } else {
        await api.post("/products", payload);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Product</h2>
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
              Product Name
            </label>
            <select
              name="name"
              value={showCustomProduct ? "" : formData.name}
              onChange={handleProductNameChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a product</option>
              {productOptions.map((productName) => (
                <option key={productName} value={productName}>
                  {productName}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={toggleCustomProduct}
              className="mt-3 w-full px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors"
            >
              {showCustomProduct ? "Use Existing Product" : "New Product"}
            </button>

            {showCustomProduct && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Product Name
                </label>
                <input
                  type="text"
                  value={customProductName}
                  onChange={handleCustomProductNameChange}
                  placeholder="Enter new product name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price (Rs/Kg)
            </label>
            <input
              type="number"
              name="pricePerKg"
              value={formData.pricePerKg}
              onChange={handleChange}
              placeholder="Enter price per kg"
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Packing (Kg)
            </label>
            <input
              type="number"
              name="packingKg"
              value={formData.packingKg}
              onChange={handleChange}
              placeholder="Enter packing size in kg"
              step="0.1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              {loading ? "Saving..." : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
