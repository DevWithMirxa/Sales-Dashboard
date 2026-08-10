'use client'

import React, { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import RegionForm from '@/components/forms/RegionForm'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import api from '@/lib/api'

function Regions() {
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRegion, setEditingRegion] = useState(null)

  const fetchRegions = async () => {
    try {
      setLoading(true)
      const res = await api.get('/regions')
      setRegions(res.data)
    } catch (error) {
      console.error('Error fetching regions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRegions()
  }, [])

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this region?')) {
      try {
        await api.delete(`/regions/${id}`)
        fetchRegions()
      } catch (error) {
        console.error('Error deleting region:', error)
        alert('Failed to delete region')
      }
    }
  }

  const handleEdit = (region) => {
    setEditingRegion(region)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingRegion(null)
  }

  const getAchievementPercentage = (sales, target) => {
    return Math.round((sales / target) * 100)
  }

  const getStatusColor = (percentage) => {
    if (percentage >= 100) return 'text-green-600'
    if (percentage >= 80) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Regions</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Region
          </button>
        </div>

        {/* Regions Grid */}
        {loading ? (
           <div className="text-center py-8 text-gray-500">Loading regions...</div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {regions.map((regionObj) => {
            const achievement = getAchievementPercentage(regionObj.monthlySales || 0, regionObj.target || 1)
            return (
              <div key={regionObj._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{regionObj.region}</h3>
                    <p className="text-sm text-gray-600">Manager: {regionObj.regionManager || 'N/A'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(regionObj)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(regionObj._id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sales Team:</span>
                    <span className="font-medium text-gray-900">{regionObj.salesCount || 0} members</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Customers:</span>
                    <span className="font-medium text-gray-900">{regionObj.customerCount || 0}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Monthly Sales:</span>
                      <span className="font-medium text-gray-900">Rs {((regionObj.monthlySales || 0) / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Target:</span>
                      <span className="font-medium text-gray-900">Rs {((regionObj.target || 0) / 1000).toFixed(0)}K</span>
                    </div>
                     <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Recovery (Rs):</span>
                      <span className="font-medium text-gray-900">Rs {((regionObj.recovery || 0) / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Achievement:</span>
                      <span className={`font-bold ${getStatusColor(achievement)}`}>{achievement}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
              <RegionForm onClose={handleCloseForm} initialData={editingRegion} onSuccess={fetchRegions} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function RegionsPage() {
  return (
    <ProtectedRoute>
      <Regions />
    </ProtectedRoute>
  )
}
