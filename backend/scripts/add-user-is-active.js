/**
 * Migration script to add is_active column to users table
 * Run this script to enable user account enable/disable functionality
 * 
 * Usage: node scripts/add-user-is-active.js
 */

import pg from 'pg';

const { Pool } = pg;

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

