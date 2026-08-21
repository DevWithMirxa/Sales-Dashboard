import React from 'react'

export default function TableCard({ title, children }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-6">{title}</h2>
      {children}
    </div>
  )
}
