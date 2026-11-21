import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { GetStaffQueryDto } from './dto/get-staff-query.dto';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { StaffAccessService } from '../auth/staff-access.service';
import { Req } from '@nestjs/common';
import { StaffPermissionType } from '@prisma/client';

/**
 * Staff Controller
 * 
 * Manages staff profiles and permissions.
 * All endpoints require ADMINISTRATOR role.
 * 
 * Endpoints:
 * - POST /staff - Create staff profile with userId
 * - GET /staff - List staff with filters (department, category)
 * - GET /staff/:id - Get staff by ID
 * - PATCH /staff/:id - Update staff profile
 * - DELETE /staff/:id - Delete staff profile
 * - POST /staff/:id/permissions - Grant permission
 * - DELETE /staff/:id/permissions/:permissionId - Revoke permission
 * - GET /staff/:id/permissions - List staff permissions
 */
@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly access: StaffAccessService,
  ) {}

  /**
   * Create a new staff profile
   * Requires: ADMINISTRATOR role
   * Body: { userId, staffId, firstName, lastName, designation, department, category, joiningDate }
   */
  @Post()
  @Roles(UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateStaffDto & { userId: string }) {
    const { userId, ...staffData } = dto;
    return this.staffService.create(userId, staffData);
  }

  /**
   * Get all staff with filtering and pagination
   * Requires: ADMINISTRATOR role
   * Query params: department, category, search, page, limit
   */
  @Get()
  @Roles(UserRole.STAFF)
  async findAll(@Query() query: GetStaffQueryDto, @Req() req: any) {
    await this.access.assertAny(req.user, [StaffPermissionType.MANAGE_STAFF]);
    return this.staffService.findAll(query);
  }

  /**
   * Get single staff by ID
   * Requires: ADMINISTRATOR role
   */
  @Get(':id')
  @Roles(UserRole.STAFF)
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.access.assertCanManageProfile(req.user, 'staff', id);
    return this.staffService.findOne(id);
  }

  /**
   * Update staff profile
   * Requires: ADMINISTRATOR role
   */
  @Patch(':id')
  @Roles(UserRole.STAFF)
  async update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @Req() req: any) {
    await this.access.assertCanManageProfile(req.user, 'staff', id);
    return this.staffService.update(id, dto);
  }

  /**
   * Delete staff profile
   * Requires: ADMINISTRATOR role
   */
  @Delete(':id')
  @Roles(UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.access.assertCanManageProfile(req.user, 'staff', id);
    return this.staffService.remove(id);
  }

  /**
   * Grant permission to staff
   * Requires: ADMINISTRATOR role
   * Body: { permission: StaffPermissionType }
   */
  @Post(':id/permissions')
  @Roles(UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.CREATED)
  async grantPermission(
    @Param('id') staffId: string,
    @Body() dto: GrantPermissionDto,
    @Request() req: any,
  ) {
    return this.staffService.grantPermission(
      staffId,
      dto.permission,
      req.user.userId,
    );
  }

  /**
   * Revoke permission from staff
   * Requires: ADMINISTRATOR role
   */
  @Delete(':id/permissions/:permissionId')
  @Roles(UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.OK)
  async revokePermission(
    @Param('id') staffId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.staffService.revokePermission(staffId, permissionId);
  }

  /**
   * Get all permissions for a staff member
   * Requires: ADMINISTRATOR role
   */
  @Get(':id/permissions')
  @Roles(UserRole.ADMINISTRATOR)
  async getPermissions(@Param('id') staffId: string) {
    return this.staffService.getPermissions(staffId);
  }
}
