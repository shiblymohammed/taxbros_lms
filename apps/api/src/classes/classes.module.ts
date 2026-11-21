import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Classes Module
 * 
 * Provides class management functionality including:
 * - Class creation with unique name validation
 * - Class listing with status filtering
 * - Student enrollment management
 * - Soft delete for enrollments (INACTIVE status)
 * 
 * Endpoints:
 * - POST /classes - Create class
 * - GET /classes - List classes with status filter
 * - GET /classes/:id - Get class with active enrollments
 * - PATCH /classes/:id - Update class
 * - POST /classes/:id/students - Enroll student
 * - DELETE /classes/:id/students/:studentId - Unenroll student
 * 
 * Requirements:
 * - R4: Class management with enrollment tracking
 * 
 * Access Control:
 * - POST, PATCH, enrollment operations: ADMINISTRATOR role required
 * - GET operations: ADMINISTRATOR or STAFF roles allowed
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
