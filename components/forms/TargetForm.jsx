"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIODS = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"];
const STATUSES = ["active", "inactive", "completed"];
const UNITS = ["kg", "bags", "tons", "units"];

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
  const isEdit = Boolean(editingTarget?._id);
  const [formData, setFormData] = useState(buildFormData(editingTarget));
  const [salesmen, setSalesmen] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

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

  const handleSalesmanChange = (assignedTo) => {
    const salesman = salesmen.find((s) => s._id === assignedTo);
    setFormData((prev) => ({
      ...prev,
      assignedTo,
      // auto-fill region from the salesman's area, but the user can still edit it below
      region: salesman?.area || prev.region,
    }));
    setErrors((prev) => ({ ...prev, assignedTo: undefined }));
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
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

  const validate = () => {
    const nextErrors = {};
    if (!formData.assignedTo)
      nextErrors.assignedTo = "Please select a salesman";
    if (formData.products.length === 0)
      nextErrors.products = "Please add at least one product";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
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

      if (isEdit) {
        await api.put(`/targets/${editingTarget._id}`, payload);
      } else {
        await api.post("/targets", payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving target:", error);
      setFormError(
        error?.response?.data?.message ||
          "Unable to save this target. Please check the fields and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Target Assignment" : "Assign Sales Target"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the target assignment below and save your changes."
              : "Set a sales target for a salesman and assign product-wise targets."}
          </DialogDescription>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading salesmen
            &amp; products...
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 **:data-[slot='input']:border-accent **:data-[slot='textarea']:border-accent **:data-[slot='select-trigger']:border-accent **:data-[slot='button']:bg-black **:data-[slot='button']:text-accent"
          >
            {formError && (
              <div className="rounded-md border border-destructive/20 bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="targetName">Target Name (optional)</Label>
                <Input
                  id="targetName"
                  type="text"
                  name="targetName"
                  value={formData.targetName}
                  onChange={handleFieldChange}
                  placeholder="e.g. Q1 Feed Push"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="period">Period</Label>
                <Select
                  value={formData.period}
                  onValueChange={(v) =>
                    handleFieldChange({ target: { name: "period", value: v } })
                  }
                >
                  <SelectTrigger id="period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="assignedTo">
                  Salesman<span className="text-destructive ml-0.5">*</span>
                </Label>
                <Select
                  value={formData.assignedTo || ""}
                  onValueChange={handleSalesmanChange}
                >
                  <SelectTrigger id="assignedTo">
                    <SelectValue placeholder="Select a salesman" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesmen.map((salesman) => (
                      <SelectItem key={salesman._id} value={salesman._id}>
                        {salesman.name}
                        {salesman.area ? ` - ${salesman.area}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assignedTo && (
                  <p className="text-xs text-destructive">
                    {errors.assignedTo}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  type="text"
                  name="region"
                  value={formData.region}
                  onChange={handleFieldChange}
                  placeholder="Auto-filled from salesman, editable"
                />
              </div>
            </div>

            {selectedSalesman && (
              <div className="rounded-md border border-info/20 bg-info-soft p-4 text-sm">
                <p className="mb-2 font-semibold text-foreground">
                  Selected Salesman
                </p>
                <div className="space-y-1 text-muted-foreground">
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

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) =>
                  handleFieldChange({ target: { name: "status", value: v } })
                }
              >
                <SelectTrigger
                  id="status"
                  className="w-full sm:w-48 capitalize"
                >
                  <SelectValue className="capitalize" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 rounded-md border border-border bg-muted/50 p-4">
              <Label className="text-sm font-medium">
                Assign Products &amp; Targets
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="productId">Product</Label>
                  <Select
                    value={productForm.productId || ""}
                    onValueChange={(v) =>
                      handleProductChange({
                        target: { name: "productId", value: v },
                      })
                    }
                  >
                    <SelectTrigger id="productId">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => {
                        const isAdded = formData.products.some(
                          (p) => p.productId === product._id,
                        );
                        return (
                          <SelectItem
                            key={product._id}
                            value={product._id}
                            disabled={isAdded}
                          >
                            {product.name}
                            {isAdded ? " (Already Added)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="targetQuantity">
                    Target Quantity ({productForm.unit})
                  </Label>
                  <Input
                    id="targetQuantity"
                    type="number"
                    name="targetQuantity"
                    value={productForm.targetQuantity}
                    onChange={handleProductChange}
                    placeholder="Enter quantity"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={productForm.unit}
                    onValueChange={(v) =>
                      handleProductChange({
                        target: { name: "unit", value: v },
                      })
                    }
                  >
                    <SelectTrigger id="unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u} className="capitalize">
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="targetRevenue">Target Revenue (Rs)</Label>
                  <Input
                    id="targetRevenue"
                    type="number"
                    name="targetRevenue"
                    value={productForm.targetRevenue}
                    onChange={handleProductChange}
                    placeholder="Auto-calculated if blank"
                  />
                  {selectedProduct && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      List price: Rs.{" "}
                      {(selectedProduct.price || 0).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="default"
                className="w-full"
                onClick={handleAddProduct}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Product to Target
              </Button>

              {formData.products.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <h4 className="mb-3 font-semibold text-foreground">
                    Added Products
                  </h4>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {formData.products.map((product) => (
                      <div
                        key={product.productId}
                        className="flex items-center justify-between rounded-md border border-border bg-card p-3"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {product.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Qty: {product.targetQuantity} {product.unit} |
                            Revenue: Rs.{" "}
                            {Number(product.targetRevenue).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveProduct(product.productId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-md bg-primary/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Products: {formData.products.length}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Total Quantity: {calculateTotalQuantity()}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-primary">
                        Total Revenue: Rs.{" "}
                        {calculateTotalRevenue().toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {errors.products && (
                <p className="text-xs text-destructive">{errors.products}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {isEdit ? "Save Changes" : "Save Target"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
