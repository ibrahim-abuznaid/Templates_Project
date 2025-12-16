// ============================================
// PostgreSQL Database Connection
// NO MORE SQLITE - PostgreSQL ONLY!
// ============================================

import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

// PostgreSQL connection pool
let pool = null;

// Initialize PostgreSQL connection
function createPool() {
  if (pool) return pool;
  
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:7777@localhost:5433/template_management';
  const isProduction = process.env.NODE_ENV === 'production';
  const isExternalDB = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');
  
  console.log('🐘 Connecting to PostgreSQL...');
  console.log(`📍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`🔗 Using external DB: ${isExternalDB}`);
  
  // For any external database (like DigitalOcean), always use SSL with rejectUnauthorized: false
  // This handles self-signed certificates used by managed database services
  const sslConfig = isExternalDB ? { rejectUnauthorized: false } : false;
  
  console.log(`🔒 SSL Config: ${JSON.stringify(sslConfig)}`);
  
  pool = new Pool({
    connectionString,
    ssl: sslConfig,
    max: 20,     // Maximum connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err);
  });

  return pool;
}

// Create pool immediately
createPool();

// ============================================
// SQLite-Compatible Wrapper for PostgreSQL
// This allows existing code to work with minimal changes
// ============================================

const db = {
  prepare: (sql) => {
    // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
    let paramCount = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++paramCount}`);
    
    return {
      // GET - returns single row (synchronous-like wrapper)
      get: (...params) => {
        const result = pool.query(pgSql, params);
        // Return a thenable that also has direct access for sync-like code
        const promise = result.then(res => res.rows[0] || null).catch(err => {
          console.error('PostgreSQL GET error:', err.message);
          throw err;
        });
        return promise;
      },
      
      // ALL - returns all rows
      all: (...params) => {
        const result = pool.query(pgSql, params);
        const promise = result.then(res => res.rows || []).catch(err => {
          console.error('PostgreSQL ALL error:', err.message);
          throw err;
        });
        return promise;
      },
      
      // RUN - executes query (INSERT, UPDATE, DELETE)
      run: (...params) => {
        // For INSERT, add RETURNING id to get the inserted ID
        let finalSql = pgSql;
        if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
          finalSql = pgSql + ' RETURNING id';
        }
        
        const result = pool.query(finalSql, params);
        const promise = result.then(res => ({
          lastInsertRowid: res.rows[0]?.id || null,
          changes: res.rowCount || 0
        })).catch(err => {
          console.error('PostgreSQL RUN error:', err.message);
          throw err;
        });
        return promise;
      }
    };
  },
  
  // Direct exec for raw SQL
  exec: async (sql) => {
    try {
      await pool.query(sql);
    } catch (err) {
      console.error('PostgreSQL EXEC error:', err.message);
      throw err;
    }
  },
  
  // Transaction support
  transaction: (fn) => {
    return async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await fn(client);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    };
  }
};

// ============================================
// Database Initialization
// ============================================

