import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 1 Acceptance Tests: Foundation & Attendance (T1-T3)
 * 
 * This test suite validates the complete implementation of:
 * - T1: User Management & Authentication
 * - T2: Class Management & Attendance Marking
 * - T3: Attendance Reporting & Monthly Calculations
 */

describe('Phase 1: Foundation & Attendance - Acceptance Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let studentToken: string;
  
  // Test data IDs
  let staffUserId: number;
  let studentUserId: number;
  let classId: number;
  let registerId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    // Clean database before tests
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
    await app.close();
  });

  async function cleanDatabase() {
    // Delete in correct order to respect foreign key constraints
    await prisma.studentAttendance.deleteMany();
    await prisma.staffAttendance.deleteMany();
    await prisma.studentAttendanceRegister.deleteMany();
    await prisma.classEnrollment.deleteMany();
    await prisma.class.deleteMany();
    await prisma.staffPermission.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.student.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  }

  describe('T1: User Management & Authentication', () => {
    
    describe('1.1 Create Administrator Account', () => {
      it('should create an administrator account with email and password', async () => {
        const response = await request(app.getHttpServer())
          .post('/users')
          .send({
            email: 'admin@taxbros.test',
            password: 'Admin@123456',
            role: 'ADMINISTRATOR',
            firstName: 'System',
            lastName: 'Administrator',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.email).toBe('admin@taxbros.test');
        expect(response.body.role).toBe('ADMINISTRATOR');
        expect(response.body.status).toBe('ACTIVE');
        expect(response.body).not.toHaveProperty('password');
        
      });

      it('should enforce unique email addresses', async () => {
        await request(app.getHttpServer())
          .post('/users')
          .send({
            email: 'admin@taxbros.test',
            password: 'Another@123',
            role: 'STAFF',
          })
          .expect(400);
      });
    });

    describe('1.2 Authentication Flow', () => {
      it('should authenticate with valid credentials and return JWT tokens', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'admin@taxbros.test',
            password: 'Admin@123456',
          })
          .expect(200);

        expect(response.body).toHaveProperty('access_token');
        expect(response.body).toHaveProperty('refresh_token');
        expect(response.body.user.email).toBe('admin@taxbros.test');
        expect(response.body.user.role).toBe('ADMINISTRATOR');
        
        adminToken = response.body.access_token;
      });

      it('should reject invalid credentials', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'admin@taxbros.test',
            password: 'WrongPassword',
          })
          .expect(401);
      });

      it('should protect endpoints with JWT authentication', async () => {
        await request(app.getHttpServer())
          .get('/users')
          .expect(401);
      });

      it('should allow authenticated requests with valid token', async () => {
        await request(app.getHttpServer())
          .get('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe('1.3 Account Lockout Protection', () => {
      let testEmail: string;

      beforeAll(async () => {
        testEmail = 'lockout.test@taxbros.test';
        await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: testEmail,
            password: 'Test@123456',
            role: 'STAFF',
            firstName: 'Lockout',
            lastName: 'Test',
          });
      });

      it('should lock account after 5 failed login attempts', async () => {
        // Make 5 failed attempts
        for (let i = 0; i < 5; i++) {
          await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              email: testEmail,
              password: 'WrongPassword',
            })
            .expect(401);
        }

        // 6th attempt should return 429 (Too Many Requests)
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testEmail,
            password: 'WrongPassword',
          })
          .expect(429);

        expect(response.body.message).toContain('locked');
      });
    });

    describe('1.4 Create Staff Account with Permissions', () => {
      it('should create staff account with required fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'staff@taxbros.test',
            password: 'Staff@123456',
            role: 'STAFF',
            firstName: 'Teaching',
            lastName: 'Staff',
            staffId: 'STF001',
            designation: 'Senior Lecturer',
            department: 'Taxation',
            category: 'TEACHING',
            joiningDate: '2024-01-15',
          })
          .expect(201);

        expect(response.body.staff).toBeDefined();
        expect(response.body.staff.staffId).toBe('STF001');
        expect(response.body.staff.designation).toBe('Senior Lecturer');
        
        staffUserId = response.body.id;
      });

      it('should enforce unique staff IDs', async () => {
        await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'another.staff@taxbros.test',
            password: 'Staff@123456',
            role: 'STAFF',
            firstName: 'Another',
            lastName: 'Staff',
            staffId: 'STF001', // Duplicate
            designation: 'Lecturer',
            department: 'Taxation',
            category: 'TEACHING',
            joiningDate: '2024-01-15',
          })
          .expect(400);
      });

      it('should grant MARK_ATTENDANCE permission to staff', async () => {
        const response = await request(app.getHttpServer())
          .post(`/staff/${staffUserId}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            permission: 'MARK_ATTENDANCE',
          })
          .expect(201);

        expect(response.body.permission).toBe('MARK_ATTENDANCE');
      });

      it('should authenticate staff user', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'staff@taxbros.test',
            password: 'Staff@123456',
          })
          .expect(200);

        staffToken = response.body.access_token;
      });
    });

    describe('1.5 Create Student Account', () => {
      it('should create student account with admission details', async () => {
        const response = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'student@taxbros.test',
            password: 'Student@123456',
            role: 'STUDENT',
            firstName: 'John',
            lastName: 'Doe',
            admissionId: 'ADM2024001',
            admissionDate: '2024-01-20',
          })
          .expect(201);

        expect(response.body.student).toBeDefined();
        expect(response.body.student.admissionId).toBe('ADM2024001');
        
        studentUserId = response.body.id;
      });

      it('should enforce unique admission IDs', async () => {
        await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'another.student@taxbros.test',
            password: 'Student@123456',
            role: 'STUDENT',
            firstName: 'Jane',
            lastName: 'Doe',
            admissionId: 'ADM2024001', // Duplicate
            admissionDate: '2024-01-20',
          })
          .expect(400);
      });

      it('should authenticate student user', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'student@taxbros.test',
            password: 'Student@123456',
          })
          .expect(200);

        studentToken = response.body.access_token;
      });
    });

    describe('1.6 Role-Based Access Control', () => {
      it('should allow administrator to view all users', async () => {
        const response = await request(app.getHttpServer())
          .get('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      it('should allow student to view own profile', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/${studentUserId}`)
          .set('Authorization', `Bearer ${studentToken}`)
          .expect(200);

        expect(response.body.id).toBe(studentUserId);
      });

      it('should prevent student from viewing other student profiles', async () => {
        await request(app.getHttpServer())
          .get(`/users/${staffUserId}`)
          .set('Authorization', `Bearer ${studentToken}`)
          .expect(403);
      });

      it('should prevent staff without permission from marking attendance', async () => {
        // Create staff without MARK_ATTENDANCE permission
        await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'noperm.staff@taxbros.test',
            password: 'Staff@123456',
            role: 'STAFF',
            firstName: 'No',
            lastName: 'Permission',
            staffId: 'STF002',
            designation: 'Admin Staff',
            department: 'Administration',
            category: 'NON_TEACHING',
            joiningDate: '2024-01-15',
          });

        const noPermToken = (await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'noperm.staff@taxbros.test',
            password: 'Staff@123456',
          })).body.access_token;

        await request(app.getHttpServer())
          .post('/attendance/student/registers')
          .set('Authorization', `Bearer ${noPermToken}`)
          .send({
            classId: 1,
            attendanceDate: '2024-01-22',
          })
          .expect(403);
      });
    });
  });

  describe('T2: Class Management & Attendance Marking', () => {
    
    describe('2.1 Create and Manage Classes', () => {
      it('should create a class with unique name', async () => {
        const response = await request(app.getHttpServer())
          .post('/classes')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Taxation Fundamentals - Batch A',
          })
          .expect(201);

        expect(response.body.name).toBe('Taxation Fundamentals - Batch A');
        expect(response.body.status).toBe('ACTIVE');
        
        classId = response.body.id;
      });

      it('should enforce unique class names', async () => {
        await request(app.getHttpServer())
          .post('/classes')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Taxation Fundamentals - Batch A',
          })
          .expect(400);
      });

      it('should enroll student in class', async () => {
        const response = await request(app.getHttpServer())
          .post(`/classes/${classId}/students`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            studentId: studentUserId,
          })
          .expect(201);

        expect(response.body.status).toBe('ACTIVE');
      });

      it('should prevent duplicate class enrollments', async () => {
        await request(app.getHttpServer())
          .post(`/classes/${classId}/students`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            studentId: studentUserId,
          })
          .expect(400);
      });

      it('should retrieve class with enrolled students', async () => {
        const response = await request(app.getHttpServer())
          .get(`/classes/${classId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.enrollments).toBeDefined();
        expect(response.body.enrollments.length).toBe(1);
        expect(response.body.enrollments[0].student.admissionId).toBe('ADM2024001');
      });
    });

    describe('2.2 Open Attendance Register with Frozen Roster', () => {
      it('should create attendance register with frozen roster snapshot', async () => {
        const attendanceDate = '2024-01-22';
        
        const response = await request(app.getHttpServer())
          .post('/attendance/student/registers')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            classId,
            attendanceDate,
          })
          .expect(201);

        expect(response.body.classId).toBe(classId);
        expect(response.body.attendanceDate).toBe(attendanceDate);
        expect(response.body.status).toBe('DRAFT');
        expect(response.body.rosterSnapshot).toBeDefined();
        expect(response.body.rosterSnapshot).toContain(studentUserId);
        
        registerId = response.body.id;
      });

      it('should return existing register if already opened', async () => {
        const response = await request(app.getHttpServer())
          .post('/attendance/student/registers')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            classId,
            attendanceDate: '2024-01-22',
          })
          .expect(200);

        expect(response.body.id).toBe(registerId);
      });

      it('should maintain frozen roster even after enrollment changes', async () => {
        // Enroll another student
        const newStudent = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'newstudent@taxbros.test',
            password: 'Student@123456',
            role: 'STUDENT',
            firstName: 'New',
            lastName: 'Student',
            admissionId: 'ADM2024002',
            admissionDate: '2024-01-23',
          });

        await request(app.getHttpServer())
          .post(`/classes/${classId}/students`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            studentId: newStudent.body.id,
          });

        // Check original register - should not include new student
        const response = await request(app.getHttpServer())
          .get(`/attendance/student/registers/${registerId}`)
          .set('Authorization', `Bearer ${staffToken}`)
          .expect(200);

        expect(response.body.rosterSnapshot).not.toContain(newStudent.body.id);
        expect(response.body.rosterSnapshot).toContain(studentUserId);
      });
    });

    describe('2.3 Mark Student Attendance', () => {
      it('should mark attendance as PRESENT', async () => {
        const response = await request(app.getHttpServer())
          .post(`/attendance/student/registers/${registerId}/mark`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            marks: [
              {
                studentId: studentUserId,
                status: 'PRESENT',
                remarks: 'On time',
              },
            ],
          })
          .expect(200);

        expect(response.body.status).toBe('SAVED');
      });

      it('should retrieve marked attendance', async () => {
        const response = await request(app.getHttpServer())
          .get(`/attendance/student/registers/${registerId}`)
          .set('Authorization', `Bearer ${staffToken}`)
          .expect(200);

        expect(response.body.attendances).toBeDefined();
        expect(response.body.attendances.length).toBe(1);
        expect(response.body.attendances[0].status).toBe('PRESENT');
        expect(response.body.attendances[0].studentId).toBe(studentUserId);
      });
    });

    describe('2.4 Correct Student Attendance', () => {
      it('should update attendance status from PRESENT to LATE', async () => {
        await request(app.getHttpServer())
          .post(`/attendance/student/registers/${registerId}/mark`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            marks: [
              {
                studentId: studentUserId,
                status: 'LATE',
                remarks: 'Arrived 10 minutes late',
              },
            ],
          })
          .expect(200);

        const response = await request(app.getHttpServer())
          .get(`/attendance/student/registers/${registerId}`)
          .set('Authorization', `Bearer ${staffToken}`)
          .expect(200);

        expect(response.body.attendances[0].status).toBe('LATE');
        expect(response.body.attendances[0].remarks).toBe('Arrived 10 minutes late');
      });

      it('should update attendance status from LATE to ABSENT', async () => {
        await request(app.getHttpServer())
          .post(`/attendance/student/registers/${registerId}/mark`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            marks: [
              {
                studentId: studentUserId,
                status: 'ABSENT',
                remarks: 'No notice provided',
              },
            ],
          })
          .expect(200);
      });
    });

    describe('2.5 Mark Staff Attendance', () => {
      it('should mark staff attendance as PRESENT', async () => {
        const response = await request(app.getHttpServer())
          .post('/attendance/staff')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            staffId: staffUserId,
            attendanceDate: '2024-01-22',
            status: 'PRESENT',
          })
          .expect(201);

        expect(response.body.status).toBe('PRESENT');
        expect(response.body.staffId).toBe(staffUserId);
      });

      it('should allow staff to view own attendance', async () => {
        const response = await request(app.getHttpServer())
          .get(`/staff/${staffUserId}/attendance`)
          .set('Authorization', `Bearer ${staffToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0].status).toBe('PRESENT');
      });
    });
  });

  describe('T3: Attendance Reporting & Monthly Calculations', () => {
    
    beforeAll(async () => {
      // Set up test data for monthly calculations
      // Mark attendance for multiple days in January 2024
      const attendanceDates = [
        { date: '2024-01-01', status: 'PRESENT' },
        { date: '2024-01-02', status: 'PRESENT' },
        { date: '2024-01-03', status: 'LATE' },
        { date: '2024-01-04', status: 'ABSENT' },
        { date: '2024-01-05', status: 'ABSENT' },
        { date: '2024-01-08', status: 'PRESENT' },
        { date: '2024-01-09', status: 'PRESENT' },
        { date: '2024-01-10', status: 'PRESENT' },
        { date: '2024-01-11', status: 'PRESENT' },
        { date: '2024-01-12', status: 'PRESENT' },
      ];

      for (const { date, status } of attendanceDates) {
        // Open register
        const register = await request(app.getHttpServer())
          .post('/attendance/student/registers')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            classId,
            attendanceDate: date,
          });

        // Mark attendance
        await request(app.getHttpServer())
          .post(`/attendance/student/registers/${register.body.id}/mark`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            marks: [
              {
                studentId: studentUserId,
                status,
              },
            ],
          });
      }
    });

    describe('3.1 Monthly Attendance Percentage Calculation', () => {
      it('should calculate monthly attendance with formula: 100 × (Present + Late) / (Present + Late + Absent)', async () => {
        const response = await request(app.getHttpServer())
          .get('/reports/attendance/student/monthly')
          .query({ year: 2024, month: 1 })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        const studentReport = response.body.find(
          (r: any) => r.studentId === studentUserId,
        );
        
        expect(studentReport).toBeDefined();
        // 7 PRESENT + 1 LATE = 8
        // 8 / (8 + 2 ABSENT) = 8/10 = 0.8 = 80%
        expect(studentReport.presentCount).toBe(7);
        expect(studentReport.lateCount).toBe(1);
        expect(studentReport.absentCount).toBe(2);
        expect(studentReport.percentage).toBe(80);
      });

      it('should exclude unmarked entries from percentage calculation', async () => {
        // Open a register but don't mark it
        await request(app.getHttpServer())
          .post('/attendance/student/registers')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            classId,
            attendanceDate: '2024-01-15',
          });

        const response = await request(app.getHttpServer())
          .get('/reports/attendance/student/monthly')
          .query({ year: 2024, month: 1 })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const studentReport = response.body.find(
          (r: any) => r.studentId === studentUserId,
        );

        // Percentage should still be 80%, unmarked entry not counted
        expect(studentReport.percentage).toBe(80);
      });
    });

    describe('3.2 Attendance Correction Impact on Reports', () => {
      it('should recalculate percentage from 80% to 90% when correcting ABSENT to PRESENT', async () => {
        // Find a register with ABSENT status and correct it
        const jan4Register = (await request(app.getHttpServer())
          .post('/attendance/student/registers')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            classId,
            attendanceDate: '2024-01-04',
          })).body;

        // Correct ABSENT to PRESENT
        await request(app.getHttpServer())
          .post(`/attendance/student/registers/${jan4Register.id}/mark`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            marks: [
              {
                studentId: studentUserId,
                status: 'PRESENT',
              },
            ],
          })
          .expect(200);

        // Check updated percentage
        const response = await request(app.getHttpServer())
          .get('/reports/attendance/student/monthly')
          .query({ year: 2024, month: 1 })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const studentReport = response.body.find(
          (r: any) => r.studentId === studentUserId,
        );

        // 8 PRESENT (was 7) + 1 LATE = 9
        // 9 / (9 + 1 ABSENT) = 9/10 = 0.9 = 90%
        expect(studentReport.presentCount).toBe(8);
        expect(studentReport.absentCount).toBe(1);
        expect(studentReport.percentage).toBe(90);
      });
    });

    describe('3.3 Attendance History and Filtering', () => {
      it('should retrieve student attendance history ordered by date descending', async () => {
        const response = await request(app.getHttpServer())
          .get(`/students/${studentUserId}/attendance`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
        
        // Verify descending date order
        if (response.body.length > 1) {
          const firstDate = new Date(response.body[0].attendanceDate);
          const secondDate = new Date(response.body[1].attendanceDate);
          expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
        }
      });

      it('should filter attendance by date range', async () => {
        const response = await request(app.getHttpServer())
          .get(`/students/${studentUserId}/attendance`)
          .query({
            dateFrom: '2024-01-01',
            dateTo: '2024-01-05',
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.length).toBeLessThanOrEqual(5);
        response.body.forEach((record: any) => {
          const recordDate = new Date(record.attendanceDate);
          expect(recordDate.getTime()).toBeGreaterThanOrEqual(new Date('2024-01-01').getTime());
          expect(recordDate.getTime()).toBeLessThanOrEqual(new Date('2024-01-05').getTime());
        });
      });

      it('should filter attendance by status', async () => {
        const response = await request(app.getHttpServer())
          .get(`/students/${studentUserId}/attendance`)
          .query({ status: 'PRESENT' })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        response.body.forEach((record: any) => {
          expect(record.status).toBe('PRESENT');
        });
      });

      it('should allow student to view only their own attendance', async () => {
        const response = await request(app.getHttpServer())
          .get(`/students/${studentUserId}/attendance`)
          .set('Authorization', `Bearer ${studentToken}`)
          .expect(200);

        response.body.forEach((record: any) => {
          expect(record.studentId).toBe(studentUserId);
        });
      });
    });

    describe('3.4 Staff Attendance Reports', () => {
      beforeAll(async () => {
        // Mark staff attendance for January 2024
        const staffDates = [
          { date: '2024-01-01', status: 'PRESENT' },
          { date: '2024-01-02', status: 'PRESENT' },
          { date: '2024-01-03', status: 'PRESENT' },
          { date: '2024-01-04', status: 'LATE' },
          { date: '2024-01-05', status: 'ABSENT' },
          { date: '2024-01-08', status: 'PRESENT' },
          { date: '2024-01-09', status: 'PRESENT' },
          { date: '2024-01-10', status: 'PRESENT' },
        ];

        for (const { date, status } of staffDates) {
          await request(app.getHttpServer())
            .post('/attendance/staff')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              staffId: staffUserId,
              attendanceDate: date,
              status,
            });
        }
      });

      it('should generate monthly staff attendance report', async () => {
        const response = await request(app.getHttpServer())
          .get('/reports/attendance/staff/monthly')
          .query({ year: 2024, month: 1 })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        const staffReport = response.body.find(
          (r: any) => r.staffId === staffUserId,
        );

        expect(staffReport).toBeDefined();
        // 6 PRESENT + 1 LATE = 7
        // 7 / (7 + 1 ABSENT) = 7/8 = 0.875 = 87.5%
        expect(staffReport.presentCount).toBe(6);
        expect(staffReport.lateCount).toBe(1);
        expect(staffReport.absentCount).toBe(1);
        expect(staffReport.percentage).toBeCloseTo(87.5, 1);
      });

      it('should filter staff reports by department', async () => {
        const response = await request(app.getHttpServer())
          .get('/reports/attendance/staff/monthly')
          .query({
            year: 2024,
            month: 1,
            department: 'Taxation',
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        response.body.forEach((record: any) => {
          expect(record.department).toBe('Taxation');
        });
      });
    });

    describe('3.5 Edge Cases and Data Isolation', () => {
      it('should prevent students from accessing other students attendance', async () => {
        // Create another student
        const otherStudent = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'other.student@taxbros.test',
            password: 'Student@123456',
            role: 'STUDENT',
            firstName: 'Other',
            lastName: 'Student',
            admissionId: 'ADM2024003',
            admissionDate: '2024-01-20',
          });

        // Original student tries to access other student's attendance
        await request(app.getHttpServer())
          .get(`/students/${otherStudent.body.id}/attendance`)
          .set('Authorization', `Bearer ${studentToken}`)
          .expect(403);
      });

      it('should handle mid-month enrollment correctly in percentage calculation', async () => {
        // Create a student who joined mid-January
        const midMonthStudent = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'midmonth@taxbros.test',
            password: 'Student@123456',
            role: 'STUDENT',
            firstName: 'Mid',
            lastName: 'Month',
            admissionId: 'ADM2024004',
            admissionDate: '2024-01-15', // Joined mid-month
          });

        // Enroll in class
        await request(app.getHttpServer())
          .post(`/classes/${classId}/students`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            studentId: midMonthStudent.body.id,
          });

        // Mark attendance for dates after enrollment
        for (const date of ['2024-01-15', '2024-01-16', '2024-01-17']) {
          const register = await request(app.getHttpServer())
            .post('/attendance/student/registers')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({
              classId,
              attendanceDate: date,
            });

          await request(app.getHttpServer())
            .post(`/attendance/student/registers/${register.body.id}/mark`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({
              marks: [
                {
                  studentId: midMonthStudent.body.id,
                  status: 'PRESENT',
                },
              ],
            });
        }

        // Check report - should only count from enrollment date forward
        const response = await request(app.getHttpServer())
          .get('/reports/attendance/student/monthly')
          .query({ year: 2024, month: 1 })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const report = response.body.find(
          (r: any) => r.studentId === midMonthStudent.body.id,
        );

        expect(report).toBeDefined();
        expect(report.presentCount).toBe(3);
        expect(report.percentage).toBe(100); // 3/3 = 100%
      });
    });
  });

  describe('Database and Migration Verification', () => {
    it('should have all required database tables', async () => {
      // Query the database to verify table existence
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;

      const tableNames = (tables as any[]).map((t) => t.table_name);
      
      // Core tables
      expect(tableNames).toContain('User');
      expect(tableNames).toContain('Student');
      expect(tableNames).toContain('Staff');
      expect(tableNames).toContain('StaffPermission');
      expect(tableNames).toContain('Class');
      expect(tableNames).toContain('ClassEnrollment');
      expect(tableNames).toContain('StudentAttendanceRegister');
      expect(tableNames).toContain('StudentAttendance');
      expect(tableNames).toContain('StaffAttendance');
      expect(tableNames).toContain('RefreshToken');
    });

    it('should have proper indexes on critical fields', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      `;

      const indexList = (indexes as any[]).map(
        (i) => `${i.tablename}.${i.indexname}`,
      );

      // Verify key indexes exist (these would include unique constraints and explicit indexes)
      expect(indexList.some((i) => i.includes('User') && i.includes('email'))).toBe(true);
      expect(indexList.some((i) => i.includes('Student') && i.includes('admissionId'))).toBe(true);
      expect(indexList.some((i) => i.includes('Staff') && i.includes('staffId'))).toBe(true);
    });
  });
});
