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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  invoiceDate: todayISO(),
  dueDate: "",
  salesperson: "",
  customer: "",
  region: "",
  invoiceNumber: "",
  invoiceAmount: "",
  amountRecovered: "",
  recoveryDate: "",
  notes: "",
});

// Mirrors computeDerivedFields() in recoveryController.js, so the form shows
// the same Balance/Status the backend will actually compute - this is a
// preview only, never sent to the server.
const computePreview = (formData) => {
  const invoiceAmount = Number(formData.invoiceAmount) || 0;
  const amountRecovered = Number(formData.amountRecovered) || 0;
  const balance = Math.max(0, invoiceAmount - amountRecovered);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let dueDate = formData.dueDate ? new Date(formData.dueDate) : null;
  if (dueDate) dueDate.setHours(0, 0, 0, 0);

  const isPastDue = balance > 0 && dueDate && today > dueDate;
  const daysOverdue = isPastDue
    ? Math.round((today - dueDate) / (1000 * 60 * 60 * 24))
    : 0;

  let status;
  if (!formData.dueDate) {
    status = null;
  } else if (balance === 0) {
    status = "Paid";
  } else if (amountRecovered > 0) {
    status = "Partial";
  } else if (isPastDue) {
    status = "Overdue";
  } else {
    status = "Pending";
  }

  return { balance, daysOverdue, status };
};

const STATUS_STYLES = {
  Paid: "bg-success-soft text-success-soft-foreground hover:bg-success-soft",
  Partial: "bg-warning-soft text-warning-soft-foreground hover:bg-warning-soft",
  Overdue:
    "bg-destructive-soft text-destructive-soft-foreground hover:bg-destructive-soft",
  Pending: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export default function RecoveryForm({ onClose, initialData, onSuccess }) {
  const isEdit = Boolean(initialData?._id);
  const [formData, setFormData] = useState(emptyForm());
  const [options, setOptions] = useState({
    salesmen: [],
    customers: [],
    regions: [],
  });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoadingOptions(true);
        const res = await api.get("/recovery/form-options");
        setOptions({
          salesmen: res.data.salesmen || [],
          customers: res.data.customers || [],
          regions: res.data.regions || [],
        });
      } catch (error) {
        console.error("Error fetching recovery form options:", error);
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        invoiceDate: initialData.invoiceDate
          ? String(initialData.invoiceDate).slice(0, 10)
          : todayISO(),
        dueDate: initialData.dueDate
          ? String(initialData.dueDate).slice(0, 10)
          : "",
        salesperson: initialData.salesperson || "",
        customer: initialData.customer || "",
        region: initialData.region || "",
        invoiceNumber: initialData.invoiceNumber || "",
        invoiceAmount: initialData.invoiceAmount ?? "",
        amountRecovered: initialData.amountRecovered ?? "",
        recoveryDate: initialData.recoveryDate
          ? String(initialData.recoveryDate).slice(0, 10)
          : "",
        notes: initialData.notes || "",
      });
    }
  }, [initialData]);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // Auto-fill region from the selected salesman's region, only if the
  // region field hasn't already been set.
  const handleSalesmanChange = (name) => {
    const match = options.salesmen.find((s) => s.name === name);
    setFormData((prev) => ({
      ...prev,
      salesperson: name,
      region: prev.region || match?.region || prev.region,
    }));
  };

  const validate = () => {
    const nextErrors = {};
    [
      "invoiceDate",
      "dueDate",
      "salesperson",
      "customer",
      "region",
      "invoiceNumber",
    ].forEach((k) => {
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
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate,
        salesperson: formData.salesperson,
        customer: formData.customer,
        region: formData.region,
        invoiceNumber: formData.invoiceNumber,
        invoiceAmount: Number(formData.invoiceAmount) || 0,
        amountRecovered: Number(formData.amountRecovered) || 0,
        recoveryDate: formData.recoveryDate || null,
        notes: formData.notes,
      };

      if (isEdit) {
        await api.put(`/recovery/${initialData._id}`, payload);
      } else {
        await api.post("/recovery", payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving recovery record:", error);
      setFormError(
        error?.response?.data?.message ||
          "Unable to save this recovery record. Please check the fields and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const preview = computePreview(formData);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit" : "Add New"} Recovery Record
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the invoice/recovery details below and save your changes."
              : "Fill in the details below to record a new invoice for recovery tracking."}
          </DialogDescription>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading options...
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="salesperson">
                  Salesperson<span className="text-destructive ml-0.5">*</span>
                </Label>
                <Select
                  value={formData.salesperson || ""}
                  onValueChange={handleSalesmanChange}
                >
                  <SelectTrigger id="salesperson">
                    <SelectValue placeholder="Select salesperson" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.salesmen.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.salesperson && (
                  <p className="text-xs text-destructive">
                    {errors.salesperson}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="customer">
                  Customer<span className="text-destructive ml-0.5">*</span>
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
                  <p className="text-xs text-destructive">{errors.customer}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="region">
                  Region<span className="text-destructive ml-0.5">*</span>
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
                  <p className="text-xs text-destructive">{errors.region}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invoiceNumber">
                  Invoice #<span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  id="invoiceNumber"
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) =>
                    handleChange("invoiceNumber", e.target.value)
                  }
                  placeholder="e.g. INV-2026-0451"
                />
                {errors.invoiceNumber && (
                  <p className="text-xs text-destructive">
                    {errors.invoiceNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="invoiceDate">
                  Invoice Date<span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => handleChange("invoiceDate", e.target.value)}
                />
                {errors.invoiceDate && (
                  <p className="text-xs text-destructive">
                    {errors.invoiceDate}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dueDate">
                  Due Date<span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleChange("dueDate", e.target.value)}
                />
                {errors.dueDate && (
                  <p className="text-xs text-destructive">{errors.dueDate}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="recoveryDate">Recovery Date</Label>
                <Input
                  id="recoveryDate"
                  type="date"
                  value={formData.recoveryDate}
                  onChange={(e) => handleChange("recoveryDate", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank until payment is received.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="invoiceAmount">Invoice Amount (Rs)</Label>
                <Input
                  id="invoiceAmount"
                  type="number"
                  min="0"
                  value={formData.invoiceAmount}
                  onChange={(e) =>
                    handleChange("invoiceAmount", e.target.value)
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amountRecovered">Amount Recovered (Rs)</Label>
                <Input
                  id="amountRecovered"
                  type="number"
                  min="0"
                  value={formData.amountRecovered}
                  onChange={(e) =>
                    handleChange("amountRecovered", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Live preview of the auto-calculated fields - never submitted,
                just mirrors what the backend will compute. */}
            <div className="rounded-md border border-border bg-muted/50 p-3 flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Balance:{" "}
                <span className="font-semibold text-foreground">
                  Rs {preview.balance.toLocaleString()}
                </span>
              </span>
              {preview.daysOverdue > 0 && (
                <span className="text-muted-foreground">
                  Days Overdue:{" "}
                  <span className="font-semibold text-destructive">
                    {preview.daysOverdue}
                  </span>
                </span>
              )}
              {preview.status && (
                <Badge className={STATUS_STYLES[preview.status]}>
                  {preview.status}
                </Badge>
              )}
              {!preview.status && (
                <span className="text-xs text-muted-foreground">
                  Set a Due Date to see the calculated status
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={2}
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Optional notes about this invoice or recovery"
              />
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
                {isEdit ? "Save Changes" : "Add Recovery Record"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
