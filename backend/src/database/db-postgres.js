import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';

let pool;

export function initPostgresDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set');
    throw new Error('DATABASE_URL is required for PostgreSQL');
  }

  console.log('🔌 Connecting to PostgreSQL database...');

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Test connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Failed to connect to PostgreSQL:', err);
    } else {
      console.log('✅ PostgreSQL connected successfully');
      initializeSchema();
    }
  });

  return pool;
}

async function initializeSchema() {
  const schema = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'freelancer')),
      email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Ideas/Templates table
    CREATE TABLE IF NOT EXISTS ideas (
      id SERIAL PRIMARY KEY,
      use_case TEXT,
      department VARCHAR(100),
      flow_name TEXT,
      short_description TEXT,
      description TEXT,
      setup_guide TEXT,
      tags TEXT,
      template_url TEXT,
      scribe_url TEXT,
      reviewer_name VARCHAR(255),
      price DECIMAL(10, 2),
      status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'submitted', 'needs_fixes', 'reviewed', 'published')),
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Comments table
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Activity log table
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(255) NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Invoices table
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
      freelancer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      amount DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Blockers table
    CREATE TABLE IF NOT EXISTS blockers (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      severity VARCHAR(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    );

    -- Views table (for analytics)
    CREATE TABLE IF NOT EXISTS views (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      view_date DATE DEFAULT CURRENT_DATE,
      view_count INTEGER DEFAULT 1,
      UNIQUE(idea_id, user_id, view_date)
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
    CREATE INDEX IF NOT EXISTS idx_ideas_assigned_to ON ideas(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_ideas_created_by ON ideas(created_by);
    CREATE INDEX IF NOT EXISTS idx_comments_idea_id ON comments(idea_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_idea_id ON activity_log(idea_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_blockers_idea_id ON blockers(idea_id);
  `;

  try {
    await pool.query(schema);
    console.log('✅ PostgreSQL schema initialized');
    
    // Seed default users if they don't exist
    await seedDefaultUsers();
  } catch (err) {
    console.error('❌ Error creating PostgreSQL schema:', err);
    throw err;
  }
}

async function seedDefaultUsers() {
  try {
    // Check if users exist
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(result.rows[0].count);

    if (userCount === 0) {
      console.log('📝 Seeding default users...');

      const adminPassword = await bcrypt.hash('admin123', 10);
      const freelancerPassword = await bcrypt.hash('freelancer123', 10);

      await pool.query(
        'INSERT INTO users (username, password, role, email) VALUES ($1, $2, $3, $4)',
        ['admin', adminPassword, 'admin', 'admin@example.com']
      );

      await pool.query(
        'INSERT INTO users (username, password, role, email) VALUES ($1, $2, $3, $4)',
        ['freelancer', freelancerPassword, 'freelancer', 'freelancer@example.com']
      );

      console.log('✅ Default users created:');
      console.log('   Admin: admin / admin123');
      console.log('   Freelancer: freelancer / freelancer123');
    } else {
      console.log(`ℹ️  Database already has ${userCount} user(s)`);
    }
  } catch (err) {
    console.error('❌ Error seeding default users:', err);
  }
}

export function getPostgresPool() {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Call initPostgresDatabase() first.');
  }
  return pool;
}

// Helper function to convert PostgreSQL result to SQLite-like format
export function queryPostgres(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.rows);
      }
    });
  });
}

// Close pool gracefully
export async function closePostgresPool() {
  if (pool) {
    await pool.end();
    console.log('✅ PostgreSQL connection pool closed');
  }
}

