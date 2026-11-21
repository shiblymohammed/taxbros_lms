import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Users Module
 * 
 * Provides user account management functionality including:
 * - User CRUD operations with role-based profile creation
 * - Search and filtering by role, status, name, email
 * - Account activation/deactivation
 * - Uniqueness validation for email, admissionId, staffId
 * - Pagination support
 * 
 * Endpoints:
 * - POST /users - Create user with role selection and profile
 * - GET /users - List users with filtering and pagination
 * - GET /users/:id - Get single user with profile
 * - PATCH /users/:id - Update user with validation
 * - PATCH /users/:id/activate - Activate account
 * - PATCH /users/:id/deactivate - Deactivate account
 * 
 * Access Control:
 * All endpoints require ADMINISTRATOR role.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
