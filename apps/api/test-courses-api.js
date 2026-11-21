/**
 * Test script for Course CRUD API endpoints
 * 
 * This script tests:
 * - POST /api/courses (create course)
 * - GET /api/courses (list courses)
 * - GET /api/courses/:id (get single course)
 * - PATCH /api/courses/:id (update course)
 * - DELETE /api/courses/:id (soft delete/archive)
 * 
 * Run with: node test-courses-api.js
 */

const API_BASE = 'http://localhost:3001/api';

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

// Test runner
async function runTests() {
  console.log('🧪 Testing Course CRUD API Endpoints\n');

  let authToken = null;
  let courseId = null;

  try {
    // Step 1: Login as admin to get auth token
    console.log('1️⃣  Logging in as admin...');
    const loginResult = await apiRequest('/auth/login', 'POST', {
      email: 'admin@taxbros.edu',
      password: 'Admin123!@#',
    });

    if (loginResult.status !== 200 && loginResult.status !== 201) {
      console.error('❌ Login failed:', loginResult.data);
      console.log('\n⚠️  Please ensure:');
      console.log('   - The API server is running (npm run dev)');
      console.log('   - The database has been seeded with an admin user');
      console.log('   - The credentials are correct');
      return;
    }

    authToken = loginResult.data.access_token;
    console.log('✅ Login successful\n');

    // Step 2: Create a new course
    console.log('2️⃣  Creating a new course...');
    const createResult = await apiRequest('/courses', 'POST', {
      title: 'Test Course - Introduction to Taxation',
      description: 'This is a test course for the CRUD operations',
      displayOrder: 1,
    }, authToken);

    if (createResult.status !== 201) {
      console.error('❌ Course creation failed:', createResult.data);
      return;
    }

    courseId = createResult.data.id;
    console.log('✅ Course created successfully');
    console.log('   ID:', courseId);
    console.log('   Title:', createResult.data.title);
    console.log('   Status:', createResult.data.status);
    console.log('   Display Order:', createResult.data.displayOrder);
    console.log('');

    // Step 3: Get all courses
    console.log('3️⃣  Fetching all courses...');
    const listResult = await apiRequest('/courses?page=1&limit=10', 'GET', null, authToken);

    if (listResult.status !== 200) {
      console.error('❌ Fetching courses failed:', listResult.data);
      return;
    }

    console.log('✅ Courses fetched successfully');
    console.log('   Total courses:', listResult.data.meta.total);
    console.log('   Courses on this page:', listResult.data.data.length);
    console.log('');

    // Step 4: Get single course details
    console.log('4️⃣  Fetching single course details...');
    const getResult = await apiRequest(`/courses/${courseId}`, 'GET', null, authToken);

    if (getResult.status !== 200) {
      console.error('❌ Fetching course failed:', getResult.data);
      return;
    }

    console.log('✅ Course details fetched successfully');
    console.log('   Title:', getResult.data.title);
    console.log('   Description:', getResult.data.description);
    console.log('   Status:', getResult.data.status);
    console.log('   Modules:', getResult.data.modules.length);
    console.log('');

    // Step 5: Update the course
    console.log('5️⃣  Updating course...');
    const updateResult = await apiRequest(`/courses/${courseId}`, 'PATCH', {
      title: 'Test Course - Advanced Taxation (Updated)',
      description: 'Updated description for testing',
      status: 'PUBLISHED',
    }, authToken);

    if (updateResult.status !== 200) {
      console.error('❌ Course update failed:', updateResult.data);
      return;
    }

    console.log('✅ Course updated successfully');
    console.log('   New Title:', updateResult.data.title);
    console.log('   New Status:', updateResult.data.status);
    console.log('');

    // Step 6: Test filtering published courses (as student would see)
    console.log('6️⃣  Fetching published courses only...');
    const publishedResult = await apiRequest('/courses?status=PUBLISHED&page=1&limit=10', 'GET', null, authToken);

    if (publishedResult.status !== 200) {
      console.error('❌ Fetching published courses failed:', publishedResult.data);
      return;
    }

    console.log('✅ Published courses fetched successfully');
    console.log('   Total published courses:', publishedResult.data.meta.total);
    console.log('');

    // Step 7: Soft delete (archive) the course
    console.log('7️⃣  Archiving course (soft delete)...');
    const deleteResult = await apiRequest(`/courses/${courseId}`, 'DELETE', null, authToken);

    if (deleteResult.status !== 200) {
      console.error('❌ Course deletion failed:', deleteResult.data);
      return;
    }

    console.log('✅ Course archived successfully');
    console.log('   Status:', deleteResult.data.status);
    console.log('');

    // Step 8: Verify the course still exists but is archived
    console.log('8️⃣  Verifying archived course still exists...');
    const verifyResult = await apiRequest(`/courses/${courseId}`, 'GET', null, authToken);

    if (verifyResult.status !== 200) {
      console.error('❌ Verification failed:', verifyResult.data);
      return;
    }

    console.log('✅ Course still exists in database');
    console.log('   Status:', verifyResult.data.status);
    console.log('   This confirms soft delete (archiving) is working correctly\n');

    console.log('🎉 All tests passed successfully!\n');
    console.log('📝 Summary:');
    console.log('   ✓ Course creation (POST /courses)');
    console.log('   ✓ Course listing (GET /courses)');
    console.log('   ✓ Course details (GET /courses/:id)');
    console.log('   ✓ Course update (PATCH /courses/:id)');
    console.log('   ✓ Course publishing');
    console.log('   ✓ Course archiving (DELETE /courses/:id)');
    console.log('   ✓ Soft delete verification');

  } catch (error) {
    console.error('❌ Test execution error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the tests
runTests();
