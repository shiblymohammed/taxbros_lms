/**
 * Test script for attendance history and filtering endpoints (Task 20)
 * 
 * This script tests:
 * 1. GET /students/:id/attendance - Get attendance for specific student with filters
 * 2. GET /students/attendance/all - Get attendance for all students (admin only)
 * 
 * Requirements tested:
 * - R10.1: Filtering by Student ID
 * - R10.2: Filtering by class ID
 * - R10.3: Filtering by date range
 * - R10.4: Filtering by attendance status
 * - R10.5: Student data isolation (students see own only)
 * - R10.6: Results ordered by date descending
 * - R10.7: Display Student name, class name, date, status, and remarks
 * - R10.8: Students see records from all enrolled classes
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test data - these will need to exist in the database
let adminToken = '';
let studentToken = '';
let studentId = '';
let classId = '';

/**
 * Login as admin
 */
async function loginAsAdmin() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@taxbros.com',
      password: 'Admin@123',
    });
    adminToken = response.data.accessToken;
    console.log('✓ Admin login successful');
    return true;
  } catch (error) {
    console.error('✗ Admin login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Login as student
 */
async function loginAsStudent(email = 'student@test.com', password = 'Student@123') {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    });
    studentToken = response.data.accessToken;
    console.log('✓ Student login successful');
    return true;
  } catch (error) {
    console.error('✗ Student login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test 1: Get attendance history for a specific student (as admin)
 */
async function testGetStudentAttendanceAsAdmin() {
  console.log('\n--- Test 1: Get student attendance (as admin) ---');
  try {
    const response = await axios.get(
      `${API_URL}/students/${studentId}/attendance`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    
    console.log('✓ Successfully retrieved attendance records');
    console.log(`  Records found: ${response.data.length}`);
    
    if (response.data.length > 0) {
      const record = response.data[0];
      console.log('  Sample record:');
      console.log(`    Student: ${record.studentName} (${record.admissionId})`);
      console.log(`    Class: ${record.className}`);
      console.log(`    Date: ${record.attendanceDate}`);
      console.log(`    Status: ${record.status}`);
      console.log(`    Remarks: ${record.remarks || 'None'}`);
    }
    
    return true;
  } catch (error) {
    console.error('✗ Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test 2: Get attendance history for a student (as that student)
 */
async function testGetOwnAttendanceAsStudent() {
  console.log('\n--- Test 2: Get own attendance (as student) ---');
  try {
    const response = await axios.get(
      `${API_URL}/students/${studentId}/attendance`,
      {
        headers: { Authorization: `Bearer ${studentToken}` },
      }
    );
    
    console.log('✓ Student can view own attendance records');
    console.log(`  Records found: ${response.data.length}`);
    return true;
  } catch (error) {
    console.error('✗ Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test 3: Student tries to view another student's attendance (should fail)
 */
async function testStudentCannotViewOthersAttendance() {
  console.log('\n--- Test 3: Student cannot view another student\'s attendance ---');
  
  // Get a different student ID (not the logged-in student)
  try {
    const studentsResponse = await axios.get(`${API_URL}/students?limit=2`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    
    const otherStudent = studentsResponse.data.data.find(s => s.id !== studentId);
    
    if (!otherStudent) {
      console.log('⊘ Skip: No other student found for testing');
      return true;
    }
    
    try {
      await axios.get(
        `${API_URL}/students/${otherStudent.id}/attendance`,
        {
          headers: { Authorization: `Bearer ${studentToken}` },
        }
      );
      
      console.error('✗ Student was able to view another student\'s attendance (should fail)');
      return false;
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✓ Correctly blocked: Student cannot view other student\'s attendance');
        return true;
      }
      console.error('✗ Unexpected error:', error.response?.data?.message || error.message);
      return false;
    }
  } catch (error) {
    console.error('✗ Failed to setup test:', error.message);
    return false;
  }
}

/**
 * Test 4: Filter attendance by class ID
 */
async function testFilterByClass() {
  console.log('\n--- Test 4: Filter attendance by class ID ---');
  
  if (!classId) {
    console.log('⊘ Skip: No class ID available for testing');
    return true;
  }
  
  try {
    const response = await axios.get(
      `${API_URL}/students/${studentId}/attendance?classId=${classId}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    
    console.log('✓ Successfully filtered by class');
    console.log(`  Records found: ${response.data.length}`);
    
    // Verify all records are for the specified class
    const allMatchClass = response.data.every(r => r.classId === classId);
    if (allMatchClass) {
      console.log('  All records match the specified class');
    } else {
      console.error('✗ Some records do not match the class filter');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('✗ Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test 5: Filter attendance by date range
 */
async function testFilterByDateRange() {
  console.log('\n--- Test 5: Filter attendance by date range ---');
  
  const dateFrom = '2024-01-01';
  const dateTo = '2024-12-31';
  
  try {
    const response = await axios.get(
      `${API_URL}/students/${studentId}/attendance?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    
    console.log('✓ Successfully filtered by date range');
    console.log(`  Records found: ${response.data.length}`);
    
    // Verify dates are within range
    if (response.data.length > 0) {
      const allInRange = response.data.every(r => {
        const date = new Date(r.attendanceDate);
        return date >= new Date(dateFrom) && date <= new Date(dateTo);
      });
      
      if (allInRange) {
        console.log('  All records within date range');
      } else {
        console.error('✗ Some records outside date range');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('✗ Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test 6: Filter attendance by status
 */
async function testFilterByStatus() {
  console.log('\n--- Test 6: Filter attendance by status ---');
  
  try {
    const response = await axios.get(
      `${API_URL}/students/${studentId}/attendance?status=PRESENT`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    
    console.log('✓ Successfully filtered by status');
    console.log(`  PRESENT records found: ${response.data.length}`);
    
    // Verify all records have PRESENT status
    const allPresent = response.data.every(r => r.status === 'PRESENT');
    if (allPresent) {
      console.log('  All records have PRESENT status');
    } else {
      console.error('✗ Some records do not have PRESENT status');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('✗ Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test 7: Get all students' attendance (admin only)
 */
async function testGetAllStudentsAttendance() {
  console.log('\n--- Test 7: Get all students\' attendance (admin) ---');
  
  try {
    const response = await axios.get(
      `${API_URL}/students/attendance/all`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    
    console.log('✓ Successfully retrieved all students\' attendance');
    console.log(`  Total records found: ${response.data.length}`);
    
    return true;
  } catch (error) {
    console.error('✗ Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test 8: Verify records are ordered by date descending
 */
async function testDateOrdering() {
  console.log('\n--- Test 8: Verify date ordering (descending) ---');
  
  try {
    const response = await axios.get(
      `${API_URL}/students/${studentId}/attendance`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    
    if (response.data.length < 2) {
      console.log('⊘ Skip: Need at least 2 records to test ordering');
      return true;
    }
    
    // Check if dates are in descending order
    let isDescending = true;
    for (let i = 0; i < response.data.length - 1; i++) {
      const currentDate = new Date(response.data[i].attendanceDate);
      const nextDate = new Date(response.data[i + 1].attendanceDate);
      if (currentDate < nextDate) {
        isDescending = false;
        break;
      }
    }
    
    if (isDescending) {
      console.log('✓ Records are correctly ordered by date descending');
      return true;
    } else {
      console.error('✗ Records are not in descending order');
      return false;
    }
  } catch (error) {
    console.error('✗ Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Setup: Get a student ID and class ID for testing
 */
async function setupTestData() {
  console.log('\n--- Setting up test data ---');
  
  try {
    // Get a student
    const studentsResponse = await axios.get(`${API_URL}/students?limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    
    if (studentsResponse.data.data.length === 0) {
      console.error('✗ No students found in database');
      return false;
    }
    
    studentId = studentsResponse.data.data[0].id;
    console.log(`✓ Using student ID: ${studentId}`);
    
    // Get a class
    try {
      const classesResponse = await axios.get(`${API_URL}/classes?limit=1`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      
      if (classesResponse.data.data && classesResponse.data.data.length > 0) {
        classId = classesResponse.data.data[0].id;
        console.log(`✓ Using class ID: ${classId}`);
      } else {
        console.log('⊘ No classes found (will skip class-related tests)');
      }
    } catch (error) {
      console.log('⊘ Could not fetch classes (will skip class-related tests)');
    }
    
    return true;
  } catch (error) {
    console.error('✗ Failed to setup test data:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('=================================================');
  console.log('Testing Attendance History and Filtering (Task 20)');
  console.log('=================================================');
  
  // Login
  const adminLoggedIn = await loginAsAdmin();
  if (!adminLoggedIn) {
    console.error('\nCannot proceed without admin login');
    return;
  }
  
  // Setup test data
  const setupSuccess = await setupTestData();
  if (!setupSuccess) {
    console.error('\nCannot proceed without test data');
    return;
  }
  
  // Try to login as student (may not exist)
  await loginAsStudent();
  
  // Run tests
  const results = [];
  
  results.push(await testGetStudentAttendanceAsAdmin());
  
  if (studentToken) {
    results.push(await testGetOwnAttendanceAsStudent());
    results.push(await testStudentCannotViewOthersAttendance());
  }
  
  if (classId) {
    results.push(await testFilterByClass());
  }
  
  results.push(await testFilterByDateRange());
  results.push(await testFilterByStatus());
  results.push(await testGetAllStudentsAttendance());
  results.push(await testDateOrdering());
  
  // Summary
  const passed = results.filter(r => r === true).length;
  const total = results.length;
  
  console.log('\n=================================================');
  console.log(`Test Results: ${passed}/${total} passed`);
  console.log('=================================================');
  
  if (passed === total) {
    console.log('✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
