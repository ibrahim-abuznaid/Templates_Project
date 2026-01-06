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

    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'comments' AND column_name = 'edited_at'
    `);

    if (checkResult.rows.length > 0) {
      console.log('Column edited_at already exists');
    } else {
      // Add the column
      await client.query(`
        ALTER TABLE comments 
        ADD COLUMN edited_at TIMESTAMP
      `);
      console.log('Added edited_at column to comments table');
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

migrate();

