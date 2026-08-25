"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
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
  const isEdit = Boolean(initialData?._id);

  // Pre-fill from an existing product, detecting whether the name is one of
  // the known options or a custom name (older records).
  const buildInitial = () => {
    const name = initialData?.name || "";
    const known = productOptions.includes(name);
    return {
      name,
      pricePerKg: initialData?.pricePerKg ?? "",
      packingKg: initialData?.packingKg ?? "",
      customProductName: known ? "" : name,
      showCustomProduct: !known && !!name,
    };
  };

  const [initial] = useState(buildInitial);
  const [formData, setFormData] = useState({
    name: initial.name,
    pricePerKg: initial.pricePerKg,
    packingKg: initial.packingKg,
    origin: initialData?.origin ?? "",
    supplier: initialData?.supplier ?? "",
  });
  const [customProductName, setCustomProductName] = useState(
    initial.customProductName,
  );
  const [showCustomProduct, setShowCustomProduct] = useState(
    initial.showCustomProduct,
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleProductSelect = (value) => {
    setShowCustomProduct(false);
    setCustomProductName("");
    setFormData((prev) => ({ ...prev, name: value }));
  };

  const handleCustomNameChange = (e) => {
    const value = e.target.value;
    setCustomProductName(value);
    setFormData((prev) => ({ ...prev, name: value }));
  };

  const toggleCustomProduct = () => {
    setShowCustomProduct((prev) => {
      const next = !prev;
      if (!next) {
        setCustomProductName("");
        setFormData((cur) => ({ ...cur, name: "" }));
      } else {
        const saved =
          formData.name && !productOptions.includes(formData.name)
            ? formData.name
            : "";
        setCustomProductName(saved);
        setFormData((cur) => ({ ...cur, name: saved }));
      }
      return next;
    });
  };

  const validate = () => {
    const nextErrors = {};
    if (!String(formData.name || "").trim()) {
      nextErrors.name = "Product name is required";
    }
    if (formData.pricePerKg === "" || formData.pricePerKg === null) {
      nextErrors.pricePerKg = "Price is required";
    }
    if (formData.packingKg === "" || formData.packingKg === null) {
      nextErrors.packingKg = "Packing size is required";
    }
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
        name: formData.name.trim(),
        pricePerKg: Number(formData.pricePerKg),
        packingKg: Number(formData.packingKg),
        origin: formData.origin?.trim() || null,
        supplier: formData.supplier?.trim() || null,
      };
      if (isEdit) {
        await api.put(`/products/${initialData._id}`, payload);
      } else {
        await api.post("/products", payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
      setFormError(
        err?.response?.data?.message ||
          "Unable to save this product. Please check the fields and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add New"} Product</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the product details below and save your changes."
              : "Fill in the details below to add a new product."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">
                Product Name
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              {showCustomProduct ? (
                <Input
                  id="name"
                  value={customProductName}
                  onChange={handleCustomNameChange}
                  placeholder="Enter new product name"
                />
              ) : (
                <Select
                  value={formData.name || ""}
                  onValueChange={handleProductSelect}
                >
                  <SelectTrigger id="name">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((productName) => (
                      <SelectItem key={productName} value={productName}>
                        {productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleCustomProduct}
              >
                {showCustomProduct ? "Use Existing Product" : "New Product"}
              </Button>
              {errors.name && (
                <p className="text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pricePerKg">
                Price (Rs/Kg)
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                id="pricePerKg"
                type="number"
                step="0.01"
                name="pricePerKg"
                value={formData.pricePerKg}
                onChange={handleChange}
                placeholder="Enter price per kg"
              />
              {errors.pricePerKg && (
                <p className="text-xs text-red-600">{errors.pricePerKg}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="packingKg">
                Packing (Kg)
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                id="packingKg"
                type="number"
                step="0.1"
                name="packingKg"
                value={formData.packingKg}
                onChange={handleChange}
                placeholder="Enter packing size in kg"
              />
              {errors.packingKg && (
                <p className="text-xs text-red-600">{errors.packingKg}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="origin">Origin</Label>
              <Input
                id="origin"
                name="origin"
                value={formData.origin || ""}
                onChange={handleChange}
                placeholder="Enter country / origin"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                name="supplier"
                value={formData.supplier || ""}
                onChange={handleChange}
                placeholder="Enter supplier name"
              />
            </div>
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
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
