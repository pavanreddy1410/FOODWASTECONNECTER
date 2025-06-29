import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Bell, X, CheckCircle, AlertCircle, Info } from 'lucide-react'

interface Notification {
  id: string
  type: 'success' | 'info' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

export default function NotificationSystem() {
  const { user, profile } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (!user || !profile) return

    // Subscribe to real-time changes for donations
    const subscription = supabase
      .channel('donation-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'donations',
        },
        (payload) => {
          handleDonationChange(payload)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, profile])

  const handleDonationChange = (payload: any) => {
    if (!profile) return

    const { eventType, new: newRecord, old: oldRecord } = payload

    let notification: Notification | null = null

    if (eventType === 'INSERT' && profile.user_type === 'shelter') {
      // New donation available for shelters
      notification = {
        id: `donation-${newRecord.id}`,
        type: 'info',
        title: 'New Donation Available',
        message: `${newRecord.donor_name} has donated ${newRecord.quantity} of ${newRecord.food_type}`,
        timestamp: new Date(),
        read: false,
      }
    } else if (eventType === 'UPDATE' && oldRecord?.status !== newRecord?.status) {
      if (newRecord.status === 'accepted' && newRecord.donor_id === user?.id) {
        // Donation accepted - notify donor
        notification = {
          id: `accepted-${newRecord.id}`,
          type: 'success',
          title: 'Donation Accepted!',
          message: `Your donation of ${newRecord.quantity} ${newRecord.food_type} has been accepted by a shelter.`,
          timestamp: new Date(),
          read: false,
        }
      } else if (newRecord.status === 'completed' && newRecord.donor_id === user?.id) {
        // Donation completed - notify donor
        notification = {
          id: `completed-${newRecord.id}`,
          type: 'success',
          title: 'Donation Completed!',
          message: `Your donation of ${newRecord.quantity} ${newRecord.food_type} has been successfully delivered.`,
          timestamp: new Date(),
          read: false,
        }
      } else if (newRecord.status === 'accepted' && profile.user_type === 'volunteer') {
        // New pickup available for volunteers
        notification = {
          id: `pickup-${newRecord.id}`,
          type: 'info',
          title: 'New Pickup Available',
          message: `Pickup needed: ${newRecord.quantity} of ${newRecord.food_type} from ${newRecord.donor_name}`,
          timestamp: new Date(),
          read: false,
        }
      }
    }

    if (notification) {
      setNotifications(prev => [notification!, ...prev.slice(0, 9)]) // Keep last 10 notifications
    }
  }

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
  }

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-green-600 transition-colors"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 last:border-b-0 ${
                    !notification.read ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {getIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {notification.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex space-x-1">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-blue-600 hover:text-blue-700 text-xs"
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={() => clearNotification(notification.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={() => setNotifications([])}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}