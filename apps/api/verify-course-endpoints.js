/**
 * Manual verification script for Task 26: Course CRUD Endpoints
 * 
 * This script tests the course CRUD endpoints to verify they are working correctly.
 * 
 * Prerequisites:
 * 1. API server must be running (npm run dev)
 * 2. Database must be set up and migrated
 * 3. At least one admin user must exist in the database
 * 
 * Run: node verify-course-endpoints.js
 */

const http = require('http');
const https = require('https');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@taxbros.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

let adminToken = '';
let courseId = '';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = httpModule.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function test1_Login() {
  console.log('\n1. Testing Admin Login...');
  try {
    const response = await makeRequest('POST', '/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (response.status === 200 && response.data.accessToken) {
      adminToken = response.data.accessToken;
      console.log('✓ Admin login successful');
      return true;
    } else {
      console.log('✗ Admin login failed:', response.data);
      return false;
    }
  } catch (error) {
    console.log('✗ Admin login error:', error.message);
    return false;
  }
}

async function test2_CreateCourse() {
  console.log('\n2. Testing POST /courses (Create Course)...');
  try {
    const response = await makeRequest(
      'POST',
      '/courses',
      {
        title: 'Test Course - Tax Filing Basics',
        description: 'This is a test course for verification purposes',
        displayOrder: 1,
      },
      adminToken,
    );

    if (response.status === 201 && response.data.id) {
      courseId = response.data.id;
      console.log('✓ Course created successfully');
      console.log('  Course ID:', courseId);
      console.log('  Title:', response.data.title);
      console.log('  Status:', response.data.status);
      return true;
    } else {
      console.log('✗ Course creation failed:', response.data);
      return false;
    }
  } catch (error) {
    console.log('✗ Course creation error:', error.message);
    return false;
  }
}

async function test3_ListCourses() {
  console.log('\n3. Testing GET /courses (List Courses)...');
  try {
    const response = await makeRequest('GET', '/courses', null, adminToken);

    if (response.status === 200 && response.data.data) {
      console.log('✓ Courses listed successfully');
      console.log('  Total courses:', response.data.meta.total);
      console.log('  Courses on page:', response.data.data.length);
      return true;
    } else {
      console.log('✗ Course listing failed:', response.data);
      return false;
    }
  } catch (error) {
    console.log('✗ Course listing error:', error.message);
    return false;
  }
}

async function test4_GetCourse() {
  console.log('\n4. Testing GET /courses/:id (Get Course Details)...');
  try {
    const response = await makeRequest(
      'GET',
      `/courses/${courseId}`,
      null,
      adminToken,
    );

    if (response.status === 200 && response.data.id === courseId) {
      console.log('✓ Course details retrieved successfully');
      console.log('  Course ID:', response.data.id);
      console.log('  Title:', response.data.title);
      console.log('  Modules:', response.data.modules.length);
      return true;
    } else {
      console.log('✗ Course retrieval failed:', response.data);
      return false;
    }
  } catch (error) {
    console.log('✗ Course retrieval error:', error.message);
    return false;
  }
}

async function test5_UpdateCourse() {
  console.log('\n5. Testing PATCH /courses/:id (Update Course)...');
  try {
    const response = await makeRequest(
      'PATCH',
      `/courses/${courseId}`,
      {
        title: 'Updated Test Course - Advanced Tax Filing',
        displayOrder: 5,
      },
      adminToken,
    );

    if (response.status === 200 && response.data.title.includes('Advanced')) {
      console.log('✓ Course updated successfully');
      console.log('  New title:', response.data.title);
      console.log('  New display order:', response.data.displayOrder);
      return true;
    } else {
      console.log('✗ Course update failed:', response.data);
      return false;
    }
  } catch (error) {
    console.log('✗ Course update error:', error.message);
    return false;
  }
}

async function test6_PublishCourse() {
  console.log('\n6. Testing PATCH /courses/:id (Publish Course)...');
  try {
    const response = await makeRequest(
      'PATCH',
      `/courses/${courseId}`,
      {
        status: 'PUBLISHED',
      },
      adminToken,
    );

    if (response.status === 200 && response.data.status === 'PUBLISHED') {
      console.log('✓ Course published successfully');
      console.log('  Status:', response.data.status);
      return true;
    } else {
      console.log('✗ Course publishing failed:', response.data);
      return false;
    }
  } catch (error) {
    console.log('✗ Course publishing error:', error.message);
    return false;
  }
}

async function test7_DeleteCourse() {
  console.log('\n7. Testing DELETE /courses/:id (Soft Delete Course)...');
  try {
    const response = await makeRequest(
      'DELETE',
      `/courses/${courseId}`,
      null,
      adminToken,
    );

    if (response.status === 200 && response.data.status === 'ARCHIVED') {
      console.log('✓ Course archived successfully');
      console.log('  Status:', response.data.status);
      return true;
    } else {
      console.log('✗ Course archiving failed:', response.data);
      return false;
    }
  } catch (error) {
    console.log('✗ Course archiving error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Task 26: Course CRUD Endpoints Verification');
  console.log('='.repeat(60));
  console.log('API Base URL:', API_BASE_URL);
  console.log('Admin Email:', ADMIN_EMAIL);

  const tests = [
    test1_Login,
    test2_CreateCourse,
    test3_ListCourses,
    test4_GetCourse,
    test5_UpdateCourse,
    test6_PublishCourse,
    test7_DeleteCourse,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${tests.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n✓ All tests passed! Task 26 is complete.');
  } else {
    console.log('\n✗ Some tests failed. Please review the errors above.');
  }
}

// Run the tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
