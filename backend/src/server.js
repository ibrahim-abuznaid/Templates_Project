import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './database/db.js';
import { initPostgresDatabase } from './database/db-postgres.js';
import authRoutes from './routes/auth.js';
import ideasRoutes from './routes/ideas.js';
import viewsRoutes from './routes/views.js';
import notificationsRoutes from './routes/notifications.js';
import invoicesRoutes from './routes/invoices.js';
import blockersRoutes from './routes/blockers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Initialize database (PostgreSQL for production, SQLite for development)
if (process.env.DATABASE_URL) {
  console.log('🚀 Production mode: Using PostgreSQL database');
  initPostgresDatabase();
} else {
  console.log('💻 Development mode: Using SQLite database');
  initDatabase();
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/views', viewsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/blockers', blockersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server with graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`\n💡 Default login credentials:`);
  console.log(`   Admin: admin / admin123`);
  console.log(`   Freelancer: freelancer / freelancer123\n`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Closing server gracefully...`);
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force close after 5 seconds
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

