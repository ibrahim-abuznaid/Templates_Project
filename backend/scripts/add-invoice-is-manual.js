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
      WHERE table_name = 'invoice_items' AND column_name = 'is_manual'
    `);

    if (checkResult.rows.length > 0) {
      console.log('Column is_manual already exists');
    } else {
      // Add the column
      await client.query(`
        ALTER TABLE invoice_items 
        ADD COLUMN is_manual BOOLEAN DEFAULT false
      `);
      console.log('Added is_manual column to invoice_items table');
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