export async function initDatabase() {
  console.log('🗄️  Initializing PostgreSQL database...');
  
  const schema = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255) NOT NULL,
      handle VARCHAR(255) UNIQUE,
      role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'freelancer')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Invitations table
    CREATE TABLE IF NOT EXISTS invitations (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(255) UNIQUE NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'freelancer')),
      invited_by INTEGER REFERENCES users(id),
      expires_at TIMESTAMP NOT NULL,
      accepted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Ideas/Templates table
    CREATE TABLE IF NOT EXISTS ideas (
      id SERIAL PRIMARY KEY,
      use_case TEXT,
      flow_name TEXT NOT NULL DEFAULT '',
      summary TEXT,
      short_description TEXT,
      description TEXT,
      setup_guide TEXT,
      template_url TEXT,
      scribe_url TEXT,
      department VARCHAR(255),
      tags TEXT,
      time_save_per_week VARCHAR(100),
      cost_per_year VARCHAR(100),
      author VARCHAR(255) DEFAULT 'Activepieces Team',
      idea_notes TEXT,
      flow_json TEXT,
      reviewer_name VARCHAR(255),
      price DECIMAL(10, 2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'submitted', 'needs_fixes', 'reviewed', 'published', 'archived')),
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id),
      public_library_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Comments table
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Activity log table
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      action VARCHAR(255) NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      from_user_id INTEGER REFERENCES users(id),
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Invoices table
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(100) UNIQUE NOT NULL,
      freelancer_id INTEGER REFERENCES users(id),
      total_amount DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
      paid_by INTEGER REFERENCES users(id),
      paid_at TIMESTAMP,
      period_start TIMESTAMP NOT NULL,
      period_end TIMESTAMP NOT NULL,
      csv_data TEXT,
      pdf_data TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Invoice items table
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      freelancer_id INTEGER REFERENCES users(id),
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      idea_title TEXT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      completed_at TIMESTAMP NOT NULL,
      invoice_id INTEGER REFERENCES invoices(id),
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Blockers table
    CREATE TABLE IF NOT EXISTS blockers (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      blocker_type VARCHAR(100) NOT NULL CHECK (blocker_type IN ('missing_action', 'missing_integration', 'platform_limitation', 'bug', 'technical', 'documentation', 'design', 'other')),
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix')),
      priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      created_by INTEGER REFERENCES users(id),
      resolved_by INTEGER REFERENCES users(id),
      resolved_at TIMESTAMP,
      resolution_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Blocker discussions table
    CREATE TABLE IF NOT EXISTS blocker_discussions (
      id SERIAL PRIMARY KEY,
      blocker_id INTEGER REFERENCES blockers(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      message TEXT NOT NULL,
      is_solution BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Views table (for analytics)
    CREATE TABLE IF NOT EXISTS views (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
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
    CREATE INDEX IF NOT EXISTS idx_invoice_items_idea_id ON invoice_items(idea_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_freelancer_id ON invoice_items(freelancer_id);
  `;

  try {
    await pool.query(schema);
    console.log('✅ PostgreSQL schema initialized');
    
    // Add new columns if they don't exist (for existing databases)
    await migrateNewColumns();
    
    // Seed default users if they don't exist
    await seedDefaultUsers();
  } catch (err) {
    console.error('❌ Error creating PostgreSQL schema:', err.message);
    throw err;
  }
}

// ============================================
// Migration for New Template Fields
// ============================================

async function migrateNewColumns() {
  try {
    // Check which columns exist
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ideas' 
      AND column_name IN ('summary', 'time_save_per_week', 'cost_per_year', 'author', 'idea_notes', 'flow_json')
    `);
    
    const existingColumns = new Set(columnCheck.rows.map(r => r.column_name));
    let addedColumns = [];

    // Add summary column
    if (!existingColumns.has('summary')) {
      await pool.query('ALTER TABLE ideas ADD COLUMN IF NOT EXISTS summary TEXT');
      addedColumns.push('summary');
    }

    // Add time_save_per_week column
    if (!existingColumns.has('time_save_per_week')) {
      await pool.query('ALTER TABLE ideas ADD COLUMN IF NOT EXISTS time_save_per_week VARCHAR(100)');
      addedColumns.push('time_save_per_week');
    }

    // Add cost_per_year column
    if (!existingColumns.has('cost_per_year')) {
      await pool.query('ALTER TABLE ideas ADD COLUMN IF NOT EXISTS cost_per_year VARCHAR(100)');
      addedColumns.push('cost_per_year');
    }

    // Add author column
    if (!existingColumns.has('author')) {
      await pool.query("ALTER TABLE ideas ADD COLUMN IF NOT EXISTS author VARCHAR(255) DEFAULT 'Activepieces Team'");
      addedColumns.push('author');
    }

    // Add idea_notes column
    if (!existingColumns.has('idea_notes')) {
      await pool.query('ALTER TABLE ideas ADD COLUMN IF NOT EXISTS idea_notes TEXT');
      addedColumns.push('idea_notes');
    }

    // Add flow_json column
    if (!existingColumns.has('flow_json')) {
      await pool.query('ALTER TABLE ideas ADD COLUMN IF NOT EXISTS flow_json TEXT');
      addedColumns.push('flow_json');
    }

    // Make use_case nullable (it was required before)
    await pool.query('ALTER TABLE ideas ALTER COLUMN use_case DROP NOT NULL').catch(() => {
      // Ignore if already nullable
    });

    // Migrate existing data: copy short_description to summary where summary is null
    if (addedColumns.includes('summary')) {
      await pool.query(`
        UPDATE ideas 
        SET summary = short_description 
        WHERE summary IS NULL AND short_description IS NOT NULL
      `);
    }

    if (addedColumns.length > 0) {
      console.log(`📝 Added new columns to ideas table: ${addedColumns.join(', ')}`);
    }
  } catch (err) {
    console.error('⚠️  Migration warning:', err.message);
    // Don't throw - allow startup to continue
  }
}

// ============================================
// Seed Default Users
// ============================================

async function seedDefaultUsers() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(result.rows[0].count);

    if (userCount === 0) {
      console.log('📝 Seeding default users...');

      const adminPassword = await bcrypt.hash('admin123', 10);
      const freelancerPassword = await bcrypt.hash('freelancer123', 10);

      await pool.query(
        'INSERT INTO users (username, email, password, handle, role) VALUES ($1, $2, $3, $4, $5)',
        ['admin', 'admin@example.com', adminPassword, 'admin', 'admin']
      );

      await pool.query(
        'INSERT INTO users (username, email, password, handle, role) VALUES ($1, $2, $3, $4, $5)',
        ['freelancer', 'freelancer@example.com', freelancerPassword, 'freelancer', 'freelancer']
      );

      console.log('✅ Default users created:');
      console.log('   Admin: admin / admin123');
      console.log('   Freelancer: freelancer / freelancer123');
      
      // Seed example templates after creating users
      await seedExampleTemplates();
    } else {
      console.log(`ℹ️  Database already has ${userCount} user(s)`);
    }
  } catch (err) {
    console.error('❌ Error seeding default users:', err.message);
  }
}

