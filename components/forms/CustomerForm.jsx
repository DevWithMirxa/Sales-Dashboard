'use client';

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import api from '@/lib/api'

const FARM_TYPES = ['Broiler', 'Layer', 'Breeder', 'Miscellaneous']

const areas = [
  'Lahore',
  'Rawalpindi/Islamabad',
  'Kamalia/Samundari',
  'Sahiwal',
  'Multan',
  'Karachi',
]

const emptyContact = () => ({ name: '', designation: '', department: '', mobile: '', landline: '', email: '', primary: true })
const normalizeContact = (contact = {}) => ({
  name: contact.name?.toString()?.trim() || '',
  designation: contact.designation?.toString()?.trim() || '',
  department: contact.department?.toString()?.trim() || '',
  mobile: contact.mobile?.toString()?.trim() || '',
  landline: contact.landline?.toString()?.trim() || '',
  email: contact.email?.toString()?.trim() || '',
  primary: !!contact.primary,
})

const buildFormData = (source = {}) => {
  const contactsFromSource = Array.isArray(source.contacts) && source.contacts.length
    ? source.contacts.map(normalizeContact)
    : (source.personName || source.mobile || source.email)
      ? [normalizeContact({
          name: source.personName,
          designation: source.designation,
          department: source.department,
          mobile: source.mobile,
          landline: source.landline,
          email: source.email,
          primary: true,
        })]
      : [emptyContact()]

  const hasPrimary = contactsFromSource.some((c) => c.primary)
  if (!hasPrimary && contactsFromSource.length > 0) {
    contactsFromSource[0].primary = true
  }

  return {
    businessName: source.businessName?.toString()?.trim() || '',
    businessType: source.businessType || 'Feed Mill',
    farmType: source.farmType || '',
    city: source.city?.toString()?.trim() || '',
    region: source.region?.toString()?.trim() || '',
    headOfficeAddress: source.headOfficeAddress?.toString()?.trim() || '',
    millAddress: source.millAddress?.toString()?.trim() || '',
    farmAddress: source.farmAddress?.toString()?.trim() || '',
    contacts: contactsFromSource,
  }
}

