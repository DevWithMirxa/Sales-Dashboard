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

const regions = [
  "Lahore",
  "Rawalpindi/Islamabad",
  "Kamalia/Samundari",
  "Sahiwal",
  "Multan",
  "Karachi",
];

export default function RegionForm({ onClose, initialData, onSuccess }) {
  const isEdit = Boolean(initialData?._id);

  // Pre-fill from an existing region, detecting whether it's one of the
  // known options or a custom name.
  const buildInitial = () => {
    const selectedRegion = initialData?.region || "Lahore";
    const known = regions.includes(selectedRegion);
    return {
      region: known ? selectedRegion : "Lahore",
      customRegionName: known ? "" : selectedRegion,
      showCustomRegion: !known && !!selectedRegion,
    };
  };

  const [initial] = useState(buildInitial);
  const [region, setRegion] = useState(initial.region);
  const [customRegionName, setCustomRegionName] = useState(
    initial.customRegionName,
  );
  const [showCustomRegion, setShowCustomRegion] = useState(
    initial.showCustomRegion,
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const effectiveRegion = showCustomRegion ? customRegionName : region;

  const handleRegionSelect = (value) => {
    setShowCustomRegion(false);
    setCustomRegionName("");
    setRegion(value);
  };

  const handleCustomChange = (e) => {
    setCustomRegionName(e.target.value);
    setErrors((prev) => ({ ...prev, region: undefined }));
  };

  const toggleCustomRegion = () => {
    setShowCustomRegion((prev) => {
      const next = !prev;
      if (!next) setCustomRegionName("");
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    const value = effectiveRegion.trim();
    if (!value) {
      setErrors({ region: "Please select or enter a region" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = { region: value };
      if (isEdit) {
        await api.put(`/regions/${initialData._id}`, payload);
      } else {
        await api.post("/regions", payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
      setFormError(
        err?.response?.data?.message ||
          "Unable to save this region. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add New"} Region</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the region details below and save your changes."
              : "Fill in the details below to add a new region."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="region">
              Region
              <span className="text-red-500 ml-0.5">*</span>
            </Label>

            {showCustomRegion ? (
              <Input
                id="region"
                value={customRegionName}
                onChange={handleCustomChange}
                placeholder="Enter new region name"
              />
            ) : (
              <Select value={region} onValueChange={handleRegionSelect}>
                <SelectTrigger id="region">
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleCustomRegion}
            >
              {showCustomRegion ? "Use Existing Region" : "New Region"}
            </Button>

            {errors.region && (
              <p className="text-xs text-red-600">{errors.region}</p>
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
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Region"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
