import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Staff Module
 * 
 * Provides staff profile management and permissions functionality including:
 * - Staff CRUD operations with profile creation
 * - Search and filtering by department, category
 * - Permission management (grant/revoke)
 * - Unique constraint validation for staffId
 * - Pagination support
 * 
 * Endpoints:
 * - POST /staff - Create staff profile with userId
 * - GET /staff - List staff with filtering and pagination
 * - GET /staff/:id - Get single staff with permissions
 * - PATCH /staff/:id - Update staff profile
 * - DELETE /staff/:id - Delete staff profile
 * - POST /staff/:id/permissions - Grant permission
 * - DELETE /staff/:id/permissions/:permissionId - Revoke permission
 * - GET /staff/:id/permissions - List staff permissions
 * 
 * Access Control:
 * All endpoints require ADMINISTRATOR role.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
