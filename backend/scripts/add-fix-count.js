import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Add fix_count column to ideas table
    await client.query(`
      ALTER TABLE ideas 
      ADD COLUMN IF NOT EXISTS fix_count INTEGER DEFAULT 0
    `);
    console.log('✓ Added fix_count column to ideas table');

    // Set fix_count for templates that are currently in needs_fixes status
    // (they've been marked at least once)
    const result = await client.query(`
      UPDATE ideas 
      SET fix_count = 1 
      WHERE status = 'needs_fixes' AND (fix_count IS NULL OR fix_count = 0)
    `);
    console.log(`✓ Updated ${result.rowCount} templates currently in needs_fixes status`);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();

