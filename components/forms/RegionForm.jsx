'use client';

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import api from '@/lib/api'

export default function RegionForm({ onClose, initialData, onSuccess }) {
  const [formData, setFormData] = useState({
    region: 'Lahore',
  })
  const [loading, setLoading] = useState(false)

  const regions = [
    'Lahore',
    'Rawalpindi/Islamabad',
    'Kamalia/Samundari',
    'Sahiwal',
    'Multan',
    'Karachi',
  ]

  useEffect(() => {
    if (initialData) {
      setFormData({
        region: initialData.region || 'Lahore',
      })
    }
  }, [initialData])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (initialData && initialData._id) {
        await api.put(`/regions/${initialData._id}`, formData)
      } else {
        await api.post('/regions', formData)
      }
      if (onSuccess) onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving region:', error)
      alert('Failed to save region')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Region</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Region
            </label>
            <div className="space-y-3">
              {regions.map((region) => (
                <label key={region} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="region"
                    value={region}
                    checked={formData.region === region}
                    onChange={handleChange}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{region}</span>
                </label>
              ))}
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
              Save Region
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
