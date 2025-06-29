import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { MapPin, Package, Clock, User, Navigation, CheckCircle, Phone, MessageSquare } from 'lucide-react'

interface Donation {
  id: string
  donor_name: string
  food_type: string
  quantity: string
  pickup_location: string
  pickup_coordinates: string | null
  status: string
  created_at: string
  accepted_at: string | null
  completed_at: string | null
  notes: string | null
  shelter_id: string
}

export default function MyPickups() {
  const { user } = useAuth()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => {
    fetchAcceptedDonations()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('accepted-donations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'donations',
          filter: 'status=in.(accepted,completed)',
        },
        () => {
          fetchAcceptedDonations()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchAcceptedDonations = async () => {
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .in('status', ['accepted', 'completed'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setDonations(data || [])
    } catch (error) {
      console.error('Error fetching donations:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDirections = (coordinates: string | null, address: string) => {
    if (coordinates) {
      const [lat, lng] = coordinates.replace(/[()]/g, '').split(',').map(Number)
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      window.open(googleMapsUrl, '_blank')
    } else {
      const encodedLocation = encodeURIComponent(address)
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`
      window.open(googleMapsUrl, '_blank')
    }
  }

  const completeDonation = async (donationId: string) => {
    setCompleting(donationId)

    try {
      const { error } = await supabase
        .from('donations')
        .update({ 
          status: 'completed',
          volunteer_id: user?.id 
        })
        .eq('id', donationId)

      if (error) throw error

      // Refresh the list
      fetchAcceptedDonations()
      alert('Donation marked as completed! Thank you for helping reduce food waste.')
    } catch (error) {
      console.error('Error completing donation:', error)
      alert('Failed to complete donation. Please try again.')
    } finally {
      setCompleting(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTimeSinceAccepted = (acceptedAt: string | null) => {
    if (!acceptedAt) return ''
    
    const now = new Date()
    const accepted = new Date(acceptedAt)
    const diffHours = Math.floor((now.getTime() - accepted.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Just accepted'
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </div>
    )
  }

  const acceptedDonations = donations.filter(d => d.status === 'accepted')
  const completedDonations = donations.filter(d => d.status === 'completed')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Available Pickups</h1>
        <p className="text-gray-600">
          Help transport donated food from donors to shelters. These donations have been accepted by shelters
          and are ready for pickup. Contact the donor to coordinate pickup times.
        </p>
      </div>

      {/* Active Pickups */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Package className="h-5 w-5 mr-2 text-yellow-600" />
          Ready for Pickup ({acceptedDonations.length})
        </h2>
        {acceptedDonations.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-gray-100">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pickups available</h3>
            <p className="text-gray-600">Check back later for new pickup opportunities.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {acceptedDonations.map((donation) => (
              <div key={donation.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="font-medium text-gray-900">{donation.donor_name}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(donation.status)}`}>
                      {donation.status}
                    </span>
                    {donation.accepted_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        {getTimeSinceAccepted(donation.accepted_at)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-2">
                    <Package className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-600">
                      <span className="font-medium">{donation.quantity}</span>
                    </span>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-sm font-medium text-green-800 mb-1">
                      {donation.food_type}
                    </div>
                    <div className="text-xs text-green-600">
                      Ready for pickup
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600 leading-relaxed">
                      {donation.pickup_location}
                    </span>
                  </div>

                  {donation.notes && (
                    <div className="flex items-start space-x-2">
                      <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                        {donation.notes}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      Donated {formatDate(donation.created_at)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => getDirections(donation.pickup_coordinates, donation.pickup_location)}
                    className="w-full flex justify-center items-center space-x-2 py-2 px-4 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <Navigation className="h-4 w-4" />
                    <span>Get Directions</span>
                  </button>

                  <button
                    onClick={() => completeDonation(donation.id)}
                    disabled={completing === donation.id}
                    className="w-full flex justify-center items-center space-x-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {completing === donation.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Mark Complete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Pickups */}
      {completedDonations.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
            Recently Completed ({completedDonations.slice(0, 6).length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedDonations.slice(0, 6).map((donation) => (
              <div key={donation.id} className="bg-gray-50 rounded-xl border border-gray-100 p-6 opacity-75">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="font-medium text-gray-700">{donation.donor_name}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(donation.status)}`}>
                    completed
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {donation.quantity} of {donation.food_type}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      Completed {donation.completed_at ? formatDate(donation.completed_at) : 'Recently'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}