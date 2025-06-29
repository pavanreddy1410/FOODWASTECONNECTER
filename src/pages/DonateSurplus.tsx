import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, classifyFoodType, geocodeAddress } from '../lib/supabase'
import { Heart, Package, User, CheckCircle, Loader } from 'lucide-react'
import LocationPicker from '../components/LocationPicker'

export default function DonateSurplus() {
  const { user, profile } = useAuth()
  const [formData, setFormData] = useState({
    donor_name: profile?.name || '',
    food_type: '',
    quantity: '',
    pickup_location: '',
    notes: '',
  })
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [submittedDonation, setSubmittedDonation] = useState<any>(null)
  const [classifying, setClassifying] = useState(false)

  const foodTypeOptions = [
    'Prepared Meals',
    'Bakery Items', 
    'Dairy Products',
    'Fresh Produce',
    'Packaged Foods',
    'Beverages',
    'Canned Goods',
    'Frozen Items',
    'Other Food Items',
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleLocationSelect = (location: string, coords?: { lat: number; lng: number }) => {
    setFormData(prev => ({ ...prev, pickup_location: location }))
    if (coords) {
      setCoordinates(coords)
    }
  }

  const classifyFood = async () => {
    if (!formData.food_type) return

    setClassifying(true)
    try {
      const classified = await classifyFoodType(formData.food_type)
      setFormData(prev => ({ ...prev, food_type: classified }))
    } catch (error) {
      console.error('Error classifying food:', error)
    } finally {
      setClassifying(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)

    try {
      // Get coordinates if not already available
      let finalCoordinates = coordinates
      if (!finalCoordinates && formData.pickup_location) {
        finalCoordinates = await geocodeAddress(formData.pickup_location)
      }

      const { data, error } = await supabase
        .from('donations')
        .insert({
          donor_name: formData.donor_name,
          food_type: formData.food_type,
          quantity: formData.quantity,
          pickup_location: formData.pickup_location,
          pickup_coordinates: finalCoordinates ? `(${finalCoordinates.lat},${finalCoordinates.lng})` : null,
          donor_id: user.id,
          status: 'pending',
          notes: formData.notes || null,
        })
        .select()
        .single()

      if (error) throw error

      setSubmittedDonation(data)
      setShowSuccessModal(true)
      
      // Reset form
      setFormData({
        donor_name: profile?.name || '',
        food_type: '',
        quantity: '',
        pickup_location: '',
        notes: '',
      })
      setCoordinates(null)
    } catch (error) {
      console.error('Error creating donation:', error)
      alert('Failed to submit donation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Donate Surplus Food</h1>
        <p className="text-gray-600">
          Help reduce food waste by sharing your surplus food with local shelters and food banks.
          Your donation will be visible to shelters in your area who can accept and arrange pickup.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div>
          <label htmlFor="donor_name" className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <User className="h-4 w-4 mr-2" />
            Donor Name
          </label>
          <input
            type="text"
            id="donor_name"
            name="donor_name"
            required
            value={formData.donor_name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="Enter your name or organization"
          />
        </div>

        <div>
          <label htmlFor="food_type" className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Package className="h-4 w-4 mr-2" />
            Food Type
          </label>
          <div className="flex space-x-2">
            <select
              id="food_type"
              name="food_type"
              required
              value={formData.food_type}
              onChange={handleInputChange}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select food type</option>
              {foodTypeOptions.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={classifyFood}
              disabled={!formData.food_type || classifying}
              className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {classifying ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                'AI Classify'
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Select the closest match or use AI to classify your food description
          </p>
        </div>

        <div>
          <label htmlFor="quantity" className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Package className="h-4 w-4 mr-2" />
            Quantity & Details
          </label>
          <input
            type="text"
            id="quantity"
            name="quantity"
            required
            value={formData.quantity}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="e.g., 50 sandwiches, 20 pounds of vegetables, 15 servings"
          />
          <p className="mt-1 text-xs text-gray-500">
            Be specific about quantity and include any relevant details (expiration, temperature requirements, etc.)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pickup Location
          </label>
          <LocationPicker
            onLocationSelect={handleLocationSelect}
            initialLocation={formData.pickup_location}
          />
          <p className="mt-1 text-xs text-gray-500">
            Provide the complete address where the food can be picked up
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="Any special instructions, dietary information, or pickup preferences..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <Heart className="h-5 w-5" />
              <span>Submit Donation</span>
            </>
          )}
        </button>
      </form>

      {/* Success Modal */}
      {showSuccessModal && submittedDonation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
              <p className="text-gray-600 mb-6">
                Thank you, {submittedDonation.donor_name}! Your donation of{' '}
                <span className="font-semibold">{submittedDonation.quantity}</span> of{' '}
                <span className="font-semibold">{submittedDonation.food_type}</span> has been posted 
                and is now visible to local shelters. You'll receive a notification when a shelter accepts your donation.
              </p>
              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-700">
                  <strong>What happens next:</strong>
                  <br />
                  1. Local shelters will see your donation
                  <br />
                  2. A shelter will accept your donation
                  <br />
                  3. A volunteer will contact you for pickup
                  <br />
                  4. Your food will help feed those in need!
                </p>
              </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}