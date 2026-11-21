const { Client } = require('pg');
require('dotenv').config();

async function createDatabase() {
  // Connect to default postgres database
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '2509',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL server');

    // Check if database exists
    const checkDb = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'taxbros_lms'"
    );

    if (checkDb.rows.length > 0) {
      console.log('✓ Database "taxbros_lms" already exists');
    } else {
      // Create database
      await client.query('CREATE DATABASE taxbros_lms');
      console.log('✓ Created database "taxbros_lms"');
    }

    await client.end();
    console.log('\n✓ Database setup complete!');
    console.log('  You can now run: npm run prisma:migrate');
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

createDatabase();
