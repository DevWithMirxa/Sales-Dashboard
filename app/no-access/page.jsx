'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { Lock, BarChart3, ArrowRight } from 'lucide-react'

export default function NoAccessPage() {
  const { logout } = useAuth()
  return (
    <div className="min-h-screen bg-linear-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <Lock className="w-10 h-10 text-red-600" />
            </div>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-8">
          You don't have permission to access the SalesHub dashboard. Only administrators can view this section. If you believe this is an error, please contact your system administrator.
        </p>

        <div className="space-y-4">
          <button
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
          >
            <BarChart3 className="w-5 h-5" />
            Logout & Switch Account
          </button>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-3">Test Admin Account:</p>
            <div className="bg-white rounded-lg p-4 space-y-2 text-left">
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-mono text-gray-900">admin@saleshub.com</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Password</p>
                <p className="text-sm font-mono text-gray-900">admin123</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-8">
          Need help?{' '}
          <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
            Contact support
          </a>
        </p>
      </div>
    </div>
  )
}
