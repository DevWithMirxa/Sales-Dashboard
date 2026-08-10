'use client';

import React from 'react'
import { Download } from 'lucide-react'

export default function ChartCard({ title, children, onFormOpen }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onFormOpen}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            title="Export"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
