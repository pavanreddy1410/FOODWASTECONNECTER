import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, generateNotificationMessage } from '../lib/supabase'
import { MapPin, Package, Clock, User, CheckCircle, Phone, MessageSquare } from 'lucide-react'

interface Donation {
  id: string
  donor_name: string
  food_type: string
  quantity: string
  pickup_location: string
  pickup_coordinates: string | null
  status: string
  created_at: string
  notes: string | null
  donor_id: string
}

export default function IncomingRequests() {
  const { user, profile } = useAuth()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)

  useEffect(() => {
    fetchPendingDonations()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('pending-donations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'donations',
          filter: 'status=eq.pending',
        },
        () => {
          fetchPendingDonations()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchPendingDonations = async () => {
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDonations(data || [])
    } catch (error) {
      console.error('Error fetching donations:', error)
    } finally {
      setLoading(false)
    }
  }

  const acceptDonation = async (donationId: string, donation: Donation) => {
    if (!user || !profile) return

    setAccepting(donationId)

    try {
      const { error } = await supabase
        .from('donations')
        .update({
          status: 'accepted',
          shelter_id: user.id,
        })
        .eq('id', donationId)

      if (error) throw error

      // Generate and log notification message (in production, send via SMS/email/push)
      const message = generateNotificationMessage(donation, profile.name)
      console.log('Notification sent:', message)
      
      // Show success message
      alert(`Donation accepted! The donor ${donation.donor_name} has been notified that you've accepted their donation of ${donation.quantity} ${donation.food_type}.`)

      // Refresh the list
      fetchPendingDonations()
    } catch (error) {
      console.error('Error accepting donation:', error)
      alert('Failed to accept donation. Please try again.')
    } finally {
      setAccepting(null)
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

  const getMapUrl = (coordinates: string | null, address: string) => {
    if (coordinates) {
      const [lat, lng] = coordinates.replace(/[()]/g, '').split(',').map(Number)
      return `https://www.google.com/maps?q=${lat},${lng}`
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Incoming Food Donations</h1>
        <p className="text-gray-600">
          Review and accept food donations from local donors in your area. When you accept a donation,
          the donor will be notified and volunteers will be able to arrange pickup.
        </p>
      </div>

      {donations.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pending donations</h3>
          <p className="text-gray-600">Check back later for new food donation requests from local donors.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {donations.map((donation) => (
            <div key={donation.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900">{donation.donor_name}</span>
                </div>
                <span className="text-xs text-gray-500 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDate(donation.created_at)}
                </span>
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
                    Food category
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm text-gray-600 leading-relaxed">
                      {donation.pickup_location}
                    </span>
                    <a
                      href={getMapUrl(donation.pickup_coordinates, donation.pickup_location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-blue-600 hover:text-blue-700 mt-1"
                    >
                      View on map →
                    </a>
                  </div>
                </div>

                {donation.notes && (
                  <div className="flex items-start space-x-2">
                    <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                      {donation.notes}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => acceptDonation(donation.id, donation)}
                disabled={accepting === donation.id}
                className="w-full flex justify-center items-center space-x-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {accepting === donation.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Accept Donation</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}