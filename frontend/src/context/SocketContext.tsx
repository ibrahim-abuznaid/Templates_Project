import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Idea, Notification } from '../types';

// Socket event types
export interface SocketEvents {
  // Notification events
  'notification:new': (notification: Notification) => void;
  'notification:count': (data: { count: number }) => void;
  
  // Idea events
  'idea:created': (idea: Idea) => void;
  'idea:updated': (idea: Idea) => void;
  'idea:deleted': (data: { id: number }) => void;
  'idea:assigned': (idea: Idea) => void;
  
  // Comment events
  'comment:new': (data: { ideaId: number; comment: any }) => void;
  
  // Blocker events
  'blocker:created': (data: any) => void;
  'blocker:updated': (data: any) => void;
  
  // Connection events
  'connect': () => void;
  'disconnect': () => void;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  
  // Subscribe to events
  subscribe: <K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]) => () => void;
  
  // Join/leave idea rooms (for real-time updates on specific idea)
  joinIdea: (ideaId: number) => void;
  leaveIdea: (ideaId: number) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Get socket server URL
const getSocketURL = () => {
  // Use environment variable or default to same origin (for proxy) or explicit backend URL
  if (import.meta.env.VITE_API_URL) {
    // Extract base URL from API URL (remove /api suffix if present)
    const apiUrl = import.meta.env.VITE_API_URL as string;
    return apiUrl.replace('/api', '');
  }
  // In production, use same origin (Nginx proxies /socket.io/ to backend)
  // In development without VITE_API_URL, use localhost
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(false);
  // Store pending subscriptions for when socket connects
  const pendingSubscriptions = useRef<Map<string, Set<Function>>>(new Map());

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // Only connect if user is authenticated
    if (!token) {
      return;
    }

    // Prevent double connection in StrictMode
    if (socketRef.current?.connected) {
      return;
    }

    const socketURL = getSocketURL();
    
    // Small delay to handle React StrictMode double-mount
    const connectTimeout = setTimeout(() => {
      if (mountedRef.current === false) {
        mountedRef.current = true;
        
        console.log('🔌 Connecting to socket server:', socketURL);

        const newSocket = io(socketURL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        newSocket.on('connect', () => {
          console.log('✅ Socket connected:', newSocket.id);
          setIsConnected(true);
          
          // Apply any pending subscriptions
          pendingSubscriptions.current.forEach((callbacks, eventName) => {
            callbacks.forEach(cb => {
              newSocket.on(eventName, cb as any);
            });
          });
          console.log('📬 Applied pending subscriptions:', pendingSubscriptions.current.size, 'event types');
        });

        newSocket.on('disconnect', (reason) => {
          console.log('❌ Socket disconnected:', reason);
          setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
          console.error('🔴 Socket connection error:', error.message);
          setIsConnected(false);
        });

        // Handle reconnection - reapply subscriptions
        newSocket.on('reconnect', () => {
          console.log('🔄 Socket reconnected');
          setIsConnected(true);
          
          // Reapply subscriptions after reconnection
          pendingSubscriptions.current.forEach((callbacks, eventName) => {
            callbacks.forEach(cb => {
              newSocket.on(eventName, cb as any);
            });
          });
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
      }
    }, 100);

    // Cleanup on unmount
    return () => {
      clearTimeout(connectTimeout);
      // Only close on actual unmount, not StrictMode re-render
      if (mountedRef.current && socketRef.current) {
        console.log('🔌 Cleaning up socket connection');
        socketRef.current.close();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
        mountedRef.current = false;
      }
    };
  }, []); // Only run on mount

  // Re-connect when token changes (login/logout from another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (!e.newValue && socketRef.current) {
          // User logged out - disconnect
          console.log('🔌 Token removed, disconnecting socket');
          socketRef.current.close();
          socketRef.current = null;
          setSocket(null);
          setIsConnected(false);
          mountedRef.current = false;
        }
        // For login, a page reload typically happens, so no need to handle here
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Subscribe to socket events - handles both connected and not-yet-connected states
  const subscribe = useCallback(<K extends keyof SocketEvents>(
    event: K,
    callback: SocketEvents[K]
  ): (() => void) => {
    const eventName = event as string;
    const cb = callback as Function;

    // If socket is ready, subscribe immediately
    if (socketRef.current?.connected) {
      socketRef.current.on(eventName, cb as any);
    }
    
    // Also store in pending subscriptions (for reconnection handling)
    if (!pendingSubscriptions.current.has(eventName)) {
      pendingSubscriptions.current.set(eventName, new Set());
    }
    pendingSubscriptions.current.get(eventName)!.add(cb);
    
    // Return cleanup function
    return () => {
      socketRef.current?.off(eventName, cb as any);
      pendingSubscriptions.current.get(eventName)?.delete(cb);
    };
  }, []);

  // Join idea room for real-time updates
  const joinIdea = useCallback((ideaId: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:idea', ideaId);
    }
  }, []);

  // Leave idea room
  const leaveIdea = useCallback((ideaId: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave:idea', ideaId);
    }
  }, []);

  const value: SocketContextType = {
    socket,
    isConnected,
    subscribe,
    joinIdea,
    leaveIdea,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// Custom hooks for common socket subscriptions

// Hook to get real-time notification count
export const useNotificationSocket = (onNewNotification?: (notification: Notification) => void) => {
  const { subscribe, isConnected } = useSocket();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    const unsubCount = subscribe('notification:count', (data) => {
      setUnreadCount(data.count);
    });

    const unsubNew = subscribe('notification:new', (notification) => {
      setUnreadCount(prev => (prev ?? 0) + 1);
      onNewNotification?.(notification);
    });

    return () => {
      unsubCount();
      unsubNew();
    };
  }, [subscribe, onNewNotification]);

  return { unreadCount, isConnected };
};

// Hook to get real-time idea updates
export const useIdeaSocket = (callbacks?: {
  onCreated?: (idea: Idea) => void;
  onUpdated?: (idea: Idea) => void;
  onDeleted?: (data: { id: number }) => void;
  onAssigned?: (idea: Idea) => void;
}) => {
  const { subscribe, isConnected } = useSocket();

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    if (callbacks?.onCreated) {
      unsubs.push(subscribe('idea:created', callbacks.onCreated));
    }
    if (callbacks?.onUpdated) {
      unsubs.push(subscribe('idea:updated', callbacks.onUpdated));
    }
    if (callbacks?.onDeleted) {
      unsubs.push(subscribe('idea:deleted', callbacks.onDeleted));
    }
    if (callbacks?.onAssigned) {
      unsubs.push(subscribe('idea:assigned', callbacks.onAssigned));
    }

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [subscribe, callbacks?.onCreated, callbacks?.onUpdated, callbacks?.onDeleted, callbacks?.onAssigned]);

  return { isConnected };
};

export default SocketContext;

