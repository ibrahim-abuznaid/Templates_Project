import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;

// Store user socket connections
const userSockets = new Map(); // userId -> Set of socketIds

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true
    }
  });

  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`🔌 Socket connected: User ${userId} (${socket.id})`);

    // Track user's socket connection
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join user-specific room for targeted notifications
    socket.join(`user:${userId}`);

    // Join role-based room (admin or freelancer)
    socket.join(`role:${socket.userRole}`);

    // Handle joining an idea's room (for real-time updates on idea detail page)
    socket.on('join:idea', (ideaId) => {
      socket.join(`idea:${ideaId}`);
      console.log(`👁️ User ${userId} watching idea ${ideaId}`);
    });

    socket.on('leave:idea', (ideaId) => {
      socket.leave(`idea:${ideaId}`);
      console.log(`👋 User ${userId} stopped watching idea ${ideaId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: User ${userId} (${socket.id})`);
      
      // Remove socket from user's connections
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
        }
      }
    });
  });

  console.log('🔌 Socket.IO initialized');
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Helper functions to emit events

// Send notification to a specific user
export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
    console.log(`📤 Emitted ${event} to user ${userId}`);
  }
};

// Send to all connected users
export const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
    console.log(`📤 Emitted ${event} to all users`);
  }
};

// Send to users watching a specific idea
export const emitToIdea = (ideaId, event, data) => {
  if (io) {
    io.to(`idea:${ideaId}`).emit(event, data);
    console.log(`📤 Emitted ${event} to idea ${ideaId} watchers`);
  }
};

// Send to all admins
export const emitToAdmins = (event, data) => {
  if (io) {
    io.to('role:admin').emit(event, data);
    console.log(`📤 Emitted ${event} to all admins`);
  }
};

// Send to all freelancers
export const emitToFreelancers = (event, data) => {
  if (io) {
    io.to('role:freelancer').emit(event, data);
    console.log(`📤 Emitted ${event} to all freelancers`);
  }
};

// Check if a user is currently online
export const isUserOnline = (userId) => {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
};

export default {
  initializeSocket,
  getIO,
  emitToUser,
  emitToAll,
  emitToIdea,
  emitToAdmins,
  emitToFreelancers,
  isUserOnline
};

