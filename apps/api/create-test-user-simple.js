const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Delete existing user if exists
    await prisma.user.deleteMany({
      where: { email: 'test@taxbros.edu' }
    });
    
    const passwordHash = await bcrypt.hash('Test123!@#', 12);
    
    const user = await prisma.user.create({
      data: {
        email: 'test@taxbros.edu',
        passwordHash: passwordHash,
        role: 'STUDENT',
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    
    console.log('✅ Created test user:', user.email);
    console.log('📧 Email: test@taxbros.edu');
    console.log('🔑 Password: Test123!@#');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
