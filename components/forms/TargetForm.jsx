"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import api from "@/lib/api";

const PERIODS = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"];
const STATUSES = ["active", "inactive", "completed"];

const buildFormData = (editingTarget) => {
  if (!editingTarget) {
    return {
      targetName: "",
      period: "Monthly",
      assignedTo: "",
      region: "",
      status: "active",
      products: [],
    };
  }

  return {
    targetName: editingTarget.targetName || "",
    period: editingTarget.period || "Monthly",
    assignedTo: editingTarget.assignedTo?._id || editingTarget.assignedTo || "",
    region: editingTarget.region || editingTarget.assignedTo?.area || "",
    status: editingTarget.status || "active",
    products: (editingTarget.products || []).map((p) => ({
      productId: p.product?._id || p.product,
      name: p.product?.name || "",
      targetQuantity: p.targetQuantity ?? "",
      targetRevenue: p.targetRevenue ?? "",
      unit: p.unit || "kg",
    })),
  };
};

export default function TargetForm({ onClose, editingTarget, onSuccess }) {
  const [formData, setFormData] = useState(buildFormData(editingTarget));
  const [salesmen, setSalesmen] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);

  const [productForm, setProductForm] = useState({
    productId: "",
    targetQuantity: "",
    targetRevenue: "",
    unit: "kg",
  });

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoadingOptions(true);
        const [salesmenRes, productsRes] = await Promise.all([
          api.get("/salesmen"),
          api.get("/products"),
        ]);
        setSalesmen(salesmenRes.data.data || salesmenRes.data || []);
        setProducts(productsRes.data.data || productsRes.data || []);
      } catch (error) {
        console.error("Error loading salesmen/products:", error);
      } finally {
        setLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (editingTarget) {
      setFormData(buildFormData(editingTarget));
    }
  }, [editingTarget]);

  const selectedSalesman = salesmen.find((s) => s._id === formData.assignedTo);
  const selectedProduct = products.find((p) => p._id === productForm.productId);

  const handleSalesmanChange = (e) => {
    const assignedTo = e.target.value;
    const salesman = salesmen.find((s) => s._id === assignedTo);
    setFormData((prev) => ({
      ...prev,
      assignedTo,
      // auto-fill region from the salesman's area, but the user can still edit it below
      region: salesman?.area || prev.region,
    }));
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProductChange = (e) => {
    const { name, value } = e.target;
    setProductForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddProduct = (e) => {
    e.preventDefault();
    if (!productForm.productId || !productForm.targetQuantity) {
      alert("Please select a product and enter a target quantity");
      return;
    }

    const product = products.find((p) => p._id === productForm.productId);
    if (!product) return;

    const productExists = formData.products.some(
      (p) => p.productId === product._id,
    );
    if (productExists) {
      alert("This product is already added");
      return;
    }

    const quantity = parseFloat(productForm.targetQuantity) || 0;
    // Auto-calculate revenue from the product's price if the user left it blank
    const revenue = productForm.targetRevenue
      ? parseFloat(productForm.targetRevenue)
      : quantity * (product.price || 0);

    const newProduct = {
      productId: product._id,
      name: product.name,
      targetQuantity: quantity,
      targetRevenue: revenue,
      unit: productForm.unit,
    };

    setFormData((prev) => ({
      ...prev,
      products: [...prev.products, newProduct],
    }));

    setProductForm({
      productId: "",
      targetQuantity: "",
      targetRevenue: "",
      unit: "kg",
    });
  };

  const handleRemoveProduct = (productId) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.productId !== productId),
    }));
  };

  const calculateTotalRevenue = () =>
    formData.products.reduce(
      (sum, p) => sum + (Number(p.targetRevenue) || 0),
      0,
    );
  const calculateTotalQuantity = () =>
    formData.products.reduce(
      (sum, p) => sum + (Number(p.targetQuantity) || 0),
      0,
    );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.assignedTo) {
      alert("Please select a salesman");
      return;
    }
    if (formData.products.length === 0) {
      alert("Please add at least one product");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        targetName: formData.targetName.trim(),
        period: formData.period,
        assignedTo: formData.assignedTo,
        region: formData.region.trim(),
        status: formData.status,
        products: formData.products.map((p) => ({
          product: p.productId,
          targetQuantity: Number(p.targetQuantity) || 0,
          targetRevenue: Number(p.targetRevenue) || 0,
          unit: p.unit,
        })),
      };

      if (editingTarget && editingTarget._id) {
        await api.put(`/targets/${editingTarget._id}`, payload);
      } else {
        await api.post("/targets", payload);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving target:", error);
      const message = error.response?.data?.message || "Failed to save target";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {editingTarget ? "Edit Target Assignment" : "Assign Sales Target"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {loadingOptions ? (
          <div className="p-12 text-center text-gray-500">
            Loading salesmen &amp; products...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Target Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Target Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Name (optional)
                  </label>
                  <input
                    type="text"
                    name="targetName"
                    value={formData.targetName}
                    onChange={handleFieldChange}
                    placeholder="e.g. Q1 Feed Push"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period
                  </label>
                  <select
                    name="period"
                    value={formData.period}
                    onChange={handleFieldChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PERIODS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Salesman Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Select Salesman
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Salesman
                    </label>
                    <select
                      value={formData.assignedTo}
                      onChange={handleSalesmanChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a salesman</option>
                      {salesmen.map((salesman) => (
                        <option key={salesman._id} value={salesman._id}>
                          {salesman.name}{" "}
                          {salesman.area ? `- ${salesman.area}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Region
                    </label>
                    <input
                      type="text"
                      name="region"
                      value={formData.region}
                      onChange={handleFieldChange}
                      placeholder="Auto-filled from salesman, editable"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {selectedSalesman && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Selected Salesman
                    </h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <strong>Name:</strong> {selectedSalesman.name}
                      </p>
                      <p>
                        <strong>Area:</strong> {selectedSalesman.area || "-"}
                      </p>
                      <p>
                        <strong>Designation:</strong>{" "}
                        {selectedSalesman.designation || "-"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Products Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Assign Products &amp; Targets
              </h3>
              <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
                {/* Product Input Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product
                    </label>
                    <select
                      name="productId"
                      value={productForm.productId}
                      onChange={handleProductChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a product</option>
                      {products.map((product) => {
                        const isAdded = formData.products.some(
                          (p) => p.productId === product._id,
                        );
                        return (
                          <option
                            key={product._id}
                            value={product._id}
                            disabled={isAdded}
                          >
                            {product.name} {isAdded ? "(Already Added)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Quantity ({productForm.unit})
                      </label>
                      <input
                        type="number"
                        name="targetQuantity"
                        value={productForm.targetQuantity}
                        onChange={handleProductChange}
                        placeholder="Enter quantity"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit
                      </label>
                      <select
                        name="unit"
                        value={productForm.unit}
                        onChange={handleProductChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option>kg</option>
                        <option>bags</option>
                        <option>tons</option>
                        <option>units</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Revenue (Rs)
                      </label>
                      <input
                        type="number"
                        name="targetRevenue"
                        value={productForm.targetRevenue}
                        onChange={handleProductChange}
                        placeholder="Auto-calculated if blank"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {selectedProduct && (
                        <p className="text-xs text-gray-500 mt-1">
                          List price: Rs.{" "}
                          {(selectedProduct.price || 0).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Add Product to Target
                  </button>
                </div>

                {/* Added Products List */}
                {formData.products.length > 0 && (
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Added Products
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {formData.products.map((product) => (
                        <div
                          key={product.productId}
                          className="flex items-center justify-between bg-white p-3 border border-gray-200 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {product.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              Qty: {product.targetQuantity} {product.unit} |
                              Revenue: Rs.{" "}
                              {Number(product.targetRevenue).toLocaleString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveProduct(product.productId)
                            }
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Summary */}
                    <div className="mt-4 pt-4 border-t border-gray-200 bg-blue-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-gray-600">
                            Total Products: {formData.products.length}
                          </p>
                          <p className="text-sm text-gray-600">
                            Total Quantity: {calculateTotalQuantity()}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-blue-600">
                          Total Revenue: Rs.{" "}
                          {calculateTotalRevenue().toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleFieldChange}
                className="w-full sm:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : editingTarget
                    ? "Update Target"
                    : "Assign Target"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