// ============================================
// Seed Example Templates
// ============================================

async function seedExampleTemplates() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM ideas');
    const ideaCount = parseInt(result.rows[0].count);

    if (ideaCount === 0) {
      console.log('📝 Seeding example templates...');

      // Get user IDs
      const adminResult = await pool.query("SELECT id FROM users WHERE username = 'admin'");
      const freelancerResult = await pool.query("SELECT id FROM users WHERE username = 'freelancer'");
      const adminId = adminResult.rows[0]?.id;
      const freelancerId = freelancerResult.rows[0]?.id;

      const exampleTemplates = [
        {
          use_case: 'Customer Onboarding Automation',
          flow_name: 'New Customer Welcome Flow',
          short_description: 'Automate the entire customer onboarding process from signup to first purchase',
          description: 'This template automates the complete customer onboarding journey. It triggers when a new customer signs up, sends a personalized welcome email, creates their account in your CRM, assigns them to a sales rep, and schedules follow-up tasks. The flow includes conditional logic to route enterprise customers to dedicated account managers.',
          department: 'Sales',
          tags: 'onboarding, crm, email, automation',
          price: 150,
          status: 'new'
        },
        {
          use_case: 'Invoice Processing Workflow',
          flow_name: 'Automated Invoice Handler',
          short_description: 'Extract data from invoices and sync with accounting software',
          description: 'Automatically process incoming invoices using AI-powered OCR. The template extracts vendor information, line items, amounts, and due dates, then creates entries in QuickBooks/Xero. It also flags invoices that exceed budget thresholds and routes them for approval.',
          department: 'Finance',
          tags: 'invoice, ocr, accounting, quickbooks',
          price: 200,
          status: 'assigned',
          assigned_to: freelancerId
        },
        {
          use_case: 'Social Media Content Scheduler',
          flow_name: 'Multi-Platform Content Publisher',
          short_description: 'Schedule and publish content across all social media platforms',
          description: 'Create once, publish everywhere. This template takes content from a Google Sheet or Notion database and automatically publishes it to LinkedIn, Twitter, Facebook, and Instagram at optimal times. Includes image resizing for each platform and hashtag suggestions using AI.',
          department: 'Marketing',
          tags: 'social media, content, scheduling, marketing',
          price: 175,
          status: 'in_progress',
          assigned_to: freelancerId
        },
        {
          use_case: 'Employee Leave Request System',
          flow_name: 'Smart Leave Approval Flow',
          short_description: 'Streamline leave requests with automatic manager routing and calendar sync',
          description: 'Employees submit leave requests through a simple form. The template automatically routes to the correct manager based on department, checks for team coverage conflicts, updates the shared calendar, and notifies HR. Approved leaves sync with payroll systems.',
          department: 'HR',
          tags: 'hr, leave, approval, calendar',
          price: 125,
          status: 'submitted',
          assigned_to: freelancerId
        },
        {
          use_case: 'Lead Scoring and Routing',
          flow_name: 'Intelligent Lead Distribution',
          short_description: 'Score incoming leads and route to the right sales rep automatically',
          description: 'When a new lead comes in from your website, this template enriches the data using Clearbit, calculates a lead score based on company size, industry, and engagement, then routes to the appropriate sales rep based on territory and current workload. High-value leads trigger immediate Slack notifications.',
          department: 'Sales',
          tags: 'leads, scoring, routing, sales',
          price: 225,
          status: 'new'
        },
        {
          use_case: 'Customer Support Ticket Triage',
          flow_name: 'AI-Powered Support Router',
          short_description: 'Automatically categorize and route support tickets using AI',
          description: 'Uses GPT to analyze incoming support tickets, determine urgency and category, and route to the appropriate team. VIP customers are automatically prioritized. The template also suggests relevant knowledge base articles and can auto-respond to common questions.',
          department: 'Support',
          tags: 'support, ai, tickets, routing',
          price: 250,
          status: 'reviewed',
          assigned_to: freelancerId
        },
        {
          use_case: 'Weekly Report Generator',
          flow_name: 'Automated KPI Dashboard',
          short_description: 'Generate and distribute weekly reports from multiple data sources',
          description: 'Pulls data from Google Analytics, Stripe, HubSpot, and your database every Monday morning. Generates a beautiful PDF report with charts and KPIs, then emails it to stakeholders. Also posts a summary to your #metrics Slack channel.',
          department: 'Operations',
          tags: 'reports, analytics, kpi, automation',
          price: 175,
          status: 'new'
        },
        {
          use_case: 'Contract Approval Workflow',
          flow_name: 'Digital Contract Pipeline',
          short_description: 'Manage contract approvals with multi-level sign-off and e-signatures',
          description: 'When a new contract is uploaded to Dropbox or Google Drive, this template extracts key terms, routes for legal review if value exceeds threshold, collects necessary approvals based on contract type, and sends for e-signature via DocuSign. All contracts are logged in your CLM system.',
          department: 'Legal',
          tags: 'contracts, legal, approval, esignature',
          price: 275,
          status: 'new'
        },
        {
          use_case: 'Inventory Reorder Alerts',
          flow_name: 'Smart Stock Monitor',
          short_description: 'Monitor inventory levels and automate purchase orders',
          description: 'Connects to your inventory management system and monitors stock levels in real-time. When items fall below reorder points, it automatically generates purchase orders, sends them to approved vendors, and notifies the procurement team. Includes demand forecasting based on historical data.',
          department: 'Operations',
          tags: 'inventory, purchasing, alerts, automation',
          price: 200,
          status: 'needs_fixes',
          assigned_to: freelancerId
        },
        {
          use_case: 'Meeting Notes Processor',
          flow_name: 'AI Meeting Assistant',
          short_description: 'Transcribe meetings, extract action items, and update project tools',
          description: 'After each Zoom/Teams meeting, this template automatically transcribes the recording using Whisper AI, generates a summary, extracts action items and decisions, creates tasks in Asana/Jira, and sends a recap email to all participants. Meeting insights are searchable in your knowledge base.',
          department: 'Operations',
          tags: 'meetings, transcription, ai, productivity',
          price: 225,
          status: 'published',
          assigned_to: freelancerId
        }
      ];

      for (const template of exampleTemplates) {
        await pool.query(
          `INSERT INTO ideas (use_case, flow_name, short_description, description, department, tags, price, status, created_by, assigned_to)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            template.use_case,
            template.flow_name,
            template.short_description,
            template.description,
            template.department,
            template.tags,
            template.price,
            template.status,
            adminId,
            template.assigned_to || null
          ]
        );
      }

      console.log('✅ Created 10 example templates');
    }
  } catch (err) {
    console.error('❌ Error seeding example templates:', err.message);
  }
}

// ============================================
// Graceful Shutdown
// ============================================

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('✅ PostgreSQL connection pool closed');
  }
}

// Export pool for direct access if needed
export function getPool() {
  return pool;
}

// Export default db wrapper
export default db;
