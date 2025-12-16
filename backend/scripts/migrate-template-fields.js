/**
 * Migration script for new template fields
 * 
 * This script adds new columns to the ideas table for the publishing functionality:
 * - summary: Brief summary for public library
 * - time_save_per_week: Time savings displayed as tag (e.g., "2 hours")
 * - cost_per_year: Cost savings displayed as tag (e.g., "$150/year")
 * - author: Template author name for public library
 * - idea_notes: Internal notes about the template idea
 * - flow_json: JSON string containing flow definition for publishing
 * 
 * Run this script once to update your database schema.
 * 
 * Usage: node scripts/migrate-template-fields.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting migration for new template fields...\n');
    
    // Start transaction
    await client.query('BEGIN');

    // Check if columns already exist
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ideas' 
      AND column_name IN ('summary', 'time_save_per_week', 'cost_per_year', 'author', 'idea_notes', 'flow_json')
    `);
    
    const existingColumns = new Set(columnCheck.rows.map(r => r.column_name));
    
    // Add summary column
    if (!existingColumns.has('summary')) {
      console.log('📝 Adding "summary" column...');
      await client.query(`
        ALTER TABLE ideas 
        ADD COLUMN summary TEXT
      `);
      console.log('   ✅ Added "summary" column');
    } else {
      console.log('   ⏭️  "summary" column already exists, skipping');
    }

    // Add time_save_per_week column
    if (!existingColumns.has('time_save_per_week')) {
      console.log('📝 Adding "time_save_per_week" column...');
      await client.query(`
        ALTER TABLE ideas 
        ADD COLUMN time_save_per_week VARCHAR(100)
      `);
      console.log('   ✅ Added "time_save_per_week" column');
    } else {
      console.log('   ⏭️  "time_save_per_week" column already exists, skipping');
    }

    // Add cost_per_year column
    if (!existingColumns.has('cost_per_year')) {
      console.log('📝 Adding "cost_per_year" column...');
      await client.query(`
        ALTER TABLE ideas 
        ADD COLUMN cost_per_year VARCHAR(100)
      `);
      console.log('   ✅ Added "cost_per_year" column');
    } else {
      console.log('   ⏭️  "cost_per_year" column already exists, skipping');
    }

    // Add author column
    if (!existingColumns.has('author')) {
      console.log('📝 Adding "author" column...');
      await client.query(`
        ALTER TABLE ideas 
        ADD COLUMN author VARCHAR(255) DEFAULT 'Activepieces Team'
      `);
      console.log('   ✅ Added "author" column');
    } else {
      console.log('   ⏭️  "author" column already exists, skipping');
    }

    // Add idea_notes column
    if (!existingColumns.has('idea_notes')) {
      console.log('📝 Adding "idea_notes" column...');
      await client.query(`
        ALTER TABLE ideas 
        ADD COLUMN idea_notes TEXT
      `);
      console.log('   ✅ Added "idea_notes" column');
    } else {
      console.log('   ⏭️  "idea_notes" column already exists, skipping');
    }

    // Add flow_json column
    if (!existingColumns.has('flow_json')) {
      console.log('📝 Adding "flow_json" column...');
      await client.query(`
        ALTER TABLE ideas 
        ADD COLUMN flow_json TEXT
      `);
      console.log('   ✅ Added "flow_json" column');
    } else {
      console.log('   ⏭️  "flow_json" column already exists, skipping');
    }

    // Migrate existing data: copy short_description to summary where summary is null
    console.log('\n📦 Migrating existing data...');
    const migrateResult = await client.query(`
      UPDATE ideas 
      SET summary = short_description 
      WHERE summary IS NULL AND short_description IS NOT NULL
    `);
    console.log(`   ✅ Migrated ${migrateResult.rowCount} records (copied short_description to summary)`);

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Summary of changes:');
    console.log('   - summary: Brief summary for public library');
    console.log('   - time_save_per_week: Time savings (e.g., "2 hours")');
    console.log('   - cost_per_year: Cost savings (e.g., "$150/year")');
    console.log('   - author: Template author name');
    console.log('   - idea_notes: Internal notes about the template idea');
    console.log('   - flow_json: JSON flow definition for publishing');
    console.log('\n💡 Note: The old fields (use_case, short_description, tags) are kept for backward compatibility.');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});
