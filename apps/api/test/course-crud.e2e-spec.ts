import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole, UserStatus, CourseStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Task 26: Course CRUD Endpoints E2E Tests
 * 
 * Tests Requirements:
 * - R15: Course creation and management
 * - R16: Course publishing control
 * 
 * Validates:
 * - POST /courses (admin only)
 * - GET /courses (list all published courses)
 * - GET /courses/:id (get course details)
 * - PATCH /courses/:id (update course, admin only)
 * - DELETE /courses/:id (soft delete, admin only)
 */
describe('Course CRUD Endpoints (Task 26)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let adminUserId: string;
  let courseId: string;

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
          in: ['course-admin@test.com', 'course-student@test.com'],
        },
      },
    });

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'course-admin@test.com',
        passwordHash: await bcrypt.hash('Admin123!', 12),
        role: UserRole.ADMINISTRATOR,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });
    adminUserId = adminUser.id;

    // Create student user and profile
    const studentUser = await prisma.user.create({
      data: {
        email: 'course-student@test.com',
        passwordHash: await bcrypt.hash('Student123!', 12),
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    await prisma.student.create({
      data: {
        userId: studentUser.id,
        admissionId: 'STU-COURSE-001',
        firstName: 'Course',
        lastName: 'Student',
        admissionDate: new Date(),
      },
    });

    // Login as admin
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'course-admin@test.com',
        password: 'Admin123!',
      })
      .expect(200);

    adminToken = adminLoginResponse.body.accessToken;

    // Login as student
    const studentLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'course-student@test.com',
        password: 'Student123!',
      })
      .expect(200);

    studentToken = studentLoginResponse.body.accessToken;
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
          in: ['course-admin@test.com', 'course-student@test.com'],
        },
      },
    });

    await app.close();
  });

  describe('POST /courses (Create Course)', () => {
    it('should allow admin to create a course with title and description', async () => {
      const response = await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Introduction to Tax Filing',
          description: 'Learn the basics of tax filing and compliance',
          displayOrder: 1,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Introduction to Tax Filing');
      expect(response.body.description).toBe(
        'Learn the basics of tax filing and compliance',
      );
      expect(response.body.status).toBe(CourseStatus.DRAFT);
      expect(response.body.displayOrder).toBe(1);
      expect(response.body.createdBy).toBe(adminUserId);

      courseId = response.body.id;
    });

    it('should require title field', async () => {
      await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Course without title',
        })
        .expect(400);
    });

    it('should deny student from creating a course', async () => {
      await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Unauthorized Course',
          description: 'This should fail',
        })
        .expect(403);
    });

    it('should deny unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/courses')
        .send({
          title: 'Unauthenticated Course',
        })
        .expect(401);
    });
  });

  describe('GET /courses (List Courses)', () => {
    it('should return all courses for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/courses')
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

    it('should return only published courses for students', async () => {
      const response = await request(app.getHttpServer())
        .get('/courses')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Since the course is DRAFT, students should not see it
      const draftCourses = response.body.data.filter(
        (course: any) => course.status === CourseStatus.DRAFT,
      );
      expect(draftCourses.length).toBe(0);
    });

    it('should support status filter', async () => {
      const response = await request(app.getHttpServer())
        .get('/courses?status=DRAFT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      response.body.data.forEach((course: any) => {
        expect(course.status).toBe(CourseStatus.DRAFT);
      });
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/courses?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /courses/:id (Get Course Details)', () => {
    it('should return course with modules and lessons', async () => {
      const response = await request(app.getHttpServer())
        .get(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(courseId);
      expect(response.body.title).toBe('Introduction to Tax Filing');
      expect(response.body).toHaveProperty('modules');
      expect(Array.isArray(response.body.modules)).toBe(true);
      expect(response.body).toHaveProperty('_count');
    });

    it('should return 404 for non-existent course', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/courses/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should allow students to view course details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.id).toBe(courseId);
    });
  });

  describe('PATCH /courses/:id (Update Course)', () => {
    it('should allow admin to update course title', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Advanced Tax Filing',
        })
        .expect(200);

      expect(response.body.title).toBe('Advanced Tax Filing');
    });

    it('should allow admin to publish course', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: CourseStatus.PUBLISHED,
        })
        .expect(200);

      expect(response.body.status).toBe(CourseStatus.PUBLISHED);
    });

    it('should allow admin to unpublish course', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: CourseStatus.DRAFT,
        })
        .expect(200);

      expect(response.body.status).toBe(CourseStatus.DRAFT);
    });

    it('should allow admin to update display order', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          displayOrder: 5,
        })
        .expect(200);

      expect(response.body.displayOrder).toBe(5);
    });

    it('should deny student from updating course', async () => {
      await request(app.getHttpServer())
        .patch(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('should return 404 for non-existent course', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .patch(`/courses/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Does not exist',
        })
        .expect(404);
    });
  });

  describe('DELETE /courses/:id (Soft Delete Course)', () => {
    it('should allow admin to archive course (soft delete)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe(CourseStatus.ARCHIVED);

      // Verify course still exists in database
      const archivedCourse = await prisma.course.findUnique({
        where: { id: courseId },
      });
      expect(archivedCourse).not.toBeNull();
      expect(archivedCourse?.status).toBe(CourseStatus.ARCHIVED);
    });

    it('should deny student from deleting course', async () => {
      // Create another course to test
      const newCourse = await prisma.course.create({
        data: {
          title: 'Course to Delete',
          status: CourseStatus.DRAFT,
          createdBy: adminUserId,
        },
      });

      await request(app.getHttpServer())
        .delete(`/courses/${newCourse.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent course', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/courses/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Authorization and Access Control', () => {
    it('should deny all requests without authentication', async () => {
      await request(app.getHttpServer()).get('/courses').expect(401);

      await request(app.getHttpServer())
        .get(`/courses/${courseId}`)
        .expect(401);

      await request(app.getHttpServer())
        .post('/courses')
        .send({ title: 'Test' })
        .expect(401);

      await request(app.getHttpServer())
        .patch(`/courses/${courseId}`)
        .send({ title: 'Test' })
        .expect(401);

      await request(app.getHttpServer())
        .delete(`/courses/${courseId}`)
        .expect(401);
    });
  });
});
