import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  UserRole,
  UserStatus,
  CourseStatus,
  CourseEnrollmentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Task 30: Course Enrollment Endpoints E2E Tests
 * 
 * Tests Requirements:
 * - R5: Course enrollment management
 * - R22: Course progress dashboard
 * 
 * Validates:
 * - POST /courses/:courseId/enroll (enroll student)
 * - GET /students/:studentId/enrollments (get student's enrollments)
 * - GET /courses/:courseId/enrollments (get course enrollments, admin only)
 * - DELETE /enrollments/:id (drop course/unenroll)
 * - Enrollment validation (course published, not already enrolled)
 * - Authorization (students can enroll themselves, admins can enroll anyone)
 */
describe('Course Enrollment Endpoints (Task 30)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let student2Token: string;
  let adminUserId: string;
  let studentId: string;
  let student2Id: string;
  let publishedCourseId: string;
  let draftCourseId: string;
  let enrollmentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up test data
    await prisma.courseEnrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.courseModule.deleteMany();
    await prisma.course.deleteMany();
    await prisma.student.deleteMany();
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'enroll-admin@test.com',
            'enroll-student1@test.com',
            'enroll-student2@test.com',
          ],
        },
      },
    });

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'enroll-admin@test.com',
        passwordHash: await bcrypt.hash('Admin123!', 12),
        role: UserRole.ADMINISTRATOR,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });
    adminUserId = adminUser.id;

    // Create first student user and profile
    const studentUser = await prisma.user.create({
      data: {
        email: 'enroll-student1@test.com',
        passwordHash: await bcrypt.hash('Student123!', 12),
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        admissionId: 'STU-ENROLL-001',
        firstName: 'Enroll',
        lastName: 'Student1',
        admissionDate: new Date(),
      },
    });
    studentId = student.id;

    // Create second student user and profile
    const student2User = await prisma.user.create({
      data: {
        email: 'enroll-student2@test.com',
        passwordHash: await bcrypt.hash('Student123!', 12),
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    const student2 = await prisma.student.create({
      data: {
        userId: student2User.id,
        admissionId: 'STU-ENROLL-002',
        firstName: 'Enroll',
        lastName: 'Student2',
        admissionDate: new Date(),
      },
    });
    student2Id = student2.id;

    // Create a published course
    const publishedCourse = await prisma.course.create({
      data: {
        title: 'Published Tax Course',
        description: 'A published course for enrollment testing',
        status: CourseStatus.PUBLISHED,
        createdBy: adminUserId,
      },
    });
    publishedCourseId = publishedCourse.id;

    // Create a draft course
    const draftCourse = await prisma.course.create({
      data: {
        title: 'Draft Tax Course',
        description: 'A draft course that should not allow enrollment',
        status: CourseStatus.DRAFT,
        createdBy: adminUserId,
      },
    });
    draftCourseId = draftCourse.id;

    // Login as admin
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'enroll-admin@test.com',
        password: 'Admin123!',
      })
      .expect(200);

    adminToken = adminLoginResponse.body.accessToken;

    // Login as student 1
    const studentLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'enroll-student1@test.com',
        password: 'Student123!',
      })
      .expect(200);

    studentToken = studentLoginResponse.body.accessToken;

    // Login as student 2
    const student2LoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'enroll-student2@test.com',
        password: 'Student123!',
      })
      .expect(200);

    student2Token = student2LoginResponse.body.accessToken;
  });

  afterAll(async () => {
    // Clean up
    await prisma.courseEnrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.courseModule.deleteMany();
    await prisma.course.deleteMany();
    await prisma.student.deleteMany();
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'enroll-admin@test.com',
            'enroll-student1@test.com',
            'enroll-student2@test.com',
          ],
        },
      },
    });

    await app.close();
  });

  describe('POST /courses/:courseId/enroll (Enroll Student)', () => {
    it('should allow admin to enroll a student in a published course', async () => {
      const response = await request(app.getHttpServer())
        .post(`/courses/${publishedCourseId}/enroll`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: studentId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.studentId).toBe(studentId);
      expect(response.body.courseId).toBe(publishedCourseId);
      expect(response.body.status).toBe(CourseEnrollmentStatus.ACTIVE);
      expect(response.body.progressPercentage).toBe(0);
      expect(response.body).toHaveProperty('student');
      expect(response.body).toHaveProperty('course');

      enrollmentId = response.body.id;
    });

    it('should allow student to enroll themselves in a published course', async () => {
      const response = await request(app.getHttpServer())
        .post(`/courses/${publishedCourseId}/enroll`)
        .set('Authorization', `Bearer ${student2Token}`)
        .send({
          studentId: student2Id,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.studentId).toBe(student2Id);
      expect(response.body.courseId).toBe(publishedCourseId);
      expect(response.body.status).toBe(CourseEnrollmentStatus.ACTIVE);
      expect(response.body.progressPercentage).toBe(0);
    });

    it('should prevent duplicate enrollments (R5.2)', async () => {
      await request(app.getHttpServer())
        .post(`/courses/${publishedCourseId}/enroll`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: studentId,
        })
        .expect(409); // Conflict - already enrolled
    });

    it('should prevent enrollment in non-published courses', async () => {
      await request(app.getHttpServer())
        .post(`/courses/${draftCourseId}/enroll`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: studentId,
        })
        .expect(400); // Bad Request - course not published
    });

    it('should prevent student from enrolling another student', async () => {
      // Create a new course for this test
      const newCourse = await prisma.course.create({
        data: {
          title: 'Another Published Course',
          status: CourseStatus.PUBLISHED,
          createdBy: adminUserId,
        },
      });

      await request(app.getHttpServer())
        .post(`/courses/${newCourse.id}/enroll`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studentId: student2Id, // Trying to enroll a different student
        })
        .expect(400); // Bad Request - students can only enroll themselves

      // Clean up
      await prisma.course.delete({ where: { id: newCourse.id } });
    });

    it('should return 404 for non-existent course', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/courses/${nonExistentId}/enroll`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: studentId,
        })
        .expect(404);
    });

    it('should return 404 for non-existent student', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/courses/${publishedCourseId}/enroll`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: nonExistentId,
        })
        .expect(404);
    });

    it('should require studentId in request body', async () => {
      await request(app.getHttpServer())
        .post(`/courses/${publishedCourseId}/enroll`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('should deny unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(`/courses/${publishedCourseId}/enroll`)
        .send({
          studentId: studentId,
        })
        .expect(401);
    });
  });

  describe('GET /students/:studentId/enrollments (Get Student Enrollments)', () => {
    it('should return all enrollments for a student (R5.4)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/courses/students/${studentId}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('studentId');
      expect(response.body[0]).toHaveProperty('courseId');
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0]).toHaveProperty('progressPercentage');
      expect(response.body[0]).toHaveProperty('course');
      expect(response.body[0].course).toHaveProperty('title');
    });

    it('should allow student to view their own enrollments', async () => {
      const response = await request(app.getHttpServer())
        .get(`/courses/students/${studentId}/enrollments`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Verify all enrollments belong to the student
      response.body.forEach((enrollment: any) => {
        expect(enrollment.studentId).toBe(studentId);
      });
    });

    it('should return empty array for student with no enrollments', async () => {
      // Create a new student with no enrollments
      const newUser = await prisma.user.create({
        data: {
          email: 'no-enrollments@test.com',
          passwordHash: await bcrypt.hash('Test123!', 12),
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
        },
      });

      const newStudent = await prisma.student.create({
        data: {
          userId: newUser.id,
          admissionId: 'STU-NO-ENROLL',
          firstName: 'No',
          lastName: 'Enrollments',
          admissionDate: new Date(),
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/courses/students/${newStudent.id}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);

      // Clean up
      await prisma.student.delete({ where: { id: newStudent.id } });
      await prisma.user.delete({ where: { id: newUser.id } });
    });

    it('should return 404 for non-existent student', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/courses/students/${nonExistentId}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should order enrollments by enrolledAt descending', async () => {
      const response = await request(app.getHttpServer())
        .get(`/courses/students/${studentId}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.length > 1) {
        for (let i = 0; i < response.body.length - 1; i++) {
          const date1 = new Date(response.body[i].enrolledAt);
          const date2 = new Date(response.body[i + 1].enrolledAt);
          expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
        }
      }
    });
  });

  describe('GET /courses/:courseId/enrollments (Get Course Enrollments - Admin Only)', () => {
    it('should allow admin to view all enrollments for a course', async () => {
      const response = await request(app.getHttpServer())
        .get(`/courses/${publishedCourseId}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page');
      expect(response.body.meta).toHaveProperty('limit');
      expect(response.body.meta).toHaveProperty('totalPages');
    });

    it('should include student details in enrollments', async () => {
      const response = await request(app.getHttpServer())
        .get(`/courses/${publishedCourseId}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data[0]).toHaveProperty('student');
      expect(response.body.data[0].student).toHaveProperty('firstName');
      expect(response.body.data[0].student).toHaveProperty('lastName');
      expect(response.body.data[0].student).toHaveProperty('admissionId');
    });

    it('should support status filter', async () => {
      const response = await request(app.getHttpServer())
        .get(`/courses/${publishedCourseId}/enrollments?status=ACTIVE`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      response.body.data.forEach((enrollment: any) => {
        expect(enrollment.status).toBe(CourseEnrollmentStatus.ACTIVE);
      });
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/courses/${publishedCourseId}/enrollments?page=1&limit=5`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should deny student access to course enrollments', async () => {
      await request(app.getHttpServer())
        .get(`/courses/${publishedCourseId}/enrollments`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent course', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/courses/${nonExistentId}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('DELETE /enrollments/:id (Unenroll/Drop Course)', () => {
    it('should allow admin to unenroll a student (R5.5, R5.6)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/courses/enrollments/${enrollmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe(CourseEnrollmentStatus.DROPPED);
      expect(response.body.id).toBe(enrollmentId);

      // Verify enrollment record still exists (soft delete)
      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { id: enrollmentId },
      });
      expect(enrollment).not.toBeNull();
      expect(enrollment?.status).toBe(CourseEnrollmentStatus.DROPPED);
    });

    it('should allow student to unenroll themselves', async () => {
      // First, get student2's enrollment
      const enrollments = await prisma.courseEnrollment.findFirst({
        where: {
          studentId: student2Id,
          courseId: publishedCourseId,
          status: CourseEnrollmentStatus.ACTIVE,
        },
      });

      expect(enrollments).not.toBeNull();

      const response = await request(app.getHttpServer())
        .delete(`/courses/enrollments/${enrollments!.id}`)
        .set('Authorization', `Bearer ${student2Token}`)
        .expect(200);

      expect(response.body.status).toBe(CourseEnrollmentStatus.DROPPED);
    });

    it('should return 404 for non-existent enrollment', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/courses/enrollments/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should deny unauthenticated request', async () => {
      await request(app.getHttpServer())
        .delete(`/courses/enrollments/${enrollmentId}`)
        .expect(401);
    });
  });

  describe('Re-enrollment After Dropping', () => {
    it('should allow re-enrollment after dropping a course', async () => {
      // Re-enroll student 1 who was dropped earlier
      const response = await request(app.getHttpServer())
        .post(`/courses/${publishedCourseId}/enroll`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: studentId,
        })
        .expect(201);

      expect(response.body.status).toBe(CourseEnrollmentStatus.ACTIVE);
      expect(response.body.id).toBe(enrollmentId); // Should reactivate same enrollment
    });
  });

  describe('Progress Tracking Integration (R22)', () => {
    it('should initialize progressPercentage to 0 on enrollment (R5.3)', async () => {
      // Create a new course and student for clean test
      const testCourse = await prisma.course.create({
        data: {
          title: 'Progress Test Course',
          status: CourseStatus.PUBLISHED,
          createdBy: adminUserId,
        },
      });

      const testUser = await prisma.user.create({
        data: {
          email: 'progress-test@test.com',
          passwordHash: await bcrypt.hash('Test123!', 12),
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
        },
      });

      const testStudent = await prisma.student.create({
        data: {
          userId: testUser.id,
          admissionId: 'STU-PROGRESS-001',
          firstName: 'Progress',
          lastName: 'Test',
          admissionDate: new Date(),
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/courses/${testCourse.id}/enroll`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: testStudent.id,
        })
        .expect(201);

      expect(response.body.progressPercentage).toBe(0);

      // Clean up
      await prisma.courseEnrollment.deleteMany({
        where: { studentId: testStudent.id },
      });
      await prisma.student.delete({ where: { id: testStudent.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
      await prisma.course.delete({ where: { id: testCourse.id } });
    });
  });
});
