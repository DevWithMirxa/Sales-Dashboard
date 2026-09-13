"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import ProductForm from "@/components/forms/ProductForm";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/csvExport";
import { exportToPDF } from "@/lib/pdfExport";
import DownloadButton from "@/components/DownloadButton";
import ConfirmDelete from "@/components/ConfirmDelete";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Factory,
  DollarSign,
  Boxes,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const showValue = (v) => (v === null || v === undefined || v === "" ? "-" : v);

// Status pill colors - falls back to a neutral badge for any status
// value we don't explicitly recognize.
const statusStyles = {
  active: "bg-accent/20 text-accent border-accent/30",
  inactive: "bg-muted text-muted-foreground border-border",
  discontinued: "bg-destructive/20 text-destructive border-destructive/30",
  "low stock": "bg-chart-3/20 text-chart-3 border-chart-3/30",
};

const getStatusClass = (status) =>
  statusStyles[String(status || "").toLowerCase()] ||
  "bg-muted text-muted-foreground border-border";

function StatCard({ label, value, icon: Icon, colorClass }) {
  return (
    <Card className="border-border bg-card transition-all duration-300 hover:border-muted-foreground/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-2xl font-semibold", colorClass)}>
              {value}
            </p>
          </div>
          <Icon className={cn("h-8 w-8 opacity-50", colorClass)} />
        </div>
      </CardContent>
    </Card>
  );
}

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

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

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
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Failed to delete product");
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
    { label: "Origin", key: "origin" },
    { label: "Supplier", key: "supplier" },
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

  // Distinct statuses present in the data, for the filter dropdown.
  const statuses = useMemo(
    () => [...new Set(products.map((p) => p.status).filter(Boolean))],
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        [p.name, p.supplier, p.origin].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(q),
        );
      const matchesStatus =
        selectedStatus === "all" || p.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, selectedStatus]);

  // Reset to page 1 whenever the filtered set changes.
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [searchQuery, selectedStatus]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / pagination.pageSize),
  );
  const paginatedProducts = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return filteredProducts.slice(start, start + pagination.pageSize);
  }, [filteredProducts, pagination]);

  const resultCountLabel =
    filteredProducts.length === 0
      ? "0 results"
      : `Page ${pagination.pageIndex + 1} of ${pageCount} - ${filteredProducts.length} results`;

  const goToPage = (delta) =>
    setPagination((prev) => ({
      ...prev,
      pageIndex: Math.min(Math.max(prev.pageIndex + delta, 0), pageCount - 1),
    }));

  // Summary stats
  const stats = useMemo(() => {
    const activeCount = products.filter(
      (p) => String(p.status || "").toLowerCase() === "active",
    ).length;
    const supplierCount = new Set(
      products.map((p) => p.supplier).filter(Boolean),
    ).size;
    const prices = products
      .map((p) => Number(p.pricePerKg))
      .filter((n) => Number.isFinite(n));
    const avgPrice = prices.length
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      : 0;
    return { activeCount, supplierCount, avgPrice };
  }, [products]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-bold tracking-tight text-accent">
            Products
          </h1>
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
            <Button
              variant="outline"
              onClick={() => setShowUploadDialog(true)}
              disabled={uploading}
              className="hover:text-accent"
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Upload Excel File"}
            </Button>
          </div>
        </div>

        {/* Upload result banner */}
        {uploadMessage && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 text-sm",
              uploadMessage.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800",
            )}
          >
            {uploadMessage.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            <span className="flex-1">{uploadMessage.text}</span>
            <button
              onClick={() => setUploadMessage(null)}
              className="text-current opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
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
                the upload cant fail because of a mismatched column name.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="w-full"
              >
                {downloadingTemplate ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {downloadingTemplate
                  ? "Preparing file..."
                  : "Download Format File"}
              </Button>
              <Button onClick={handleUploadClick} className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                Browse Excel File
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Summary stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            label="Total Products"
            value={products.length}
            icon={Boxes}
            colorClass="text-foreground"
          />
          <StatCard
            label="Active Products"
            value={stats.activeCount}
            icon={CheckCircle2}
            colorClass="text-accent"
          />
          <StatCard
            label="Suppliers"
            value={stats.supplierCount}
            icon={Factory}
            colorClass="text-chart-1"
          />
          <StatCard
            label="Avg Price / Kg"
            value={`Rs ${stats.avgPrice.toLocaleString()}`}
            icon={DollarSign}
            colorClass="text-chart-3"
          />
        </div>

        {/* Table */}
        {loading ? (
          <TableSkeleton rows={5} />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>All Products</CardTitle>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search product, supplier, origin..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64 pl-8"
                    />
                  </div>
                  {statuses.length > 0 && (
                    <Select
                      value={selectedStatus}
                      onValueChange={setSelectedStatus}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    onClick={() => setShowForm(true)}
                    className="shrink-0"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Price (Rs/Kg)</TableHead>
                    <TableHead>Packing (Kg)</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-muted-foreground"
                      >
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : paginatedProducts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No products found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedProducts.map((product) => (
                      <TableRow
                        key={product._id}
                        className="hover:bg-secondary/50"
                      >
                        <TableCell className="font-medium text-foreground">
                          {showValue(product.name)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {showValue(product.origin)}
                        </TableCell>
                        <TableCell className="text-foreground">
                          Rs {showValue(product.pricePerKg)}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {showValue(product.packingKg)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {showValue(product.supplier)}
                        </TableCell>
                        <TableCell>
                          {product.status ? (
                            <Badge
                              className={cn(
                                "border",
                                getStatusClass(product.status),
                              )}
                            >
                              {product.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleEdit(product)}
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <ConfirmDelete
                              title="Delete product"
                              description="Are you sure you want to delete this product? This action cannot be undone."
                              onConfirm={() => handleDelete(product._id)}
                            >
                              <button
                                type="button"
                                title="Delete"
                                className="flex h-8 w-8 shrink-0 items-center justify-center text-red-500 hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </ConfirmDelete>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-4 border-t py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(value) =>
                    setPagination((prev) => ({
                      ...prev,
                      pageSize: Number(value),
                      pageIndex: 0,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {resultCountLabel}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(-1)}
                    disabled={pagination.pageIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(1)}
                    disabled={
                      pagination.pageIndex >= Math.max(pageCount - 1, 0)
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        )}

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
