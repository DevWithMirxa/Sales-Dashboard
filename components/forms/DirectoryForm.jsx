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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Field definitions mirror the columns shown in the Feed Mills table.
const FEED_MILL_FIELDS = [
  { name: "feedMillName", label: "Feed Mill Name", required: true },
  { name: "millOwner", label: "Mill Owner" },
  { name: "districtRegion", label: "District / Region" },
  { name: "millAddress", label: "Mill Address", type: "textarea" },
  { name: "officeAddress", label: "Office Address", type: "textarea" },
  { name: "millPhones", label: "Mill Phone(s)" },
  { name: "officePhones", label: "Office Phone(s)" },
  { name: "email", label: "Email", type: "email" },
  { name: "productionCapacity", label: "Production Capacity" },
  { name: "bagsPerMonth", label: "Bags / Month" },
];

/**
 * Add/Edit dialog for the Business Directory's Feed Mills.
 * (Sales Team used to be managed here too, but that's now handled on the
 * Salesmen page instead, so this only deals with feed mills.)
 *
 * Props:
 * - initialData: existing record when editing, undefined when adding
 * - onClose(): closes the dialog without saving
 * - onSuccess(): called after a successful create/update so the parent can refetch
 */
export default function DirectoryForm({ initialData, onClose, onSuccess }) {
  const isEdit = Boolean(initialData && (initialData._id || initialData.id));
  const fields = FEED_MILL_FIELDS;
  const baseUrl = "/directory/feed-mills";

  const buildInitialState = () =>
    fields.reduce((acc, f) => {
      acc[f.name] = initialData?.[f.name] ?? "";
      return acc;
    }, {});

  const [formData, setFormData] = useState(buildInitialState);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    fields.forEach((f) => {
      if (f.required && !String(formData[f.name] || "").trim()) {
        nextErrors[f.name] = `${f.label} is required`;
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
      if (isEdit) {
        const id = initialData._id || initialData.id;
        await api.put(`${baseUrl}/${id}`, formData);
      } else {
        await api.post(baseUrl, formData);
      }
      onSuccess();
    } catch (err) {
      console.error("Save failed:", err);
      setFormError(
        err?.response?.data?.message ||
          "Unable to save this record. Please check the fields and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add New"} Feed Mill</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details below and save your changes."
              : "Fill in the details below to add a new record to the directory."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div
                key={f.name}
                className={cn(
                  "space-y-1.5",
                  f.type === "textarea" && "sm:col-span-2",
                )}
              >
                <Label htmlFor={f.name}>
                  {f.label}
                  {f.required && <span className="text-red-500 ml-0.5">*</span>}
                </Label>

                {f.type === "textarea" ? (
                  <Textarea
                    id={f.name}
                    value={formData[f.name]}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                    rows={2}
                  />
                ) : (
                  <Input
                    id={f.name}
                    type={f.type || "text"}
                    value={formData[f.name]}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                  />
                )}

                {errors[f.name] && (
                  <p className="text-xs text-red-600">{errors[f.name]}</p>
                )}
              </div>
            ))}
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
              {isEdit ? "Save Changes" : "Add Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
