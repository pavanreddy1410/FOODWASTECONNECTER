import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Heart, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import NotificationSystem from './NotificationSystem'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/', show: true },
    { name: 'Donate Food', href: '/donate', show: profile?.user_type === 'donor' },
    { name: 'Incoming Requests', href: '/requests', show: profile?.user_type === 'shelter' },
    { name: 'My Pickups', href: '/pickups', show: profile?.user_type === 'volunteer' },
  ].filter(item => item.show)

  const handleSignOut = async () => {
    if (signingOut) return // Prevent multiple clicks
    
    try {
      setSigningOut(true)
      console.log('🚪 [LAYOUT] User initiated sign out')
      await signOut()
      console.log('✅ [LAYOUT] Sign out completed successfully')
    } catch (error) {
      console.error('❌ [LAYOUT] Sign out failed:', error)
      // Even if sign out fails, the AuthContext should handle clearing state
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <nav className="bg-white shadow-lg border-b border-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <Heart className="h-8 w-8 text-green-600" />
                <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  FoodWasteConnector
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.href
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              {user && (
                <div className="flex items-center space-x-4">
                  <NotificationSystem />
                  <span className="text-sm text-gray-600">
                    {profile?.name} ({profile?.user_type})
                  </span>
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {signingOut ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    <span>{signingOut ? 'Signing Out...' : 'Sign Out'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-2">
              {user && <NotificationSystem />}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-600 hover:text-green-600 focus:outline-none"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-green-100">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    location.pathname === item.href
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              {user && (
                <div className="px-3 py-2 border-t border-green-100">
                  <div className="text-sm text-gray-600 mb-2">
                    {profile?.name} ({profile?.user_type})
                  </div>
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {signingOut ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    <span>{signingOut ? 'Signing Out...' : 'Sign Out'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-white border-t border-green-100 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-center items-center">
            <div className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-green-600" />
              <span className="text-sm text-gray-600">
                © 2025 FoodWasteConnector. Connecting communities to reduce food waste.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}