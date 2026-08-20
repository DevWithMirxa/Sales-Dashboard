"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import ProductForm from "@/components/forms/ProductForm";
import TanStackDataTable from "@/components/TanStackDataTable";
import {
  Plus,
  Trash2,
  Edit2,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null); // { type: 'success' | 'error', text }
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get("/products");
      setProducts(res.data);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        await api.delete(`/products/${id}`);
        fetchProducts();
      } catch (error) {
        console.error("Error deleting product:", error);
        alert("Failed to delete product");
      }
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const productColumns = [
    { label: "Product Name", key: "name" },
    { label: "Price (Rs/Kg)", key: "pricePerKg" },
    { label: "Packing Size (Kg)", key: "packingKg" },
    { label: "Status", key: "status" },
  ];

  const handleExportExcel = () => {
    exportToCSV(products, productColumns, "products");
  };

  const handleExportPDF = () => {
    exportToPDF(products, productColumns, {
      title: "Products",
      subtitle: "Product catalogue",
      filename: "products",
    });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleUploadClick = () => {
    setShowUploadDialog(false);
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await api.get("/products/upload-template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "products-upload-template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Failed to download the template file.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so selecting the same file again still fires onChange
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/products/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const {
        inserted = 0,
        updated = 0,
        skipped = 0,
        totalRows = 0,
      } = res.data || {};
      setUploadMessage({
        type: "success",
        text: `Imported ${inserted + updated} of ${totalRows} rows (${inserted} new, ${updated} updated${
          skipped ? `, ${skipped} skipped` : ""
        }).`,
      });
      fetchProducts();
    } catch (err) {
      setUploadMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Upload failed. Please check the file format and try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Product Name",
        cell: ({ getValue }) => (
          <span className="text-gray-900">{getValue()}</span>
        ),
        meta: { cellClassName: "text-gray-900" },
      },
      {
        accessorKey: "pricePerKg",
        header: "Price (Rs/Kg)",
        cell: ({ getValue }) => `${getValue()}`,
      },
      {
        accessorKey: "packingKg",
        header: "Packing Size (Kg)",
        cell: ({ getValue }) => `${getValue()}`,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(row.original)}
              className="text-blue-600 hover:text-blue-900"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(row.original._id)}
              className="text-red-600 hover:text-red-900"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton
              onExcel={handleExportExcel}
              onPdf={handleExportPDF}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelected}
            />
            <button
              onClick={() => setShowUploadDialog(true)}
              disabled={uploading}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {uploading ? "Uploading..." : "Upload Excel File"}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Product
            </button>
          </div>
        </div>

        {/* Upload result banner */}
        {uploadMessage && (
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
              uploadMessage.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {uploadMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="flex-1">{uploadMessage.text}</span>
            <button
              onClick={() => setUploadMessage(null)}
              className="text-current opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload choice dialog */}
        <Dialog
          open={showUploadDialog}
          onOpenChange={(open) => setShowUploadDialog(open)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Products from Excel</DialogTitle>
              <DialogDescription>
                Not sure of the exact column names? Download the format file
                first — it has the correct headers plus one real example row, so
                the upload can't fail because of a mismatched column name.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                {downloadingTemplate ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                {downloadingTemplate
                  ? "Preparing file..."
                  : "Download Format File"}
              </button>
              <button
                onClick={handleUploadClick}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-5 h-5" />
                Browse Excel File
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <TanStackDataTable
          columns={columns}
          data={products}
          loading={loading}
          emptyMessage="No products found."
          getRowId={(row) => row._id}
        />

        {/* Form Modal */}
        {showForm && (
          <ProductForm
            onClose={handleCloseForm}
            initialData={editingProduct}
            onSuccess={fetchProducts}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

export default function ProductsPage() {
  return (
    <ProtectedRoute>
      <Products />
    </ProtectedRoute>
  );
}
