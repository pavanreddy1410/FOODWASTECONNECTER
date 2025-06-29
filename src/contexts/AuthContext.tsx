import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UserProfile {
  id: string
  name: string
  user_type: 'donor' | 'shelter' | 'volunteer'
  email: string
  phone: string | null
  created_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signUp: (email: string, password: string, name: string, userType: 'donor' | 'shelter' | 'volunteer', phone?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  createMissingProfile: (name: string, userType: 'donor' | 'shelter' | 'volunteer', phone?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('🔄 [AUTH] Initializing authentication...')
        
        // Check Supabase connection first with shorter timeout
        const connectionTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection test timeout')), 5000)
        })

        const connectionTest = supabase
          .from('profiles')
          .select('count')
          .limit(1)

        try {
          const { error: connectionError } = await Promise.race([connectionTest, connectionTimeout]) as any

          if (connectionError) {
            console.error('❌ [AUTH] Database connection failed:', connectionError)
            console.error('❌ [AUTH] Please check your Supabase environment variables')
            if (mounted) {
              setUser(null)
              setProfile(null)
              setLoading(false)
            }
            return
          }

          console.log('✅ [AUTH] Database connection successful')
        } catch (error: any) {
          if (error.message === 'Connection test timeout') {
            console.error('❌ [AUTH] Database connection timeout - continuing without profile')
            if (mounted) {
              setUser(null)
              setProfile(null)
              setLoading(false)
            }
            return
          }
          throw error
        }

        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('❌ [AUTH] Session error:', sessionError)
          if (mounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
          return
        }

        console.log('📋 [AUTH] Session check:', session?.user?.id ? `✅ User found: ${session.user.id}` : '❌ No session')

        if (mounted) {
          setUser(session?.user ?? null)
        }

        if (session?.user && mounted) {
          console.log('👤 [AUTH] User authenticated, fetching profile...')
          await fetchProfile(session.user.id)
        } else if (mounted) {
          console.log('🏁 [AUTH] No user found, authentication complete')
          setLoading(false)
        }
      } catch (error) {
        console.error('💥 [AUTH] Critical error during initialization:', error)
        if (mounted) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        console.log('🔄 [AUTH] State change detected:', event, session?.user?.id || 'no user')
        
        setUser(session?.user ?? null)
        
        if (session?.user) {
          console.log('👤 [AUTH] User state changed, fetching profile...')
          await fetchProfile(session.user.id)
        } else {
          console.log('🚪 [AUTH] User signed out, clearing profile')
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = async (userId: string, retryCount = 0) => {
    const maxRetries = 2
    const timeoutDuration = 60000 // Increased from 30 seconds to 60 seconds

    try {
      console.log(`🔍 [PROFILE] Starting profile fetch for user: ${userId} (attempt ${retryCount + 1}/${maxRetries + 1})`)
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), timeoutDuration)
      })

      // Create profile fetch promise with AbortController for better cleanup
      const controller = new AbortController()
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .abortSignal(controller.signal)
        .maybeSingle()

      // Race the promises
      const { data, error } = await Promise.race([
        profilePromise,
        timeoutPromise.then(() => {
          controller.abort()
          throw new Error('Profile fetch timeout')
        })
      ]) as any

      console.log('📊 [PROFILE] Query completed:', { 
        hasData: !!data, 
        error: error?.message || 'none',
        errorCode: error?.code || 'none'
      })

      if (error) {
        console.error('❌ [PROFILE] Database error:', error)
        
        if (error.code === 'PGRST116' || error.message?.includes('no rows')) {
          console.log('ℹ️ [PROFILE] No profile found - user needs to complete setup')
          setProfile(null)
        } else {
          console.error('💥 [PROFILE] Unexpected database error:', error)
          setProfile(null)
        }
      } else if (data) {
        console.log('✅ [PROFILE] Profile loaded successfully:', data.name, `(${data.user_type})`)
        setProfile(data)
      } else {
        console.log('ℹ️ [PROFILE] No profile data returned - user needs setup')
        setProfile(null)
      }
    } catch (error: any) {
      console.error(`💥 [PROFILE] Exception during fetch (attempt ${retryCount + 1}):`, error.message)
      
      // Retry logic for timeout errors
      if (error.message === 'Profile fetch timeout' && retryCount < maxRetries) {
        console.log(`🔄 [PROFILE] Retrying profile fetch in 2 seconds... (${retryCount + 1}/${maxRetries})`)
        
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Retry the fetch
        return fetchProfile(userId, retryCount + 1)
      }
      
      // If all retries failed or it's not a timeout error, set profile to null
      console.error('❌ [PROFILE] All retry attempts failed or non-timeout error occurred')
      setProfile(null)
    } finally {
      console.log('🏁 [PROFILE] Profile fetch complete, setting loading to false')
      setLoading(false)
    }
  }

  const createMissingProfile = async (name: string, userType: 'donor' | 'shelter' | 'volunteer', phone?: string) => {
    if (!user) {
      console.error('❌ [PROFILE] Cannot create profile: no user logged in')
      throw new Error('No user logged in')
    }

    try {
      console.log('🔨 [PROFILE] Creating profile for user:', user.id)
      setLoading(true)

      const profileData = {
        id: user.id,
        email: user.email || '',
        name,
        user_type: userType,
        phone: phone || null,
      }

      console.log('📝 [PROFILE] Profile data:', profileData)

      const { data, error } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      if (error) {
        console.error('❌ [PROFILE] Creation failed:', error)
        throw new Error(`Failed to create profile: ${error.message}`)
      }

      console.log('✅ [PROFILE] Profile created successfully:', data)
      setProfile(data)
    } catch (error: any) {
      console.error('💥 [PROFILE] Create profile error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, name: string, userType: 'donor' | 'shelter' | 'volunteer', phone?: string) => {
    try {
      console.log('🚀 [AUTH] Starting signup process for:', email)
      setLoading(true)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        console.error('❌ [AUTH] Signup failed:', error)
        throw error
      }

      console.log('✅ [AUTH] User created:', data.user?.id)

      if (data.user) {
        console.log('🔨 [PROFILE] Creating initial profile...')
        const profileData = {
          id: data.user.id,
          email,
          name,
          user_type: userType,
          phone: phone || null,
        }

        const { data: profileResult, error: profileError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select()
          .single()

        if (profileError) {
          console.error('❌ [PROFILE] Profile creation failed:', profileError)
          throw new Error(`Failed to create profile: ${profileError.message}`)
        }

        console.log('✅ [PROFILE] Initial profile created:', profileResult)
        setProfile(profileResult)
      }
    } catch (error: any) {
      console.error('💥 [AUTH] Signup error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔑 [AUTH] Starting signin for:', email)
      setLoading(true)
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ [AUTH] Signin failed:', error)
        throw error
      }

      console.log('✅ [AUTH] Signin successful')
    } catch (error: any) {
      console.error('💥 [AUTH] Signin error:', error)
      setLoading(false)
      throw error
    }
  }

  const signOut = async () => {
    try {
      console.log('🚪 [AUTH] Starting sign out process...')
      
      // Clear local state immediately to provide instant feedback
      setUser(null)
      setProfile(null)
      
      // Call Supabase signOut
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ [AUTH] Supabase signout error:', error)
        // Even if there's an error, we've already cleared local state
        // This handles cases where the session might be invalid
        console.log('⚠️ [AUTH] Continuing with local signout despite error')
      } else {
        console.log('✅ [AUTH] Supabase signout successful')
      }
      
      // Ensure we're in a clean state
      setLoading(false)
      console.log('🏁 [AUTH] Sign out process complete')
      
    } catch (error: any) {
      console.error('💥 [AUTH] Sign out exception:', error)
      // Even if there's an exception, ensure we clear the local state
      setUser(null)
      setProfile(null)
      setLoading(false)
      console.log('🔄 [AUTH] Local state cleared despite exception')
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in')

    try {
      console.log('🔄 [PROFILE] Updating profile...')
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (error) throw error

      console.log('✅ [PROFILE] Profile updated, refreshing...')
      await fetchProfile(user.id)
    } catch (error: any) {
      console.error('💥 [PROFILE] Update error:', error)
      throw error
    }
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    createMissingProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}