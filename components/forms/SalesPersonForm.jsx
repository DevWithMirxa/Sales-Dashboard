"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import api from "@/lib/api";

const emptyContact = (primary = false) => ({ label: "", number: "", primary });

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

export default function SalesPersonForm({ onClose, initialData, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    contacts: [emptyContact(true)],
    email: "",
    designation: "",
    area: "",
    productTarget: { Rs: "", MT: "", period: "M" },
    productSale: { Rs: "", MT: "", period: "M" },
    percentageSale: { value: "", period: "M" },
    recovery: { customer: "", amount: "" },
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        contacts: buildContacts(initialData),
        email: initialData.email || "",
        designation: initialData.designation || "",
        area: initialData.area || "",
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
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value },
    }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
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

      if (initialData && initialData._id) {
        await api.put(`/salesmen/${initialData._id}`, payload);
      } else {
        await api.post("/salesmen", payload);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving salesman:", error);
      alert("Failed to save salesman");
    } finally {
      setLoading(false);
    }
  };

  const areas = [
    "Lahore",
    "Rawalpindi/Islamabad",
    "Kamalia/Samundari",
    "Sahiwal",
    "Multan",
    "Karachi",
  ];

  const periods = [
    { label: "Daily", value: "D" },
    { label: "Weekly", value: "W" },
    { label: "Monthly", value: "M" },
    { label: "Quarterly", value: "Q" },
    { label: "Yearly", value: "Y" },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Sales Person</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Basic Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter sales person name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Designation
                  </label>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    placeholder="e.g., Executive"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Area (Region)
                  </label>
                  <select
                    name="area"
                    value={formData.area}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Region</option>
                    {areas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Numbers (multiple) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Contact Numbers
              </h3>
              <button
                type="button"
                onClick={addContact}
                className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                + Add contact
              </button>
            </div>
            <div className="space-y-3">
              {formData.contacts.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3 border border-gray-200 rounded-lg"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto,auto] gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Label
                      </label>
                      <input
                        type="text"
                        list="contact-label-suggestions"
                        value={c.label}
                        onChange={(e) =>
                          handleContactChange(idx, "label", e.target.value)
                        }
                        placeholder="e.g., Primary, WhatsApp"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Number
                      </label>
                      <input
                        type="tel"
                        value={c.number}
                        onChange={(e) =>
                          handleContactChange(idx, "number", e.target.value)
                        }
                        placeholder="Enter contact number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm pb-2 whitespace-nowrap">
                      <input
                        type="radio"
                        name="primaryContact"
                        checked={c.primary}
                        onChange={() => togglePrimary(idx)}
                      />
                      Primary
                    </label>
                    <button
                      type="button"
                      onClick={() => removeContact(idx)}
                      disabled={formData.contacts.length === 1}
                      className="text-sm text-red-600 disabled:text-gray-300 pb-2 whitespace-nowrap"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <datalist id="contact-label-suggestions">
                <option value="Primary" />
                <option value="Secondary" />
                <option value="WhatsApp" />
              </datalist>
            </div>
          </div>

          {/* Email */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Email</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Save Sales Person
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
