import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('🔧 [SUPABASE] Environment check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
  keyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'missing'
})

if (!supabaseUrl || !supabaseAnonKey || 
    supabaseUrl.includes('your-project-id') || 
    supabaseAnonKey.includes('your-anon-key-here')) {
  console.error('❌ [SUPABASE] Missing environment variables!')
  console.error('❌ [SUPABASE] Please check your .env file contains:')
  console.error('   VITE_SUPABASE_URL=your_supabase_url')
  console.error('   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key')
  console.error('❌ [SUPABASE] Make sure to replace placeholder values with actual credentials!')
  throw new Error('Missing or invalid Supabase environment variables. Please update your .env file with actual Supabase credentials.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

console.log('✅ [SUPABASE] Client initialized successfully')

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          user_type: 'donor' | 'shelter' | 'volunteer'
          phone: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          user_type: 'donor' | 'shelter' | 'volunteer'
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          user_type?: 'donor' | 'shelter' | 'volunteer'
          phone?: string | null
          created_at?: string
        }
      }
      donations: {
        Row: {
          id: string
          donor_name: string
          food_type: string
          quantity: string
          pickup_location: string
          pickup_coordinates: string | null
          status: 'pending' | 'accepted' | 'completed'
          shelter_id: string | null
          donor_id: string
          volunteer_id: string | null
          created_at: string
          accepted_at: string | null
          completed_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          donor_name: string
          food_type: string
          quantity: string
          pickup_location: string
          pickup_coordinates?: string | null
          status?: 'pending' | 'accepted' | 'completed'
          shelter_id?: string | null
          donor_id: string
          volunteer_id?: string | null
          created_at?: string
          accepted_at?: string | null
          completed_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          donor_name?: string
          food_type?: string
          quantity?: string
          pickup_location?: string
          pickup_coordinates?: string | null
          status?: 'pending' | 'accepted' | 'completed'
          shelter_id?: string | null
          donor_id?: string
          volunteer_id?: string | null
          created_at?: string
          accepted_at?: string | null
          completed_at?: string | null
          notes?: string | null
        }
      }
    }
  }
}

// Food classification function using AI
export const classifyFoodType = async (rawFoodInput: string): Promise<string> => {
  // Simple classification logic - in production, this would use an AI service
  const input = rawFoodInput.toLowerCase()
  
  if (input.includes('sandwich') || input.includes('burger') || input.includes('pizza') || 
      input.includes('soup') || input.includes('meal') || input.includes('cooked')) {
    return 'Prepared Meals'
  }
  
  if (input.includes('bread') || input.includes('cake') || input.includes('pastry') || 
      input.includes('donut') || input.includes('muffin')) {
    return 'Bakery Items'
  }
  
  if (input.includes('milk') || input.includes('cheese') || input.includes('yogurt') || 
      input.includes('dairy')) {
    return 'Dairy Products'
  }
  
  if (input.includes('apple') || input.includes('banana') || input.includes('vegetable') || 
      input.includes('fruit') || input.includes('produce')) {
    return 'Fresh Produce'
  }
  
  if (input.includes('can') || input.includes('jar') || input.includes('bottle') || 
      input.includes('packaged') || input.includes('box')) {
    return 'Packaged Foods'
  }
  
  if (input.includes('juice') || input.includes('soda') || input.includes('water') || 
      input.includes('drink') || input.includes('beverage')) {
    return 'Beverages'
  }
  
  return 'Other Food Items'
}

// Generate notification message
export const generateNotificationMessage = (donation: any, shelterName: string): string => {
  return `Hi ${donation.donor_name}, your donation of ${donation.quantity} ${donation.food_type} has been accepted by ${shelterName}. A volunteer will contact you soon for pickup!`
}

// Get coordinates from address (mock implementation)
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  // In production, this would use a real geocoding service like Google Maps API
  // For demo purposes, return mock coordinates
  const mockCoordinates = {
    'New York': { lat: 40.7128, lng: -74.0060 },
    'Los Angeles': { lat: 34.0522, lng: -118.2437 },
    'Chicago': { lat: 41.8781, lng: -87.6298 },
    'Houston': { lat: 29.7604, lng: -95.3698 },
    'Phoenix': { lat: 33.4484, lng: -112.0740 }
  }
  
  // Simple matching for demo
  for (const [city, coords] of Object.entries(mockCoordinates)) {
    if (address.toLowerCase().includes(city.toLowerCase())) {
      return coords
    }
  }
  
  // Default coordinates (San Francisco)
  return { lat: 37.7749, lng: -122.4194 }
}