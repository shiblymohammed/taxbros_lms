/**
 * Database Setup Script
 * Creates the taxbros_lms database if it doesn't exist
 */

const { Client } = require('pg');
require('dotenv').config();

async function setupDatabase() {
  console.log('🔧 Setting up PostgreSQL database...\n');

  // Parse DATABASE_URL to get connection details
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  // Extract connection details from URL
  const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) {
    console.error('❌ Invalid DATABASE_URL format');
    process.exit(1);
  }

  const [, user, password, host, port, database] = match;

  console.log(`📋 Connection Details:`);
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   User: ${user}`);
  console.log(`   Database: ${database}\n`);

  // First, connect to the default 'postgres' database
  const client = new Client({
    host,
    port: parseInt(port),
    user,
    password,
    database: 'postgres', // Connect to default database first
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Check if database exists
    console.log(`🔍 Checking if database '${database}' exists...`);
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [database]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Database '${database}' already exists`);
    } else {
      console.log(`📦 Creating database '${database}'...`);
      await client.query(`CREATE DATABASE ${database}`);
      console.log(`✅ Database '${database}' created successfully!`);
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: npm run prisma:push');
    console.log('   2. Run: npm run prisma:generate');
    console.log('   3. Run: npm run dev\n');

  } catch (error) {
    console.error('\n❌ Error during database setup:');
    console.error(error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 The password in your .env file appears to be incorrect.');
      console.error('   Please verify the PostgreSQL password for the postgres user.\n');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Could not connect to PostgreSQL server.');
      console.error('   Please ensure PostgreSQL is running.\n');
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
