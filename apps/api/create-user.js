const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email: 'admin@taxbros.com' }
    });
    
    if (existing) {
      console.log('Test user already exists');
      return;
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash('Admin123!', 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: 'admin@taxbros.com',
        passwordHash: passwordHash,
        role: 'ADMINISTRATOR',
        status: 'ACTIVE',
        mustChangePassword: false,
        failedLoginAttempts: 0,
      },
    });
    
    console.log('Created test user:', user.email);
  } catch (error) {
    console.error('Error creating user:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
