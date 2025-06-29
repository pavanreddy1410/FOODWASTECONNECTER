import React, { useState, useEffect } from 'react'
import { MapPin, Search, Navigation } from 'lucide-react'

interface LocationPickerProps {
  onLocationSelect: (location: string, coordinates?: { lat: number; lng: number }) => void
  initialLocation?: string
  className?: string
}

export default function LocationPicker({ onLocationSelect, initialLocation = '', className = '' }: LocationPickerProps) {
  const [address, setAddress] = useState(initialLocation)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // Mock address suggestions for demo
  const mockSuggestions = [
    '123 Main Street, New York, NY 10001',
    '456 Oak Avenue, Los Angeles, CA 90210',
    '789 Pine Road, Chicago, IL 60601',
    '321 Elm Street, Houston, TX 77001',
    '654 Maple Drive, Phoenix, AZ 85001',
    '987 Cedar Lane, Philadelphia, PA 19101',
    '147 Birch Street, San Antonio, TX 78201',
    '258 Walnut Avenue, San Diego, CA 92101',
    '369 Cherry Road, Dallas, TX 75201',
    '741 Spruce Drive, San Jose, CA 95101'
  ]

  const handleAddressChange = (value: string) => {
    setAddress(value)
    
    if (value.length > 2) {
      const filtered = mockSuggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(value.toLowerCase())
      )
      setSuggestions(filtered.slice(0, 5))
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (suggestion: string) => {
    setAddress(suggestion)
    setShowSuggestions(false)
    onLocationSelect(suggestion, { lat: 40.7128, lng: -74.0060 }) // Mock coordinates
  }

  const getCurrentLocation = () => {
    setIsGettingLocation(true)
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          // In production, reverse geocode these coordinates to get address
          const mockAddress = `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
          setAddress(mockAddress)
          onLocationSelect(mockAddress, { lat: latitude, lng: longitude })
          setIsGettingLocation(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          alert('Unable to get your current location. Please enter address manually.')
          setIsGettingLocation(false)
        }
      )
    } else {
      alert('Geolocation is not supported by this browser.')
      setIsGettingLocation(false)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={address}
          onChange={(e) => handleAddressChange(e.target.value)}
          onBlur={() => {
            // Delay hiding suggestions to allow for clicks
            setTimeout(() => setShowSuggestions(false), 200)
          }}
          onFocus={() => {
            if (address.length > 2) setShowSuggestions(true)
          }}
          className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          placeholder="Enter pickup address..."
        />
        <button
          type="button"
          onClick={getCurrentLocation}
          disabled={isGettingLocation}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-green-600 transition-colors"
          title="Use current location"
        >
          {isGettingLocation ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
          ) : (
            <Navigation className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Address Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => selectSuggestion(suggestion)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center space-x-2">
                <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Mini Map Preview */}
      {address && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4 text-green-600" />
            <span>Selected location: {address}</span>
          </div>
          <div className="mt-2 h-24 bg-gray-200 rounded border flex items-center justify-center">
            <span className="text-xs text-gray-500">Map preview (demo)</span>
          </div>
        </div>
      )}
    </div>
  )
}