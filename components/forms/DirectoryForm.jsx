"use client";

import React, { useState } from "react";
import { Loader2, Plus } from "lucide-react";
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
  { name: "millOwner", label: "Owner" },
  { name: "ownerContact", label: "Owner's Contact" },
  { name: "districtRegion", label: "District / Region" },
  { name: "millAddress", label: "Mill Address", type: "textarea" },
  { name: "officeAddress", label: "Office Address", type: "textarea" },
  { name: "millPhones", label: "Mill Phone(s)" },
  { name: "officePhones", label: "Office Phone(s)" },
  { name: "email", label: "Email", type: "email" },
  { name: "productionCapacity", label: "Capacity (MT / Hour)" },
  { name: "bagsPerMonth", label: "Production (Bags / Month)" },
];

let contactKeySeq = 0;
// Client-side-only key so React can track contact rows across add/remove -
// stripped out before the payload is sent to the API.
const nextContactKey = () => `contact-${Date.now()}-${contactKeySeq++}`;

const emptyContact = (isPrimary = false) => ({
  _key: nextContactKey(),
  name: "",
  designation: "",
  department: "",
  mobile: "",
  landline: "",
  email: "",
  isPrimary,
});

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

  const buildInitialContacts = () => {
    if (initialData?.contacts?.length) {
      return initialData.contacts.map((c) => ({
        _key: nextContactKey(),
        name: c.name || "",
        designation: c.designation || "",
        department: c.department || "",
        mobile: c.mobile || "",
        landline: c.landline || "",
        email: c.email || "",
        isPrimary: Boolean(c.isPrimary),
      }));
    }
    return [emptyContact(true)];
  };

  const [formData, setFormData] = useState(buildInitialState);
  const [contacts, setContacts] = useState(buildInitialContacts);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleContactChange = (key, field, value) => {
    setContacts((prev) =>
      prev.map((c) => (c._key === key ? { ...c, [field]: value } : c)),
    );
  };

  const handleAddContact = () => {
    setContacts((prev) => [...prev, emptyContact(false)]);
  };

  // Removing the primary contact promotes whichever contact is now first,
  // so there's always exactly one primary as long as contacts exist.
  const handleRemoveContact = (key) => {
    setContacts((prev) => {
      const next = prev.filter((c) => c._key !== key);
      if (next.length === 0) return next;
      if (!next.some((c) => c.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  const handleSetPrimary = (key) => {
    setContacts((prev) =>
      prev.map((c) => ({ ...c, isPrimary: c._key === key })),
    );
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
      // Drop empty contact rows (someone clicked "Add contact" but never
      // filled it in) and strip the client-only _key before saving.
      const payload = {
        ...formData,
        contacts: contacts
          .filter((c) =>
            Object.entries(c).some(
              ([field, value]) =>
                field !== "_key" &&
                field !== "isPrimary" &&
                String(value || "").trim(),
            ),
          )
          .map(({ _key, ...c }) => c),
      };

      if (isEdit) {
        const id = initialData._id || initialData.id;
        await api.put(`${baseUrl}/${id}`, payload);
      } else {
        await api.post(baseUrl, payload);
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add New"} Feed Mill</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details below and save your changes."
              : "Fill in the details below to add a new record to the directory."}
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
                  {f.required && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
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
                  <p className="text-xs text-destructive">{errors[f.name]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Contacts */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">
              Contacts
            </h3>

            <div className="space-y-4">
              {contacts.map((contact, index) => (
                <div
                  key={contact._key}
                  className="rounded-lg border border-border p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Contact #{index + 1}
                    </span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                        <input
                          type="radio"
                          name="primaryContact"
                          checked={contact.isPrimary}
                          onChange={() => handleSetPrimary(contact._key)}
                          className="h-4 w-4 accent-blue-600"
                        />
                        Primary
                      </label>
                      {contacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(contact._key)}
                          className="text-sm font-medium text-destructive hover:text-destructive"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-name-${contact._key}`}>Name</Label>
                    <Input
                      id={`contact-name-${contact._key}`}
                      value={contact.name}
                      onChange={(e) =>
                        handleContactChange(
                          contact._key,
                          "name",
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-designation-${contact._key}`}>
                        Designation
                      </Label>
                      <Input
                        id={`contact-designation-${contact._key}`}
                        value={contact.designation}
                        onChange={(e) =>
                          handleContactChange(
                            contact._key,
                            "designation",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-department-${contact._key}`}>
                        Department
                      </Label>
                      <Input
                        id={`contact-department-${contact._key}`}
                        value={contact.department}
                        onChange={(e) =>
                          handleContactChange(
                            contact._key,
                            "department",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-mobile-${contact._key}`}>
                        Mobile
                      </Label>
                      <Input
                        id={`contact-mobile-${contact._key}`}
                        value={contact.mobile}
                        onChange={(e) =>
                          handleContactChange(
                            contact._key,
                            "mobile",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-landline-${contact._key}`}>
                        Landline
                      </Label>
                      <Input
                        id={`contact-landline-${contact._key}`}
                        value={contact.landline}
                        onChange={(e) =>
                          handleContactChange(
                            contact._key,
                            "landline",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-email-${contact._key}`}>
                        Email
                      </Label>
                      <Input
                        id={`contact-email-${contact._key}`}
                        type="email"
                        value={contact.email}
                        onChange={(e) =>
                          handleContactChange(
                            contact._key,
                            "email",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddContact}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add contact
            </Button>
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
