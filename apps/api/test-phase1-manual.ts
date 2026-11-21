/**
 * Manual Phase 1 Acceptance Tests
 * Run with: ts-node test-phase1-manual.ts
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';
const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  validateStatus: () => true, // Don't throw on any status
});

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, message: string) {
  results.push({
    name: testName,
    passed: condition,
    message: condition ? 'PASSED' : `FAILED: ${message}`,
  });
  
  if (!condition) {
    console.error(`❌ ${testName}: ${message}`);
  } else {
    console.log(`✅ ${testName}`);
  }
}

async function runTests() {
  console.log('\n==============================================');
  console.log('Phase 1: Foundation & Attendance - Acceptance Tests');
  console.log('==============================================\n');

  let adminToken = '';
  let staffToken = '';
  let studentToken = '';
  let adminUserId: number;
  let staffUserId: number;
  let studentUserId: number;
  let classId: number;
  let registerId: number;

  try {
    // Check API is running
    console.log('\n--- Checking API Health ---');
    const healthResponse = await client.get('/users');
    assert(
      healthResponse.status === 401 || healthResponse.status === 200,
      'API Health Check',
      `Expected 401 or 200, got ${healthResponse.status}`,
    );

    // T1: User Management & Authentication
    console.log('\n--- T1: User Management & Authentication ---');

    // 1.1: Use existing Administrator
    console.log('\n1.1: Using Existing Administrator Account');
    const existingAdminEmail = 'admin@taxbros.edu';
    const existingAdminPassword = 'Admin123!@#';

    // 1.2: Admin Login
    console.log('\n1.2: Administrator Authentication');
    const adminLoginResponse = await client.post('/auth/login', {
      email: existingAdminEmail,
      password: existingAdminPassword,
    });
    
    assert(
      adminLoginResponse.status === 200,
      'Admin Login',
      `Expected 200, got ${adminLoginResponse.status}`,
    );
    
    if (adminLoginResponse.status === 200) {
      adminToken = adminLoginResponse.data.accessToken || adminLoginResponse.data.access_token;
      adminUserId = adminLoginResponse.data.user?.id || adminLoginResponse.data.userId;
      assert(
        !!adminToken,
        'Admin Token Received',
        `No access token in response`,
      );
    }

    // 1.3: Create Staff with Permissions
    console.log('\n1.3: Create Staff Account');
    const staffResponse = await client.post(
      '/users',
      {
        email: 'staff@taxbros.test',
        password: 'Staff@123456',
        role: 'STAFF',
        staffProfile: {
          staffId: 'STF001',
          firstName: 'Teaching',
          lastName: 'Staff',
          designation: 'Senior Lecturer',
          department: 'Taxation',
          category: 'TEACHING',
          joiningDate: '2024-01-15',
        },
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    
    assert(
      staffResponse.status === 201,
      'Create Staff',
      `Expected 201, got ${staffResponse.status}: ${JSON.stringify(staffResponse.data)}`,
    );
    
    if (staffResponse.status === 201) {
      staffUserId = staffResponse.data.id;
      
      // Grant MARK_ATTENDANCE permission using the user ID
      const permResponse = await client.post(
        `/staff/${staffUserId}/permissions`,
        { permission: 'MARK_ATTENDANCE' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      
      assert(
        permResponse.status === 201,
        'Grant MARK_ATTENDANCE Permission',
        `Expected 201, got ${permResponse.status}: ${JSON.stringify(permResponse.data)}`,
      );
    }

    // Staff Login
    const staffLoginResponse = await client.post('/auth/login', {
      email: 'staff@taxbros.test',
      password: 'Staff@123456',
    });
    
    if (staffLoginResponse.status === 200) {
      staffToken = staffLoginResponse.data.accessToken;
    }

    // 1.4: Create Student
    console.log('\n1.4: Create Student Account');
    const studentResponse = await client.post(
      '/users',
      {
        email: 'student@taxbros.test',
        password: 'Student@123456',
        role: 'STUDENT',
        studentProfile: {
          admissionId: 'ADM2024001',
          firstName: 'John',
          lastName: 'Doe',
          admissionDate: '2024-01-20',
        },
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    
    assert(
      studentResponse.status === 201,
      'Create Student',
      `Expected 201, got ${studentResponse.status}`,
    );
    
    if (studentResponse.status === 201) {
      studentUserId = studentResponse.data.id;
    }

    // Student Login
    const studentLoginResponse = await client.post('/auth/login', {
      email: 'student@taxbros.test',
      password: 'Student@123456',
    });
    
    if (studentLoginResponse.status === 200) {
      studentToken = studentLoginResponse.data.accessToken;
    }

    // 1.5: Role-Based Access Control
    console.log('\n1.5: Role-Based Access Control');
    
    // Student tries to access another user's profile
    const forbiddenResponse = await client.get(`/users/${staffUserId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    
    assert(
      forbiddenResponse.status === 403,
      'Student Access Denied',
      `Expected 403, got ${forbiddenResponse.status}`,
    );

    // T2: Class Management & Attendance Marking
    console.log('\n--- T2: Class Management & Attendance Marking ---');

    // 2.1: Create Class
    console.log('\n2.1: Create Class');
    // Use a unique class name with timestamp to avoid conflicts
    const className = `Taxation Fundamentals - Test ${Date.now()}`;
    const classResponse = await client.post(
      '/classes',
      { name: className },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    
    assert(
      classResponse.status === 201,
      'Create Class',
      `Expected 201, got ${classResponse.status}: ${JSON.stringify(classResponse.data)}`,
    );
    
    if (classResponse.status === 201) {
      classId = classResponse.data.id;
    }

    // 2.2: Enroll Student in Class
    console.log('\n2.2: Enroll Student');
    const enrollResponse = await client.post(
      `/classes/${classId}/students`,
      { studentId: studentUserId },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    
    assert(
      enrollResponse.status === 201,
      'Enroll Student',
      `Expected 201, got ${enrollResponse.status}`,
    );

    // 2.3: Open Attendance Register
    console.log('\n2.3: Open Attendance Register');
    const registerResponse = await client.post(
      '/attendance/student/registers',
      {
        classId,
        attendanceDate: '2024-01-22',
      },
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    
    assert(
      registerResponse.status === 201,
      'Open Register',
      `Expected 201, got ${registerResponse.status}`,
    );
    
    if (registerResponse.status === 201) {
      registerId = registerResponse.data.id;
      assert(
        Array.isArray(registerResponse.data.rosterSnapshot),
        'Frozen Roster Created',
        'rosterSnapshot is not an array',
      );
    }

    // 2.4: Mark Attendance
    console.log('\n2.4: Mark Attendance');
    const markResponse = await client.post(
      `/attendance/student/registers/${registerId}/mark`,
      {
        marks: [
          {
            studentId: studentUserId,
            status: 'PRESENT',
            remarks: 'On time',
          },
        ],
      },
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    
    assert(
      markResponse.status === 200,
      'Mark Attendance',
      `Expected 200, got ${markResponse.status}`,
    );

    // 2.5: Correct Attendance
    console.log('\n2.5: Correct Attendance');
    const correctResponse = await client.post(
      `/attendance/student/registers/${registerId}/mark`,
      {
        marks: [
          {
            studentId: studentUserId,
            status: 'LATE',
            remarks: 'Arrived 10 minutes late',
          },
        ],
      },
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    
    assert(
      correctResponse.status === 200,
      'Correct Attendance',
      `Expected 200, got ${correctResponse.status}`,
    );

    // T3: Attendance Reporting & Monthly Calculations
    console.log('\n--- T3: Attendance Reporting & Monthly Calculations ---');

    // Create more attendance records for January
    console.log('\n3.1: Creating Test Data for Monthly Calculation');
    const testDates = [
      { date: '2024-01-01', status: 'PRESENT' },
      { date: '2024-01-02', status: 'PRESENT' },
      { date: '2024-01-03', status: 'LATE' },
      { date: '2024-01-04', status: 'ABSENT' },
      { date: '2024-01-05', status: 'ABSENT' },
      { date: '2024-01-08', status: 'PRESENT' },
      { date: '2024-01-09', status: 'PRESENT' },
      { date: '2024-01-10', status: 'PRESENT' },
    ];

    for (const { date, status } of testDates) {
      const reg = await client.post(
        '/attendance/student/registers',
        { classId, attendanceDate: date },
        { headers: { Authorization: `Bearer ${staffToken}` } },
      );

      if (reg.status === 201 || reg.status === 200) {
        await client.post(
          `/attendance/student/registers/${reg.data.id}/mark`,
          {
            marks: [{ studentId: studentUserId, status }],
          },
          { headers: { Authorization: `Bearer ${staffToken}` } },
        );
      }
    }

    // 3.2: Monthly Report
    console.log('\n3.2: Generate Monthly Report');
    const reportResponse = await client.get(
      '/reports/attendance/student/monthly',
      {
        params: { year: 2024, month: 1 },
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    
    assert(
      reportResponse.status === 200,
      'Get Monthly Report',
      `Expected 200, got ${reportResponse.status}`,
    );

    if (reportResponse.status === 200) {
      // Response might be an array or object - handle both cases
      const reportData = Array.isArray(reportResponse.data) 
        ? reportResponse.data 
        : reportResponse.data.data || [];
        
      const studentReport = reportData.find(
        (r: any) => r.studentId === studentUserId || r.student?.id === studentUserId,
      );
      
      if (studentReport) {
        // Expected: 5 PRESENT + 1 LATE (from testDates) + 1 LATE (from earlier test) = 7 total counted
        // 2 ABSENT
        // Percentage = (7 / (7 + 2)) * 100 = 77.78%
        const expectedPercentage = Math.round((7 / 9) * 100);
        
        console.log(`  Present: ${studentReport.presentCount}`);
        console.log(`  Late: ${studentReport.lateCount}`);
        console.log(`  Absent: ${studentReport.absentCount}`);
        console.log(`  Percentage: ${studentReport.percentage}%`);
        
        assert(
          studentReport.percentage >= 70 && studentReport.percentage <= 80,
          'Monthly Percentage Calculation',
          `Expected ~${expectedPercentage}%, got ${studentReport.percentage}%`,
        );
      }
    }

    // 3.3: Attendance History
    console.log('\n3.3: View Attendance History');
    const historyResponse = await client.get(
      `/students/${studentUserId}/attendance`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    
    assert(
      historyResponse.status === 200,
      'Get Attendance History',
      `Expected 200, got ${historyResponse.status}`,
    );

    if (historyResponse.status === 200) {
      assert(
        Array.isArray(historyResponse.data) && historyResponse.data.length > 0,
        'History Records Exist',
        'No history records found',
      );
    }

    // Summary
    console.log('\n==============================================');
    console.log('Test Summary');
    console.log('==============================================');
    
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    const percentage = Math.round((passed / total) * 100);
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${percentage}%`);
    
    if (passed === total) {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Test execution error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Check if API is running before starting tests
axios
  .get(`${API_BASE_URL}/users`)
  .then(() => {
    console.log('✅ API is running');
    runTests();
  })
  .catch((error) => {
    if (error.response && error.response.status === 401) {
      console.log('✅ API is running');
      runTests();
    } else {
      console.error('❌ API is not running. Please start the API server first:');
      console.error('   cd apps/api && pnpm dev');
      process.exit(1);
    }
  });
