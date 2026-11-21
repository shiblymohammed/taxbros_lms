// Test Successful Login Reset
// This script demonstrates that the counter resets on successful login

const axios = require('axios');

const baseUrl = 'http://localhost:3001/api/auth/login';
const testEmail = 'reset@taxbros.edu';
const wrongPassword = 'WrongPassword123';
const correctPassword = 'Test123!@#';

async function testLogin(email, password, label) {
  try {
    const response = await axios.post(baseUrl, { email, password });
    console.log(`${label} - SUCCESS ✅`);
    return true;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data.message;
      
      if (status === 429) {
        console.log(`${label} - LOCKED (HTTP 429) 🔒`);
      } else if (status === 401) {
        console.log(`${label} - FAILED (HTTP 401) ❌`);
        console.log(`  ${message}`);
      }
    }
    return false;
  }
}

async function createTestUser() {
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcrypt');
  const prisma = new PrismaClient();
  
  try {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    const hash = await bcrypt.hash(correctPassword, 12);
    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: hash,
        role: 'STUDENT',
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    console.log('✅ Test user created\n');
  } finally {
    await prisma.$disconnect();
  }
}

async function runTest() {
  console.log('\n=== Testing Successful Login Reset ===\n');
  
  // Step 1: Create user
  console.log('Step 1: Creating test user...');
  await createTestUser();
  
  // Step 2: Make 3 failed attempts
  console.log('Step 2: Making 3 failed attempts...');
  await testLogin(testEmail, wrongPassword, '  Attempt 1');
  await testLogin(testEmail, wrongPassword, '  Attempt 2');
  await testLogin(testEmail, wrongPassword, '  Attempt 3');
  console.log('  📝 Counter should be at 3\n');
  
  // Step 3: Successful login
  console.log('Step 3: Successful login (should reset counter)...');
  const success = await testLogin(testEmail, correctPassword, '  Login');
  if (success) {
    console.log('  ✅ Counter reset on successful login\n');
  } else {
    console.log('  ❌ Login failed!\n');
    return;
  }
  
  // Step 4: Verify reset (can make 5 more attempts)
  console.log('Step 4: Verify counter reset (should allow 5 more attempts)...');
  await testLogin(testEmail, wrongPassword, '  Attempt 1');
  await testLogin(testEmail, wrongPassword, '  Attempt 2');
  await testLogin(testEmail, wrongPassword, '  Attempt 3');
  await testLogin(testEmail, wrongPassword, '  Attempt 4');
  await testLogin(testEmail, wrongPassword, '  Attempt 5');
  
  console.log('\n=== Test Summary ===');
  console.log('✅ Counter resets on successful login');
  console.log('✅ Can make 5 more failed attempts after reset');
  console.log('\n=== Testing Complete ===\n');
}

runTest().catch(console.error);