export default function CustomerForm({ onClose, initialData, onSuccess }) {
  const [formData, setFormData] = useState(buildFormData())
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (initialData) {
      setFormData(buildFormData(initialData))
      setErrors({})
    }
  }, [initialData])

  const handleChange = (e) => {
    const { name, value } = e.target

    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      // Reset farmType whenever business type changes away from Farm
      if (name === 'businessType' && value !== 'Farm') {
        next.farmType = ''
      }
      return next
    })

    // clear field error on change
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  // errors.contacts is always stored as an object keyed by contact index,
  // e.g. { 0: { name: '...' }, 2: { mobile: '...' } } — never an array.
  const handleContactChange = (index, field, value) => {
    setFormData((prev) => {
      const contacts = Array.isArray(prev.contacts) ? [...prev.contacts] : []
      contacts[index] = { ...contacts[index], [field]: value }
      return { ...prev, contacts }
    })
    setErrors((prev) => {
      if (!prev.contacts || !prev.contacts[index]) return prev
      const contactsErrors = { ...prev.contacts }
      const obj = { ...contactsErrors[index] }
      delete obj[field]
      contactsErrors[index] = obj
      return { ...prev, contacts: contactsErrors }
    })
  }

  const addContact = () => {
    setFormData((prev) => ({
      ...prev,
      contacts: [...(prev.contacts || []), { name: '', designation: '', department: '', mobile: '', landline: '', email: '', primary: false }]
    }))
  }

  const removeContact = (index) => {
    setFormData((prev) => ({
      ...prev,
      contacts: (prev.contacts || []).filter((_, i) => i !== index)
    }))
    setErrors((prev) => {
      if (!prev.contacts) return prev
      // Rebuild the errors object, shifting keys down so they still line up
      // with the contacts array after removal.
      const reindexed = {}
      Object.entries(prev.contacts).forEach(([key, val]) => {
        const i = Number(key)
        if (i === index) return
        const newKey = i > index ? i - 1 : i
        reindexed[newKey] = val
      })
      return { ...prev, contacts: reindexed }
    })
  }

  const togglePrimary = (index) => {
    setFormData((prev) => ({
      ...prev,
      contacts: (prev.contacts || []).map((c, i) => ({ ...c, primary: i === index }))
    }))
  }

  const validateField = (name, value) => {
    if (name === 'businessName') {
      if (!value || value.trim().length < 2) return 'Business name is required'
    }
    if (name === 'farmType') {
      if (formData.businessType === 'Farm' && !value) return 'Farm type is required'
    }
    if (name === 'mobile') {
      const v = (value || '').toString().trim()
      if (!v) return 'Mobile number is required'
      const re = /^\d{7,15}$/
      if (!re.test(v)) return 'Enter a valid mobile number (7-15 digits)'
    }
    if (name === 'email') {
      const v = (value || '').toString().trim()
      if (v) {
        const re = /^\S+@\S+\.\S+$/
        if (!re.test(v)) return 'Enter a valid email address'
      }
    }
    return null
  }

  const validateContact = (contact) => {
    const errs = {}
    if (!contact.name || contact.name.trim().length < 2) errs.name = 'Name is required'
    if (!contact.mobile || !/^\d{7,15}$/.test((contact.mobile || '').toString().trim())) errs.mobile = 'Valid mobile required'
    if (contact.email && !/^\S+@\S+\.\S+$/.test(contact.email)) errs.email = 'Invalid email'
    return errs
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    const err = validateField(name, value)
    setErrors((prev) => ({ ...prev, ...(err ? { [name]: err } : {}) }))
  }

  const handleContactBlur = (index, field, value) => {
    const contact = { ...(formData.contacts && formData.contacts[index]) }
    contact[field] = value
    const errs = validateContact(contact)
    setErrors((prev) => ({ ...prev, contacts: { ...(prev.contacts || {}), [index]: errs } }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    // run validation for top-level fields
    const newErrors = {}
    Object.entries(formData).forEach(([k, v]) => {
      if (k === 'contacts') return
      const err = validateField(k, v)
      if (err) newErrors[k] = err
    })
    // validate contacts — build as an object keyed by index, matching the
    // shape used everywhere else (handleContactChange / handleContactBlur / removeContact)
    const contacts = Array.isArray(formData.contacts) ? formData.contacts : []
    const contactErrorsObj = {}
    contacts.forEach((c, i) => {
      const errs = validateContact(c)
      if (Object.keys(errs).length) contactErrorsObj[i] = errs
    })
    if (Object.keys(contactErrorsObj).length) {
      newErrors.contacts = contactErrorsObj
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors)
      setLoading(false)
      return
    }
    try {
      const contacts = Array.isArray(formData.contacts)
        ? formData.contacts.map(normalizeContact)
        : [emptyContact()]

      const primaryIndex = contacts.findIndex((contact) => contact.primary)
      if (primaryIndex === -1 && contacts.length > 0) {
        contacts[0].primary = true
      }

      const payload = {
        businessName: formData.businessName.trim(),
        businessType: formData.businessType,
        farmType: formData.businessType === 'Farm' ? formData.farmType : '',
        city: formData.city.trim(),
        region: formData.region.trim(),
        headOfficeAddress: formData.headOfficeAddress.trim(),
        millAddress: formData.millAddress.trim(),
        farmAddress: formData.farmAddress.trim(),
        contacts,
      }

      if (initialData && initialData._id) {
        await api.put(`/customers/${initialData._id}`, payload)
      } else {
        await api.post('/customers', payload)
      }
      if (onSuccess) onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving customer:', error)
      alert('Failed to save customer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Customer</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Business Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Business Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name
                </label>
                <input
                  id="businessName"
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter business name"
                  aria-invalid={!!errors.businessName}
                  aria-describedby={errors.businessName ? 'businessName-error' : undefined}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.businessName && (
                  <p id="businessName-error" className="text-sm text-red-600 mt-1">{errors.businessName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Type
                </label>
                <select
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Feed Mill</option>
                  <option>Farm</option>
                </select>
              </div>

              {/* Farm Type dropdown - only visible when Business Type is Farm */}
              {formData.businessType === 'Farm' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Farm Type
                  </label>
                  <select
                    id="farmType"
                    name="farmType"
                    value={formData.farmType}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={!!errors.farmType}
                    aria-describedby={errors.farmType ? 'farmType-error' : undefined}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select farm type</option>
                    {FARM_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {errors.farmType && (
                    <p id="farmType-error" className="text-sm text-red-600 mt-1">{errors.farmType}</p>
                  )}
                </div>
              )}

              {/* City / Region */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Enter city"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Region
                  </label>
                  <select
                    name="region"
                    value={formData.region}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Head Office Address
                </label>
                <textarea
                  name="headOfficeAddress"
                  value={formData.headOfficeAddress}
                  onChange={handleChange}
                  placeholder="Enter head office address"
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mill Address
                </label>
                <textarea
                  name="millAddress"
                  value={formData.millAddress}
                  onChange={handleChange}
                  placeholder="Enter mill address"
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Farm Address
                </label>
                <textarea
                  name="farmAddress"
                  value={formData.farmAddress}
                  onChange={handleChange}
                  placeholder="Enter farm address"
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Contacts (multiple) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contacts</h3>
            <div className="space-y-4">
              {(formData.contacts || []).map((c, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium">Contact #{idx + 1}</div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm flex items-center gap-2">
                        <input type="radio" name="primaryContact" checked={c.primary} onChange={() => togglePrimary(idx)} />
                        <span className="text-xs">Primary</span>
                      </label>
                      <button type="button" onClick={() => removeContact(idx)} className="text-sm text-red-600">Remove</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => handleContactChange(idx, 'name', e.target.value)}
                        onBlur={(e) => handleContactBlur(idx, 'name', e.target.value)}
                        className="w-full px-3 py-2 border rounded"
                      />
                      {errors.contacts && errors.contacts[idx] && errors.contacts[idx].name && (
                        <p className="text-sm text-red-600 mt-1">{errors.contacts[idx].name}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Designation</label>
                        <input type="text" value={c.designation} onChange={(e) => handleContactChange(idx, 'designation', e.target.value)} className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                        <input type="text" value={c.department} onChange={(e) => handleContactChange(idx, 'department', e.target.value)} className="w-full px-3 py-2 border rounded" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
                        <input type="tel" value={c.mobile} onChange={(e) => handleContactChange(idx, 'mobile', e.target.value)} onBlur={(e) => handleContactBlur(idx, 'mobile', e.target.value)} className="w-full px-3 py-2 border rounded" />
                        {errors.contacts && errors.contacts[idx] && errors.contacts[idx].mobile && (
                          <p className="text-sm text-red-600 mt-1">{errors.contacts[idx].mobile}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Landline</label>
                        <input type="tel" value={c.landline} onChange={(e) => handleContactChange(idx, 'landline', e.target.value)} className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input type="email" value={c.email} onChange={(e) => handleContactChange(idx, 'email', e.target.value)} onBlur={(e) => handleContactBlur(idx, 'email', e.target.value)} className="w-full px-3 py-2 border rounded" />
                        {errors.contacts && errors.contacts[idx] && errors.contacts[idx].email && (
                          <p className="text-sm text-red-600 mt-1">{errors.contacts[idx].email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <button type="button" onClick={addContact} className="px-3 py-2 bg-gray-100 rounded">Add contact</button>
              </div>
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
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}