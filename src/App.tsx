import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ProfileSetup from './components/ProfileSetup'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import DonateSurplus from './pages/DonateSurplus'
import IncomingRequests from './pages/IncomingRequests'
import MyPickups from './pages/MyPickups'

function AppContent() {
  const { user, profile, loading } = useAuth()

  console.log('🎯 [APP] Current state:', { 
    user: user?.id || 'none', 
    profile: profile?.id || 'none', 
    loading,
    profileName: profile?.name || 'none',
    profileType: profile?.user_type || 'none'
  })

  if (loading) {
    console.log('⏳ [APP] Loading state active...')
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading application...</p>
          <p className="text-sm text-gray-500 mt-2">Checking authentication status...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log('🚫 [APP] No user found, showing auth page')
    return <Auth />
  }

  // If user exists but no profile, show profile setup
  if (user && !profile) {
    console.log('👤 [APP] User found but no profile, showing profile setup')
    return <ProfileSetup />
  }

  console.log('✅ [APP] User and profile found, showing main app')
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/donate"
          element={
            <ProtectedRoute userType="donor">
              <DonateSurplus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <ProtectedRoute userType="shelter">
              <IncomingRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pickups"
          element={
            <ProtectedRoute userType="volunteer">
              <MyPickups />
            </ProtectedRoute>
          }
        />
        <Route
          path="/auth"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App