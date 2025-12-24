import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../services/api';
import { useSocket } from '../context/SocketContext';
import type { Notification } from '../types';
import { Bell, X, Check, CheckCheck, Trash2, AtSign, RefreshCw, AlertCircle, BellRing, BellOff } from 'lucide-react';

// Create notification sound
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a pleasant notification sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Two-tone notification sound
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1); // C#6
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('Could not play notification sound');
  }
};

// Check if browser supports notifications
const supportsNotifications = () => {
  return 'Notification' in window;
};

// Request permission for browser notifications
const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!supportsNotifications()) {
    console.log('Browser does not support notifications');
    return 'denied';
  }
  
  const permission = await Notification.requestPermission();
  return permission;
};

// Show browser notification
const showBrowserNotification = (title: string, body: string, ideaId?: number) => {
  if (!supportsNotifications() || Notification.permission !== 'granted') {
    return;
  }
  
  // Only show if tab is not focused
  if (document.hasFocus()) {
    return;
  }
  
  const notification = new Notification(title, {
    body,
    icon: '/activepieces.webp',
    badge: '/activepieces.webp',
    tag: ideaId ? `idea-${ideaId}` : 'notification',
    requireInteraction: false,
  });
  
  // Click to focus the tab and navigate to the idea
  notification.onclick = () => {
    window.focus();
    if (ideaId) {
      window.location.href = `/ideas/${ideaId}`;
    }
    notification.close();
  };
  
  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
};

const NotificationsInbox: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>(
    supportsNotifications() ? Notification.permission : 'denied'
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { subscribe, isConnected } = useSocket();

  // Initial load
  useEffect(() => {
    loadUnreadCount();
    // Check notification permission on mount
    if (supportsNotifications()) {
      setDesktopPermission(Notification.permission);
    }
  }, []);

  // Subscribe to real-time notification events
  useEffect(() => {
    // When we get a new notification
    const unsubNew = subscribe('notification:new', (notification) => {
      console.log('📬 New notification received:', notification);
      setUnreadCount(prev => prev + 1);
      setHasNewNotification(true);
      
      // Play notification sound
      playNotificationSound();
      
      // Show browser/desktop notification
      showBrowserNotification(
        notification.title || 'New Notification',
        notification.message || '',
        notification.idea_id ?? undefined
      );
      
      // If dropdown is open, add the new notification to the list
      setNotifications(prev => {
        // Check if notification already exists
        if (prev.some(n => n.id === notification.id)) {
          return prev;
        }
        return [notification, ...prev];
      });
      
      // Clear the "new" indicator after 3 seconds
      setTimeout(() => setHasNewNotification(false), 3000);
    });

    // When we get a count update
    const unsubCount = subscribe('notification:count', (data) => {
      console.log('📊 Notification count updated:', data.count);
      setUnreadCount(data.count);
    });

    return () => {
      unsubNew();
      unsubCount();
    };
  }, [subscribe]);

  // Fallback polling only when socket is disconnected
  useEffect(() => {
    if (!isConnected) {
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const response = await notificationsApi.getUnreadCount();
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationsApi.getAll();
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      loadNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.delete(id);
      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.idea_id) {
      navigate(`/ideas/${notification.idea_id}`);
      setIsOpen(false);
      if (!notification.read_at) {
        notificationsApi.markAsRead(notification.id);
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  };

  const handleEnableDesktopNotifications = async () => {
    const permission = await requestNotificationPermission();
    setDesktopPermission(permission);
    
    if (permission === 'granted') {
      // Show a test notification
      new Notification('Desktop Notifications Enabled', {
        body: 'You will now receive notifications even when this tab is not focused.',
        icon: '/activepieces.webp',
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return <AtSign className="w-4 h-4 text-blue-500" />;
      case 'status_change':
        return <RefreshCw className="w-4 h-4 text-purple-500" />;
      case 'assignment':
        return <AlertCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className={`relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all ${
          hasNewNotification ? 'animate-pulse ring-2 ring-blue-400' : ''
        }`}
      >
        <Bell className={`w-5 h-5 ${hasNewNotification ? 'text-blue-600' : ''}`} />
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center transition-all ${
            hasNewNotification ? 'bg-blue-500 scale-125 animate-bounce' : 'bg-red-500'
          }`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
            
            {/* Desktop Notifications Toggle */}
            {supportsNotifications() && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                {desktopPermission === 'granted' ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <BellRing className="w-4 h-4" />
                    <span>Desktop notifications enabled</span>
                  </div>
                ) : desktopPermission === 'denied' ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <BellOff className="w-4 h-4" />
                    <span>Desktop notifications blocked</span>
                  </div>
                ) : (
                  <button
                    onClick={handleEnableDesktopNotifications}
                    className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                  >
                    <BellRing className="w-4 h-4" />
                    <span>Enable desktop notifications</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.read_at ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.read_at ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{notification.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatTime(notification.created_at)}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      {!notification.read_at && (
                        <button
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                          className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-green-600"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(notification.id, e)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsInbox;

