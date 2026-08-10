'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import ProductForm from '@/components/forms/ProductForm'
import TanStackDataTable from '@/components/TanStackDataTable'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import api from '@/lib/api'

function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/products')
      setProducts(res.data)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await api.delete(`/products/${id}`)
        fetchProducts()
      } catch (error) {
        console.error('Error deleting product:', error)
        alert('Failed to delete product')
      }
    }
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingProduct(null)
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Product Name',
      cell: ({ getValue }) => <span className="text-gray-900">{getValue()}</span>,
      meta: { cellClassName: 'text-gray-900' },
    },
    {
      accessorKey: 'pricePerKg',
      header: 'Price (Rs/Kg)',
      cell: ({ getValue }) => `Rs ${getValue()}`,
    },
    {
      accessorKey: 'packingKg',
      header: 'Packing Size (Kg)',
      cell: ({ getValue }) => `${getValue()} Kg`,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => getValue() || '-',
    },
    {
      id: 'actions',
      header: 'Actions',
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
  ], [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>

        <TanStackDataTable
          columns={columns}
          data={products}
          loading={loading}
          emptyMessage="No products found."
          getRowId={(row) => row._id}
        />

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
              <ProductForm onClose={handleCloseForm} initialData={editingProduct} onSuccess={fetchProducts} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function ProductsPage() {
  return (
    <ProtectedRoute>
      <Products />
    </ProtectedRoute>
  )
}
