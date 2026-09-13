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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const emptyContact = (primary = false) => ({
  label: "",
  number: "",
  primary,
});

// Backward compatibility: older records only had a single `contactNumber` string.
const buildContacts = (initialData) => {
  if (Array.isArray(initialData?.contacts) && initialData.contacts.length) {
    const contacts = initialData.contacts.map((c) => ({
      label: c.label || "",
      number: c.number || "",
      primary: !!c.primary,
    }));
    if (!contacts.some((c) => c.primary)) contacts[0].primary = true;
    return contacts;
  }
  if (initialData?.contactNumber) {
    return [
      { label: "Primary", number: initialData.contactNumber, primary: true },
    ];
  }
  return [emptyContact(true)];
};

const areas = [
  "Lahore",
  "Rawalpindi/Islamabad",
  "Kamalia/Samundari",
  "Sahiwal",
  "Multan",
  "Karachi",
];

export default function SalesPersonForm({ onClose, initialData, onSuccess }) {
  const isEdit = Boolean(initialData?._id);
  const [formData, setFormData] = useState({
    name: "",
    contacts: [emptyContact(true)],
    email: "",
    designation: "",
    area: "",
    status: "active",
    // These nested fields aren't edited in this dialog but are carried
    // through so that editing a sales person doesn't wipe them out.
    productTarget: { Rs: "", MT: "", period: "M" },
    productSale: { Rs: "", MT: "", period: "M" },
    percentageSale: { value: "", period: "M" },
    recovery: { customer: "", amount: "" },
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Regions come from the database (the Regions page / GET /regions endpoint).
  // The hardcoded `areas` list is only a fallback in case the fetch fails.
  const [regionOptions, setRegionOptions] = useState(areas);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/regions")
      .then(({ data }) => {
        if (cancelled) return;
        const fetched = (Array.isArray(data) ? data : [])
          .map((r) => r?.region)
          .filter((v) => typeof v === "string" && v.trim());
        setRegionOptions((prev) => [...new Set([...prev, ...fetched])]);
      })
      .catch((err) => {
        console.error("Failed to load regions:", err);
        // Keep the hardcoded fallback list.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        contacts: buildContacts(initialData),
        email: initialData.email || "",
        designation: initialData.designation || "",
        area: initialData.area || "",
        status: initialData.status || "active",
        productTarget: initialData.productTarget || {
          Rs: "",
          MT: "",
          period: "M",
        },
        productSale: initialData.productSale || { Rs: "", MT: "", period: "M" },
        percentageSale: initialData.percentageSale || {
          value: "",
          period: "M",
        },
        recovery: initialData.recovery || { customer: "", amount: "" },
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleContactChange = (index, field, value) => {
    setFormData((prev) => {
      const contacts = [...prev.contacts];
      contacts[index] = { ...contacts[index], [field]: value };
      return { ...prev, contacts };
    });
  };

  const addContact = () => {
    setFormData((prev) => ({
      ...prev,
      contacts: [...prev.contacts, emptyContact(false)],
    }));
  };

  const removeContact = (index) => {
    setFormData((prev) => {
      const contacts = prev.contacts.filter((_, i) => i !== index);
      if (contacts.length && !contacts.some((c) => c.primary)) {
        contacts[0].primary = true;
      }
      return { ...prev, contacts };
    });
  };

  const togglePrimary = (index) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => ({ ...c, primary: i === index })),
    }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!String(formData.name || "").trim()) {
      nextErrors.name = "Name is required";
    }
    if (
      !formData.contacts.some((c) => String(c.number || "").trim()) &&
      !String(formData.email || "").trim()
    ) {
      nextErrors.contacts = "Add at least one contact number or an email";
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
      const contacts = formData.contacts
        .map((c) => ({
          label: c.label.trim(),
          number: c.number.trim(),
          primary: !!c.primary,
        }))
        .filter((c) => c.number);

      if (contacts.length && !contacts.some((c) => c.primary)) {
        contacts[0].primary = true;
      }

      const payload = {
        ...formData,
        contacts,
        // keep legacy field populated too, for any older code that still reads it
        contactNumber:
          (contacts.find((c) => c.primary) || contacts[0] || {}).number || "",
      };

      if (isEdit) {
        await api.put(`/salesmen/${initialData._id}`, payload);
      } else {
        await api.post("/salesmen", payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving salesman:", error);
      setFormError(
        error?.response?.data?.message ||
          "Unable to save this sales person. Please check the fields and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add New"} Sales Person</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the sales person details below and save your changes."
              : "Fill in the details below to add a new sales person."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 **:data-[slot='input']:border-accent **:data-[slot='textarea']:border-accent **:data-[slot='select-trigger']:border-accent **:data-[slot='button']:bg-black **:data-[slot='button']:text-accent"
        >
          {formError && (
            <div className="rounded-md border border-destructive/20 bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Name<span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter sales person name"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  type="text"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  placeholder="e.g., Executive"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="area">Area (Region)</Label>
                {(() => {
                  const selectAreas = Array.from(
                    new Set([
                      ...(formData.area ? [formData.area] : []),
                      ...regionOptions,
                    ]),
                  );
                  return (
                    <Select
                      value={formData.area || ""}
                      onValueChange={(v) =>
                        handleChange({ target: { name: "area", value: v } })
                      }
                    >
                      <SelectTrigger id="area">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectAreas.map((area) => (
                          <SelectItem key={area} value={area}>
                            {area}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status || "active"}
                  onValueChange={(v) =>
                    handleChange({ target: { name: "status", value: v } })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Contact Numbers</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContact}
              >
                + Add contact
              </Button>
            </div>
            <div className="space-y-3">
              {formData.contacts.map((c, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-border p-3"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-label-${idx}`}>Label</Label>
                    <Input
                      id={`contact-label-${idx}`}
                      value={c.label}
                      onChange={(e) =>
                        handleContactChange(idx, "label", e.target.value)
                      }
                      placeholder="e.g., Primary, WhatsApp"
                      list="contact-label-suggestions"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-number-${idx}`}>Number</Label>
                    <Input
                      id={`contact-number-${idx}`}
                      type="tel"
                      value={c.number}
                      onChange={(e) =>
                        handleContactChange(idx, "number", e.target.value)
                      }
                      placeholder="Enter contact number"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="primaryContact"
                        checked={c.primary}
                        onChange={() => togglePrimary(idx)}
                      />
                      Primary
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeContact(idx)}
                      disabled={formData.contacts.length === 1}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <datalist id="contact-label-suggestions">
                <option value="Primary" />
                <option value="Secondary" />
                <option value="WhatsApp" />
              </datalist>
              {errors.contacts && (
                <p className="text-xs text-destructive">{errors.contacts}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter email address"
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
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Sales Person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
