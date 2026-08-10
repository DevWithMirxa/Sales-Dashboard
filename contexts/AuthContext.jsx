'use client'

import React, { createContext, useState, useContext, useEffect } from 'react'
import api from '../lib/api'

const AuthContext = createContext()
const bypassLogin = process.env.NEXT_PUBLIC_BYPASS_LOGIN === 'true'
const DEMO_USERS = {
  'admin@saleshub.com': {
    _id: 'demo-admin',
    name: 'Demo Admin',
    email: 'admin@saleshub.com',
    role: 'admin',
  },
  'user@example.com': {
    _id: 'demo-user',
    name: 'Demo User',
    email: 'user@example.com',
    role: 'user',
  },
}
const DEMO_PASSWORDS = {
  'admin@saleshub.com': 'admin123',
  'user@example.com': 'user123',
}
const DEMO_TOKEN = 'demo-token'

const getCookieValue = (name) => {
  if (typeof window === 'undefined') return undefined
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : undefined
}

const setCookie = (name, value, days = 7) => {
  if (typeof window === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; path=/; expires=${expires}`
}

const removeCookie = (name) => {
  if (typeof window === 'undefined') return
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      const cookieToken = getCookieValue('token')
      if (cookieToken === DEMO_TOKEN) {
        setUser(DEMO_USERS['admin@saleshub.com'])
        setLoading(false)
        return
      }

      if (bypassLogin) {
        setUser(DEMO_USERS['admin@saleshub.com'])
        setLoading(false)
        return
      }

      try {
        const { data } = await api.get('/auth/me')
        setUser(data)
      } catch (error) {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  const login = async (email, password) => {
    const lowerEmail = email.toLowerCase().trim()
    const demoPassword = DEMO_PASSWORDS[lowerEmail]

    console.log('[LOGIN] Email:', lowerEmail, 'Password:', password, 'Demo Password:', demoPassword, 'Match:', demoPassword && password === demoPassword)

    if (demoPassword && password === demoPassword) {
      console.log('[LOGIN] Demo credentials matched, logging in...')
      const demoData = DEMO_USERS[lowerEmail]
      setCookie('token', DEMO_TOKEN)
      setUser(demoData)
      return { success: true, user: demoData }
    }

    if (bypassLogin) {
      console.log('[LOGIN] Bypass mode enabled')
      setCookie('token', DEMO_TOKEN)
      setUser(DEMO_USERS['admin@saleshub.com'])
      return { success: true, user: DEMO_USERS['admin@saleshub.com'] }
    }

    console.log('[LOGIN] No demo match, trying backend API...')
    try {
      setLoading(true)
      const { data } = await api.post('/auth/login', { email, password })
      setUser(data)
      return { success: true, user: data }
    } catch (error) {
      console.log('[LOGIN] Backend error:', error.message)
      return { success: false, error: error.response?.data?.message || 'Invalid email or password' }
    } finally {
      setLoading(false)
    }
  }

  const signup = async (fullName, email, password, confirmPassword) => {
    if (password !== confirmPassword) {
      return { success: false, error: 'Passwords do not match' }
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' }
    }

    try {
      setLoading(true)
      const { data } = await api.post('/auth/register', {
        name: fullName,
        email,
        password,
      })
      setUser(data)
      return { success: true, user: data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to sign up' }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    removeCookie('token')
    setUser(null)

    if (bypassLogin) {
      return
    }

    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout error', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
