const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Delete existing user if exists
    await prisma.user.deleteMany({
      where: { email: 'admin@taxbros.edu' }
    });
    
    const passwordHash = await bcrypt.hash('Admin123!@#', 12);
    
    const user = await prisma.user.create({
      data: {
        email: 'admin@taxbros.edu',
        passwordHash: passwordHash,
        role: 'ADMINISTRATOR',
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    
    console.log('✅ Created admin user:', user.email);
    console.log('📧 Email: admin@taxbros.edu');
    console.log('🔑 Password: Admin123!@#');
    console.log('👤 Role:', user.role);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
