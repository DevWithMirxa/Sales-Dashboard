"use client";

import React, { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const todayISO = () => new Date().toISOString().slice(0, 10);

const UNITS = ["bags", "Kg", "tons", "units"];

const emptyForm = () => ({
  salesman: "",
  product: "",
  customer: "",
  region: "",
  quantity: "",
  unit: "bags",
  rate: "",
  totalAmount: "",
  saleDate: todayISO(),
  notes: "",
});

export default function SaleForm({ onClose, initialData, onSuccess }) {
  const isEdit = Boolean(initialData?._id);
  const [formData, setFormData] = useState(emptyForm());
  const [options, setOptions] = useState({
    salesmen: [],
    products: [],
    customers: [],
    regions: [],
  });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  // Load the merged dropdown data once when the dialog opens.
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoadingOptions(true);
        const res = await api.get("/sales/form-options");
        setOptions({
          salesmen: res.data.salesmen || [],
          products: res.data.products || [],
          customers: res.data.customers || [],
          regions: res.data.regions || [],
        });
      } catch (error) {
        console.error("Error fetching sale form options:", error);
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  // Pre-fill the form when editing an existing sale.
  useEffect(() => {
    if (initialData) {
      setFormData({
        salesman: initialData.salesman || "",
        product: initialData.product || "",
        customer: initialData.customer || "",
        region: initialData.region || "",
        quantity: initialData.quantity ?? "",
        unit: initialData.unit || "bags",
        rate: initialData.rate ?? "",
        totalAmount: initialData.totalAmount ?? "",
        saleDate: initialData.saleDate
          ? String(initialData.saleDate).slice(0, 10)
          : todayISO(),
        notes: initialData.notes || "",
      });
    }
  }, [initialData]);

  // Keep totalAmount in sync with quantity * rate. The user can still
  // override it manually afterwards - it just gets recalculated the next
  // time quantity or rate changes.
  useEffect(() => {
    const qty = Number(formData.quantity) || 0;
    const rate = Number(formData.rate) || 0;
    if (qty && rate) {
      setFormData((prev) => ({ ...prev, totalAmount: qty * rate }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.quantity, formData.rate]);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // Auto-fill region from the selected salesman's region, only if the
  // region field hasn't already been set by the user.
  const handleSalesmanChange = (name) => {
    const match = options.salesmen.find((s) => s.name === name);
    setFormData((prev) => ({
      ...prev,
      salesman: name,
      region: prev.region || match?.region || prev.region,
    }));
  };

  const validate = () => {
    const nextErrors = {};
    ["salesman", "product", "customer", "region"].forEach((k) => {
      if (!String(formData[k] || "").trim()) {
        nextErrors[k] = "This field is required";
      }
    });
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
        salesman: formData.salesman,
        product: formData.product,
        customer: formData.customer,
        region: formData.region,
        quantity: Number(formData.quantity) || 0,
        unit: formData.unit,
        rate: Number(formData.rate) || 0,
        totalAmount:
          formData.totalAmount === ""
            ? undefined
            : Number(formData.totalAmount),
        saleDate: formData.saleDate,
        notes: formData.notes,
      };

      if (isEdit) {
        await api.put(`/sales/${initialData._id}`, payload);
      } else {
        await api.post("/sales", payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving sale:", error);
      setFormError(
        error?.response?.data?.message ||
          "Unable to save this sale. Please check the fields and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add New"} Sale</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the sale details below and save your changes."
              : "Fill in the details below to record a new sale."}
          </DialogDescription>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-500">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading options...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="salesman">
                  Salesman<span className="text-red-500 ml-0.5">*</span>
                </Label>
                <Select
                  value={formData.salesman || ""}
                  onValueChange={handleSalesmanChange}
                >
                  <SelectTrigger id="salesman">
                    <SelectValue placeholder="Select salesman" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.salesmen.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name}
                        {s.designation ? ` (${s.designation})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.salesman && (
                  <p className="text-xs text-red-600">{errors.salesman}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product">
                  Product<span className="text-red-500 ml-0.5">*</span>
                </Label>
                <Select
                  value={formData.product || ""}
                  onValueChange={(v) => handleChange("product", v)}
                >
                  <SelectTrigger id="product">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.products.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.product && (
                  <p className="text-xs text-red-600">{errors.product}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="customer">
                  Customer<span className="text-red-500 ml-0.5">*</span>
                </Label>
                <Select
                  value={formData.customer || ""}
                  onValueChange={(v) => handleChange("customer", v)}
                >
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.customers.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customer && (
                  <p className="text-xs text-red-600">{errors.customer}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="region">
                  Region<span className="text-red-500 ml-0.5">*</span>
                </Label>
                <Select
                  value={formData.region || ""}
                  onValueChange={(v) => handleChange("region", v)}
                >
                  <SelectTrigger id="region">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.regions.map((r) => (
                      <SelectItem key={r.name} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.region && (
                  <p className="text-xs text-red-600">{errors.region}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  name="quantity"
                  value={formData.quantity}
                  onChange={(e) => handleChange("quantity", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(v) => handleChange("unit", v)}
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
                <Label htmlFor="rate">Rate</Label>
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  name="rate"
                  value={formData.rate}
                  onChange={(e) => handleChange("rate", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="totalAmount">Total Amount</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  min="0"
                  name="totalAmount"
                  value={formData.totalAmount}
                  onChange={(e) => handleChange("totalAmount", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="saleDate">Sale Date</Label>
                <Input
                  id="saleDate"
                  type="date"
                  name="saleDate"
                  value={formData.saleDate}
                  onChange={(e) => handleChange("saleDate", e.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Optional notes about this sale"
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
                {submitting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {isEdit ? "Save Changes" : "Add Sale"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
