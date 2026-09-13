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

const ROLES = ["admin", "user", "customer", "salesman"];
const STATUSES = ["active", "inactive", "pending", "suspended", "banned"];

export default function UserForm({ onClose, initialData, onSuccess }) {
  const isEdit = Boolean(initialData?._id);

  const buildInitial = () => ({
    name: initialData?.name || "",
    email: initialData?.email || "",
    username: initialData?.username || "",
    password: "",
    role: initialData?.role || "user",
    status: initialData?.status || "active",
  });

  const [formData, setFormData] = useState(buildInitial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!String(formData.name || "").trim()) {
      nextErrors.name = "Full name is required";
    }
    if (!String(formData.email || "").trim()) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = "Enter a valid email address";
    }
    if (!isEdit && !formData.password) {
      nextErrors.password = "Password is required for a new user";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        username: formData.username || undefined,
        role: formData.role,
        status: formData.status,
      };
      // Only send a password if one was typed - required on create,
      // optional on edit (blank means "keep the existing password").
      if (formData.password) payload.password = formData.password;

      if (isEdit) {
        await api.put(`/users/${initialData._id}`, payload);
      } else {
        await api.post("/users", payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
      setError(
        err?.response?.data?.message ||
          "Unable to save this user. Please check the fields and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add New"} User</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the user details below and save your changes."
              : "Fill in the details below to create a new user."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 **:data-[slot='input']:border-accent **:data-[slot='textarea']:border-accent **:data-[slot='select-trigger']:border-accent **:data-[slot='button']:bg-black **:data-[slot='button']:text-accent"
        >
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Full Name
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter full name"
              />
              {errors.name && (
                <p className="text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">
                {isEdit ? "New Password" : "Password"}
                {!isEdit && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
              <Input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={
                  isEdit
                    ? "Leave blank to keep current password"
                    : "Enter password"
                }
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(v) =>
                  handleChange({ target: { name: "role", value: v } })
                }
              >
                <SelectTrigger id="role" className="capitalize">
                  <SelectValue className="capitalize" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) =>
                  handleChange({ target: { name: "status", value: v } })
                }
              >
                <SelectTrigger id="status" className="capitalize">
                  <SelectValue className="capitalize" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {isEdit ? "Save Changes" : "Add User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
