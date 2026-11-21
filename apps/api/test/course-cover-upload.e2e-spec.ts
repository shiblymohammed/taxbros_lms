import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

/**
 * Task 27: Course Cover Image Upload E2E Tests
 * 
 * Tests Requirements:
 * - R15.3: Validate file size max 2MB
 * - R15.4: Automatically resize images wider than 1200px
 * - R15.5: Store images in /uploads/{year}/{month}/{filename}
 * - R15.6: Update course record with image URL
 * - R15.7: Support file deletion
 * 
 * Validates:
 * - POST /upload/course-cover/:courseId (admin only)
 * - DELETE /upload/course-cover/:courseId (admin only)
 */
describe('Course Cover Image Upload (Task 27)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let courseId: string;

  // Test image buffers
  let smallImageBuffer: Buffer;
  let largeImageBuffer: Buffer;
  let oversizedImageBuffer: Buffer;

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
          in: ['upload-admin@test.com', 'upload-student@test.com'],
        },
      },
    });

    // Create admin user
    await prisma.user.create({
      data: {
        email: 'upload-admin@test.com',
        passwordHash: await bcrypt.hash('Admin123!', 12),
        role: UserRole.ADMINISTRATOR,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    // Create student user and profile
    const studentUser = await prisma.user.create({
      data: {
        email: 'upload-student@test.com',
        passwordHash: await bcrypt.hash('Student123!', 12),
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    await prisma.student.create({
      data: {
        userId: studentUser.id,
        admissionId: 'STU-UPLOAD-001',
        firstName: 'Upload',
        lastName: 'Student',
        admissionDate: new Date(),
      },
    });

    // Login as admin
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'upload-admin@test.com',
        password: 'Admin123!',
      });

    adminToken = adminLoginResponse.body.accessToken;

    // Login as student
    const studentLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'upload-student@test.com',
        password: 'Student123!',
      });

    studentToken = studentLoginResponse.body.accessToken;

    // Create a test course
    const courseResponse = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Course for Upload',
        description: 'Course to test image upload',
      });

    courseId = courseResponse.body.id;

    // Generate test images
    // Small image (800x600)
    smallImageBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();

    // Large image (1600x1200) - will be resized to 1200px width
    largeImageBuffer = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 200, g: 100, b: 150 },
      },
    })
      .jpeg()
      .toBuffer();

    // Oversized image (> 2MB)
    oversizedImageBuffer = await sharp({
      create: {
        width: 4000,
        height: 3000,
        channels: 3,
        background: { r: 150, g: 200, b: 100 },
      },
    })
      .jpeg({ quality: 100 })
      .toBuffer();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.courseEnrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.courseModule.deleteMany();
    await prisma.course.deleteMany();
    await prisma.student.deleteMany();
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['upload-admin@test.com', 'upload-student@test.com'],
        },
      },
    });

    // Clean up uploaded files
    const uploadsDir = join(process.cwd(), 'uploads');
    try {
      await fs.rm(uploadsDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }

    await app.close();
  });

  describe('POST /api/upload/course-cover/:courseId', () => {
    it('should upload a course cover image successfully (R15.5, R15.6)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', smallImageBuffer, 'test-cover.jpg');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Course cover image uploaded successfully');
      expect(response.body.coverImage).toMatch(/^\/uploads\/\d{4}\/\d{2}\//);
      expect(response.body.course.coverImage).toBe(response.body.coverImage);

      // Verify file exists
      const filePath = join(process.cwd(), response.body.coverImage.replace(/^\//, ''));
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify database was updated
      const course = await prisma.course.findUnique({
        where: { id: courseId },
      });
      expect(course.coverImage).toBe(response.body.coverImage);
    });

    it('should resize images wider than 1200px (R15.4)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', largeImageBuffer, 'large-cover.jpg');

      expect(response.status).toBe(200);

      // Verify image was resized
      const filePath = join(process.cwd(), response.body.coverImage.replace(/^\//, ''));
      const metadata = await sharp(filePath).metadata();
      expect(metadata.width).toBeLessThanOrEqual(1200);
    });

    it('should reject files larger than 2MB (R15.3)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', oversizedImageBuffer, 'huge-cover.jpg');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('File size exceeds 2MB limit');
    });

    it('should reject invalid file types', async () => {
      const textBuffer = Buffer.from('This is not an image');

      const response = await request(app.getHttpServer())
        .post(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', textBuffer, 'test.txt');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid file type');
    });

    it('should reject upload without file', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No file');
    });

    it('should reject upload for non-existent course', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .post(`/api/upload/course-cover/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', smallImageBuffer, 'test-cover.jpg');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Course not found');
    });

    it('should deny access to students (authorization)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('file', smallImageBuffer, 'test-cover.jpg');

      expect(response.status).toBe(403);
    });

    it('should replace existing cover image when uploading new one', async () => {
      // Upload first image
      const firstResponse = await request(app.getHttpServer())
        .post(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', smallImageBuffer, 'first-cover.jpg');

      const firstImagePath = firstResponse.body.coverImage;

      // Upload second image
      const secondResponse = await request(app.getHttpServer())
        .post(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', smallImageBuffer, 'second-cover.jpg');

      const secondImagePath = secondResponse.body.coverImage;

      expect(secondImagePath).not.toBe(firstImagePath);

      // Verify course has new image
      const course = await prisma.course.findUnique({
        where: { id: courseId },
      });
      expect(course.coverImage).toBe(secondImagePath);
    });
  });

  describe('DELETE /api/upload/course-cover/:courseId', () => {
    it('should delete course cover image successfully (R15.7)', async () => {
      // First upload an image
      const uploadResponse = await request(app.getHttpServer())
        .post(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', smallImageBuffer, 'delete-test.jpg');

      const imagePath = uploadResponse.body.coverImage;
      const filePath = join(process.cwd(), imagePath.replace(/^\//, ''));

      // Verify file exists
      let fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Delete the image
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.message).toBe('Course cover image deleted successfully');

      // Verify file was deleted
      fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(false);

      // Verify database was updated
      const course = await prisma.course.findUnique({
        where: { id: courseId },
      });
      expect(course.coverImage).toBeNull();
    });

    it('should handle deletion when no cover image exists', async () => {
      // Ensure course has no cover image
      await prisma.course.update({
        where: { id: courseId },
        data: { coverImage: null },
      });

      const response = await request(app.getHttpServer())
        .delete(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('No cover image to delete');
    });

    it('should deny access to students (authorization)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/upload/course-cover/${courseId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject deletion for non-existent course', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .delete(`/api/upload/course-cover/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Course not found');
    });
  });
});
