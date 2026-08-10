'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import CustomerForm from '@/components/forms/CustomerForm'
import TanStackDataTable from '@/components/TanStackDataTable'
import { TableCell, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react'
import api from '@/lib/api'

const formatCityRegion = (customer) => {
  const parts = [customer.city, customer.region].filter(Boolean)
  return parts.length ? parts.join(', ') : '-'
}

const getPrimaryContact = (customer) => {
  if (customer.contacts && customer.contacts.length > 0) {
    return customer.contacts.find((c) => c.primary) || customer.contacts[0]
  }

  return null
}

function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/customers')
      setCustomers(res.data)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      try {
        await api.delete(`/customers/${id}`)
        fetchCustomers()
      } catch (error) {
        console.error('Error deleting customer:', error)
        alert('Failed to delete customer')
      }
    }
  }

  const handleEdit = (customer) => {
    setEditingCustomer(customer)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingCustomer(null)
  }

  const toggleExpanded = (id) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const columns = useMemo(() => [
    {
      id: 'expand',
      header: '',
      enableSorting: false,
      meta: { headerClassName: 'w-8' },
      cell: ({ row }) => {
        const isExpanded = expandedId === row.original._id
        return (
          <span className="text-gray-400">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        )
      },
    },
    {
      accessorKey: 'businessName',
      header: 'Business Name',
      meta: { cellClassName: 'text-gray-900' },
    },
    {
      id: 'businessType',
      header: 'Type',
      accessorFn: (row) => `${row.businessType || ''}${row.businessType === 'Farm' && row.farmType ? ` - ${row.farmType}` : ''}`,
    },
    {
      id: 'contactPerson',
      header: 'Contact Person',
      accessorFn: (row) => getPrimaryContact(row)?.name || row.personName || '-',
    },
    {
      id: 'mobile',
      header: 'Mobile',
      accessorFn: (row) => getPrimaryContact(row)?.mobile || row.mobile || '-',
    },
    {
      id: 'cityRegion',
      header: 'City/Region',
      accessorFn: formatCityRegion,
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
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
          {row.original.contacts && row.original.contacts.length > 1 && (
            <div className="ml-2 text-sm text-gray-500">{row.original.contacts.length} contacts</div>
          )}
        </div>
      ),
    },
  ], [expandedId])

  const renderCustomerDetails = (customer, colSpan) => {
    if (expandedId !== customer._id) return null

    return (
      <TableRow className="bg-gray-50 border-b border-gray-200">
        <TableCell colSpan={colSpan} className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Addresses</h4>
              <div className="text-sm text-gray-600 space-y-2">
                <div>
                  <span className="font-medium text-gray-700">Head Office: </span>
                  {customer.headOfficeAddress || '-'}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Mill: </span>
                  {customer.millAddress || '-'}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Farm: </span>
                  {customer.farmAddress || '-'}
                </div>
                <div>
                  <span className="font-medium text-gray-700">City/Region: </span>
                  {formatCityRegion(customer)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Contacts</h4>
              {customer.contacts && customer.contacts.length > 0 ? (
                <div className="space-y-3">
                  {customer.contacts.map((contact, index) => (
                    <div key={index} className="text-sm text-gray-600 border border-gray-200 rounded-md p-3 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{contact.name || '-'}</span>
                        {contact.primary && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Primary</span>
                        )}
                      </div>
                      {(contact.designation || contact.department) && (
                        <div className="text-gray-500 mt-1">
                          {[contact.designation, contact.department].filter(Boolean).join(' - ')}
                        </div>
                      )}
                      <div className="mt-1 space-y-0.5">
                        {contact.mobile && <div>Mobile: {contact.mobile}</div>}
                        {contact.landline && <div>Landline: {contact.landline}</div>}
                        {contact.email && <div>Email: {contact.email}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No contacts on file.</div>
              )}
            </div>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Customer
          </button>
        </div>

        <TanStackDataTable
          columns={columns}
          data={customers}
          loading={loading}
          emptyMessage="No customers found."
          getRowId={(row) => row._id}
          onRowClick={(customer) => toggleExpanded(customer._id)}
          renderSubRow={renderCustomerDetails}
        />

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
              <CustomerForm onClose={handleCloseForm} initialData={editingCustomer} onSuccess={fetchCustomers} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function CustomersPage() {
  return (
    <ProtectedRoute>
      <Customers />
    </ProtectedRoute>
  )
}
