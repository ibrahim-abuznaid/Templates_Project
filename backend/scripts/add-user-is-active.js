/**
 * Migration script to add is_active column to users table
 * Run this script to enable user account enable/disable functionality
 * 
 * Usage: node scripts/add-user-is-active.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// Allow self-signed certificates (needed for DigitalOcean managed databases)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Pool } = pg;

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set!');
    console.log('Make sure you have a .env file in the backend directory with DATABASE_URL');
    process.exit(1);
  }

  console.log('Connecting to database...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')); // Hide password
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      require: true
    }
  });

  try {
    console.log('Checking if is_active column exists...');
    
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_active'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✓ is_active column already exists');
    } else {
      console.log('Adding is_active column to users table...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN is_active BOOLEAN DEFAULT true
      `);
      console.log('✓ is_active column added successfully');
    }

    // Show current users status
    const users = await pool.query(`
      SELECT id, username, role, COALESCE(is_active, true) as is_active 
      FROM users 
      ORDER BY id
    `);
    
    console.log('\nCurrent users:');
    console.table(users.rows);

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();

