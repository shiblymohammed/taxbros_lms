import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateUserDto,
  UpdateUserDto,
  FilterUsersDto,
} from './dto';
import { StaffAccessService } from '../auth/staff-access.service';
import { ForbiddenException, Req } from '@nestjs/common';

/**
 * Users Controller
 * 
 * Provides user account management endpoints for administrators.
 * All endpoints require ADMINISTRATOR role.
 * 
 * Endpoints:
 * - POST /users - Create user with role-based profile
 * - GET /users - List users with filtering and pagination
 * - GET /users/:id - Get single user with profile
 * - PATCH /users/:id - Update user with validation
 * - PATCH /users/:id/activate - Activate account
 * - PATCH /users/:id/deactivate - Deactivate account
 * 
 * Requirements:
 * - R1: User Account Management
 * - R2: Role-Based Access Control
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
// Administrators, or staff with MANAGE_STUDENTS / MANAGE_STAFF (checked per account below)
@Roles(UserRole.STAFF)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly access: StaffAccessService,
  ) {}

  /**
   * Create a new user account
   * 
   * POST /users
   * 
   * Requirements:
   * - R1: Require email, password, and role
   * - R1: Students require admissionId, firstName, lastName, admissionDate
   * - R1: Staff require staffId, firstName, lastName, designation, department, category, joiningDate
   * - R1: Enforce unique email, admissionId, staffId
   * - R1: Hash passwords with bcrypt (12 salt rounds)
   * - R1: Set mustChangePassword to TRUE
   * 
   * Request Body:
   * {
   *   "email": "student@example.com",
   *   "password": "SecurePass123",
   *   "role": "STUDENT",
   *   "studentProfile": {
   *     "admissionId": "STU2024001",
   *     "firstName": "John",
   *     "lastName": "Doe",
   *     "admissionDate": "2024-01-15"
   *   }
   * }
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "email": "student@example.com",
   *   "role": "STUDENT",
   *   "status": "PENDING",
   *   "mustChangePassword": true,
   *   "studentProfile": { ... },
   *   "createdAt": "2024-01-15T10:00:00Z"
   * }
   * 
   * Errors:
   * - 400: Missing required profile fields
   * - 409: Email, admissionId, or staffId already in use
   */
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser('userId') currentUserId: string,
    @Req() req: any,
  ) {
    await this.access.assertCanCreate(req.user, createUserDto.role);
    return this.usersService.create(createUserDto, currentUserId);
  }

  /**
   * List users with filtering and pagination
   * 
   * GET /users?role=STUDENT&status=ACTIVE&search=john&page=1&limit=20
   * 
   * Requirements:
   * - R1: Support filtering by role, status, name, email
   * - Pagination with page, limit, and metadata
   * 
   * Query Parameters:
   * - role: UserRole (optional) - Filter by role
   * - status: UserStatus (optional) - Filter by status
   * - search: string (optional) - Search by name or email
   * - page: number (optional, default: 1) - Page number
   * - limit: number (optional, default: 10, max: 100) - Results per page
   * 
   * Response:
   * {
   *   "data": [
   *     {
   *       "id": "uuid",
   *       "email": "student@example.com",
   *       "role": "STUDENT",
   *       "status": "ACTIVE",
   *       "studentProfile": { ... }
   *     }
   *   ],
   *   "meta": {
   *     "total": 150,
   *     "page": 1,
   *     "limit": 20,
   *     "totalPages": 8
   *   }
   * }
   */
  @Get()
  async findAll(@Query() filters: FilterUsersDto, @Req() req: any) {
    // Staff only see the account types they manage
    const roles = await this.access.manageableRoles(req.user);
    if (roles !== null) {
      if (roles.length === 0) {
        throw new ForbiddenException('Access denied. Required permission: MANAGE_STUDENTS or MANAGE_STAFF');
      }
      if (filters.role && !roles.includes(filters.role)) {
        throw new ForbiddenException('You cannot view these accounts');
      }
    }
    return roles ? this.usersService.findAll(filters, roles) : this.usersService.findAll(filters);
  }

  /**
   * Get a single user by ID
   * 
   * GET /users/:id
   * 
   * Requirements:
   * - R1: Get user with profile inclusion
   * - Returns user with studentProfile or staffProfile based on role
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "email": "student@example.com",
   *   "role": "STUDENT",
   *   "status": "ACTIVE",
   *   "mustChangePassword": false,
   *   "studentProfile": {
   *     "id": "uuid",
   *     "admissionId": "STU2024001",
   *     "firstName": "John",
   *     "lastName": "Doe",
   *     "admissionDate": "2024-01-15"
   *   },
   *   "createdAt": "2024-01-15T10:00:00Z"
   * }
   * 
   * Errors:
   * - 404: User not found
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.access.assertCanManageUser(req.user, id);
    return this.usersService.findOne(id);
  }

  /**
   * Update user account
   * 
   * PATCH /users/:id
   * 
   * Requirements:
   * - R1: Validate all required fields
   * - R1: Enforce uniqueness constraints
   * - Profile updates are merged (not replaced)
   * 
   * Request Body (all fields optional):
   * {
   *   "email": "newemail@example.com",
   *   "studentProfile": {
   *     "firstName": "Jane",
   *     "phoneNumber": "1234567890"
   *   }
   * }
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "email": "newemail@example.com",
   *   "role": "STUDENT",
   *   "studentProfile": { ... },
   *   "updatedAt": "2024-01-16T10:00:00Z"
   * }
   * 
   * Errors:
   * - 404: User not found
   * - 409: Email, admissionId, or staffId already in use
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Req() req: any) {
    await this.access.assertCanManageUser(req.user, id);
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Activate user account
   * 
   * PATCH /users/:id/activate
   * 
   * Requirements:
   * - R1: Set account status to ACTIVE
   * - R1: Grant authentication access
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "email": "student@example.com",
   *   "status": "ACTIVE",
   *   "studentProfile": { ... }
   * }
   * 
   * Errors:
   * - 404: User not found
   */
  @Patch(':id/activate')
  async activate(@Param('id') id: string, @Req() req: any) {
    await this.access.assertCanManageUser(req.user, id);
    return this.usersService.activate(id);
  }

  /**
   * Deactivate user account
   * 
   * PATCH /users/:id/deactivate
   * 
   * Requirements:
   * - R1: Set account status to INACTIVE
   * - R1: Deny authentication access
   * - R1: Retain all historical records
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "email": "student@example.com",
   *   "status": "INACTIVE",
   *   "studentProfile": { ... }
   * }
   * 
   * Errors:
   * - 404: User not found
   */
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string, @Req() req: any) {
    await this.access.assertCanManageUser(req.user, id);
    return this.usersService.deactivate(id);
  }

  /**
   * Reset a user's password (R36.4)
   *
   * Returns a one-time temporary password; the user must change it at next sign-in.
   * All of the user's sessions are signed out.
   */
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Param('id') id: string, @CurrentUser('userId') actingUserId: string, @Req() req: any) {
    await this.access.assertCanManageUser(req.user, id);
    return this.usersService.resetPassword(id, actingUserId);
  }
}
