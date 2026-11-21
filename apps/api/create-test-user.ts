import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUser() {
  const passwordHash = await bcrypt.hash('Admin123!', 12);
  
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
}

createTestUser()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
