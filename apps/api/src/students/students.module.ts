import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Students Module
 * 
 * Provides student profile management functionality including:
 * - Student account creation with User and profile
 * - Search and filtering by admission ID, class, date range
 * - Student profile updates with uniqueness validation
 * - Retrieve student details with enrollments
 * 
 * Endpoints:
 * - POST /students - Create student account
 * - GET /students - List students with filtering and pagination
 * - GET /students/:id - Get single student with enrollments
 * - PATCH /students/:id - Update student profile
 * 
 * Requirements:
 * - R1: User management (Student accounts)
 * 
 * Access Control:
 * - POST, GET (list), PATCH: ADMINISTRATOR role required
 * - GET /:id: ADMINISTRATOR or STUDENT role (students can view own profile)
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
