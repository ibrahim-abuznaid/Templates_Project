/**
 * Migration script to add suggested_ideas tables
 * Run this script to add the suggestions feature tables to your database
 * 
 * Usage: node scripts/add-suggested-ideas.js
 */

import db from '../src/database/db.js';

async function migrate() {
  console.log('🚀 Starting migration: Adding suggested_ideas tables...\n');

  try {
    // Create suggested_ideas table
    console.log('📋 Creating suggested_ideas table...');
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS suggested_ideas (
        id SERIAL PRIMARY KEY,
        flow_name VARCHAR(255) NOT NULL,
        idea_notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        suggested_by INTEGER NOT NULL REFERENCES users(id) ON UPDATE NO ACTION,
        reviewed_by INTEGER REFERENCES users(id) ON UPDATE NO ACTION,
        review_note TEXT,
        converted_idea_id INTEGER REFERENCES ideas(id) ON UPDATE NO ACTION,
        created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP(6)
      )
    `).run();
    console.log('   ✅ suggested_ideas table created');

    // Create indexes for suggested_ideas
    console.log('📋 Creating indexes for suggested_ideas...');
    try {
      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_suggested_ideas_suggested_by ON suggested_ideas(suggested_by)
      `).run();
      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_suggested_ideas_status ON suggested_ideas(status)
      `).run();
      console.log('   ✅ Indexes created');
    } catch (err) {
      console.log('   ⚠️ Indexes may already exist:', err.message);
    }

    // Create suggested_idea_departments junction table
    console.log('📋 Creating suggested_idea_departments table...');
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS suggested_idea_departments (
        id SERIAL PRIMARY KEY,
        suggested_idea_id INTEGER NOT NULL REFERENCES suggested_ideas(id) ON DELETE CASCADE,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(suggested_idea_id, department_id)
      )
    `).run();
    console.log('   ✅ suggested_idea_departments table created');

    // Create indexes for suggested_idea_departments
    console.log('📋 Creating indexes for suggested_idea_departments...');
    try {
      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_suggested_idea_departments_suggested_idea_id 
        ON suggested_idea_departments(suggested_idea_id)
      `).run();
      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_suggested_idea_departments_department_id 
        ON suggested_idea_departments(department_id)
      `).run();
      console.log('   ✅ Indexes created');
    } catch (err) {
      console.log('   ⚠️ Indexes may already exist:', err.message);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - Created suggested_ideas table');
    console.log('   - Created suggested_idea_departments junction table');
    console.log('   - Created necessary indexes');
    console.log('\n🎉 You can now use the Suggestions feature!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrate();

