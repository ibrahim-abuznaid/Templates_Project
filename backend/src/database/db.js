import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, '../../data/database.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initDatabase() {
  // Users table with handle
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      handle TEXT UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('admin', 'freelancer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Invitations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      token TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'freelancer')),
      invited_by INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      accepted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invited_by) REFERENCES users(id)
    )
  `);

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      idea_id INTEGER,
      from_user_id INTEGER,
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id)
    )
  `);

  // Invoices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      freelancer_id INTEGER NOT NULL,
      invoice_number TEXT UNIQUE NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid')),
      period_start DATETIME NOT NULL,
      period_end DATETIME NOT NULL,
      paid_at DATETIME,
      paid_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (freelancer_id) REFERENCES users(id),
      FOREIGN KEY (paid_by) REFERENCES users(id)
    )
  `);

  // Invoice items table (templates completed in billing period)
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      freelancer_id INTEGER NOT NULL,
      idea_id INTEGER NOT NULL,
      idea_title TEXT NOT NULL,
      amount REAL NOT NULL,
      completed_at DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'invoiced', 'paid')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
      FOREIGN KEY (freelancer_id) REFERENCES users(id),
      FOREIGN KEY (idea_id) REFERENCES ideas(id)
    )
  `);

  // Blockers table - track issues preventing template completion
  db.exec(`
    CREATE TABLE IF NOT EXISTS blockers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idea_id INTEGER NOT NULL,
      blocker_type TEXT NOT NULL CHECK(blocker_type IN ('missing_action', 'missing_integration', 'platform_limitation', 'bug', 'other')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'wont_fix')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      created_by INTEGER NOT NULL,
      resolved_by INTEGER,
      resolved_at DATETIME,
      resolution_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (resolved_by) REFERENCES users(id)
    )
  `);

  // Blocker discussions table - threaded discussions for each blocker
  db.exec(`
    CREATE TABLE IF NOT EXISTS blocker_discussions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blocker_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_solution BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (blocker_id) REFERENCES blockers(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Ensure handle column exists (migration for existing DB)
  let hasHandle = true; // Assume it exists since it's in the CREATE TABLE
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    hasHandle = tableInfo.some(col => col.name === 'handle');
    
    if (!hasHandle) {
      console.log('Migrating: Adding handle column to users table...');
      db.exec(`ALTER TABLE users ADD COLUMN handle TEXT`);
      hasHandle = true;
      console.log('✅ Added handle column to users table');
    }
  } catch (e) {
    console.error('Error checking/adding handle column:', e.message);
    hasHandle = false; // If there's an error, mark as false to skip handle operations
  }

  // Ideas/Templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      use_case TEXT NOT NULL,
      flow_name TEXT,
      short_description TEXT,
      description TEXT,
      setup_guide TEXT,
      template_url TEXT,
      scribe_url TEXT,
      department TEXT,
      tags TEXT,
      reviewer_name TEXT,
      price REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new' CHECK(
        status IN ('new', 'assigned', 'in_progress', 'submitted', 'needs_fixes', 'reviewed', 'published')
      ),
      assigned_to INTEGER,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Comments/Feedback table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idea_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Activity log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idea_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create default admin user if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    
    if (hasHandle) {
      db.prepare(`
        INSERT INTO users (username, email, password, handle, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('admin', 'admin@example.com', hashedPassword, 'admin', 'admin');
    } else {
      db.prepare(`
        INSERT INTO users (username, email, password, role)
        VALUES (?, ?, ?, ?)
      `).run('admin', 'admin@example.com', hashedPassword, 'admin');
    }

    // Create sample freelancer
    const freelancerPassword = bcrypt.hashSync('freelancer123', 10);
    
    if (hasHandle) {
      db.prepare(`
        INSERT INTO users (username, email, password, handle, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('freelancer', 'freelancer@example.com', freelancerPassword, 'freelancer', 'freelancer');
    } else {
      db.prepare(`
        INSERT INTO users (username, email, password, role)
        VALUES (?, ?, ?, ?)
      `).run('freelancer', 'freelancer@example.com', freelancerPassword, 'freelancer');
    }

    console.log('✅ Default users created:');
    console.log('   Admin: admin / admin123 (@admin)');
    console.log('   Freelancer: freelancer / freelancer123 (@freelancer)');
  }

  // Update existing users without handles (only if handle column exists and was verified)
  if (hasHandle) {
    try {
      // First check if we can query the handle column
      const testQuery = db.prepare('SELECT handle FROM users LIMIT 1');
      testQuery.all(); // This will throw if column doesn't exist
      
      // Now safely query for users without handles
      const usersWithoutHandles = db.prepare('SELECT id, username, handle FROM users WHERE handle IS NULL OR handle = ""').all();
      
      if (usersWithoutHandles.length > 0) {
        console.log(`Migrating: Updating ${usersWithoutHandles.length} users with handles...`);
        usersWithoutHandles.forEach(user => {
          const handle = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
          // Check if handle already exists
          const existing = db.prepare('SELECT id FROM users WHERE handle = ? AND id != ?').get(handle, user.id);
          const finalHandle = existing ? `${handle}${user.id}` : handle;
          db.prepare('UPDATE users SET handle = ? WHERE id = ?').run(finalHandle, user.id);
        });
        console.log(`✅ Updated ${usersWithoutHandles.length} users with handles`);
      }
      
      // Create unique index on handle if it doesn't exist
      try {
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle)`);
      } catch (e) {
        // Index might already exist, that's fine
        if (!e.message.includes('already exists')) {
          console.error('Error creating handle index:', e.message);
        }
      }
    } catch (e) {
      console.error('Error updating user handles:', e.message);
      console.log('Skipping handle migration due to error');
    }
  }

  // Create database views
  createDatabaseViews();

  console.log('✅ Database initialized successfully');
}

// Function to create database views
export function createDatabaseViews() {
  try {
    const viewsSQL = readFileSync(join(__dirname, 'views.sql'), 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = viewsSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    statements.forEach(statement => {
      try {
        db.exec(statement + ';');
      } catch (err) {
        // Ignore errors for DROP VIEW statements if view doesn't exist
        if (!statement.includes('DROP VIEW')) {
          console.error('Error executing statement:', statement.substring(0, 100));
          console.error(err.message);
        }
      }
    });
    
    console.log('✅ Database views created successfully');
  } catch (error) {
    console.error('❌ Error creating views:', error.message);
  }
}

export default db;

