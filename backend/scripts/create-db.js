import pkg from 'pg';
const { Client } = pkg;

const createDatabase = async () => {
  // Connect to postgres database to create our database
  const client = new Client({
    host: 'localhost',
    port: 7777,
    user: 'postgres',
    password: 'SecurePass2024!',
    database: 'postgres' // Connect to default postgres database first
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'template_management'"
    );
    
    if (result.rows.length === 0) {
      // Create database
      await client.query('CREATE DATABASE template_management');
      console.log('✅ Database "template_management" created successfully');
    } else {
      console.log('ℹ️ Database "template_management" already exists');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
};

createDatabase();
