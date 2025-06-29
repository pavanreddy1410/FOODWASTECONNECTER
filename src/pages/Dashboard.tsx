import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Heart, Plus, Inbox, MapPin, Users, Utensils, TrendingUp, Clock } from 'lucide-react'

interface DashboardStats {
  totalDonations: number
  activeDonations: number
  completedDonations: number
  userDonations?: number
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalDonations: 0,
    activeDonations: 0,
    completedDonations: 0,
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [profile])

  const fetchDashboardData = async () => {
    try {
      // Fetch overall stats
      const { data: allDonations, error: donationsError } = await supabase
        .from('donations')
        .select('status, created_at, donor_id')

      if (donationsError) throw donationsError

      const totalDonations = allDonations?.length || 0
      const activeDonations = allDonations?.filter(d => d.status === 'pending' || d.status === 'accepted').length || 0
      const completedDonations = allDonations?.filter(d => d.status === 'completed').length || 0
      const userDonations = profile ? allDonations?.filter(d => d.donor_id === profile.id).length || 0 : 0

      setStats({
        totalDonations,
        activeDonations,
        completedDonations,
        userDonations,
      })

      // Fetch recent activity based on user type
      let activityQuery = supabase
        .from('donations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (profile?.user_type === 'donor') {
        activityQuery = activityQuery.eq('donor_id', profile.id)
      } else if (profile?.user_type === 'shelter') {
        activityQuery = activityQuery.or('status.eq.pending,shelter_id.eq.' + profile.id)
      } else if (profile?.user_type === 'volunteer') {
        activityQuery = activityQuery.in('status', ['accepted', 'completed'])
      }

      const { data: activity, error: activityError } = await activityQuery

      if (activityError) throw activityError
      setRecentActivity(activity || [])

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getQuickActions = () => {
    switch (profile?.user_type) {
      case 'donor':
        return [
          {
            title: 'Donate Food',
            description: 'Share surplus food with those in need',
            icon: Plus,
            href: '/donate',
            color: 'bg-green-500 hover:bg-green-600',
          },
        ]
      case 'shelter':
        return [
          {
            title: 'View Requests',
            description: 'See available food donations',
            icon: Inbox,
            href: '/requests',
            color: 'bg-blue-500 hover:bg-blue-600',
          },
        ]
      case 'volunteer':
        return [
          {
            title: 'My Pickups',
            description: 'Manage your pickup assignments',
            icon: MapPin,
            href: '/pickups',
            color: 'bg-purple-500 hover:bg-purple-600',
          },
        ]
      default:
        return []
    }
  }

  const getStatsForUserType = () => {
    const baseStats = [
      { name: 'Total Donations', value: stats.totalDonations.toString(), icon: Utensils, color: 'text-green-600' },
      { name: 'Active Donations', value: stats.activeDonations.toString(), icon: TrendingUp, color: 'text-blue-600' },
      { name: 'Completed', value: stats.completedDonations.toString(), icon: Heart, color: 'text-red-600' },
    ]

    if (profile?.user_type === 'donor' && stats.userDonations !== undefined) {
      baseStats[0] = { name: 'My Donations', value: stats.userDonations.toString(), icon: Utensils, color: 'text-green-600' }
    }

    return baseStats
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
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'accepted':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {profile?.name}!
        </h1>
        <p className="text-gray-600">
          {profile?.user_type === 'donor' && 'Ready to share surplus food with your community?'}
          {profile?.user_type === 'shelter' && 'Check for new food donations in your area.'}
          {profile?.user_type === 'volunteer' && 'See your pickup assignments and help transport food.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {getStatsForUserType().map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center">
              <div className={`p-3 rounded-full bg-gray-50 ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {getQuickActions().map((action) => (
              <Link
                key={action.title}
                to={action.href}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-full ${action.color} text-white transition-colors`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{action.title}</h3>
                <p className="text-gray-600 text-sm">{action.description}</p>
              </Link>
            ))}

            {/* Community Impact Card */}
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border border-green-100">
              <div className="flex items-center mb-4">
                <Heart className="h-6 w-6 text-green-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Community Impact</h3>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                Together we're reducing food waste and helping feed those in need in our community.
              </p>
              <div className="text-2xl font-bold text-green-600">
                {profile?.user_type === 'donor' && '🍽️ Share More'}
                {profile?.user_type === 'shelter' && '🏠 Help More'}
                {profile?.user_type === 'volunteer' && '🚚 Deliver More'}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start space-x-3 pb-4 border-b border-gray-100 last:border-b-0">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Utensils className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {item.donor_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {item.quantity} of {item.food_type}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}