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
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LabService } from './lab.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, LabType } from '@prisma/client';
import { SubmitGstLabDto } from './dto/submit-gst-lab.dto';
import { SubmitItrLabDto } from './dto/submit-itr-lab.dto';
import { SubmitMcaLabDto } from './dto/submit-mca-lab.dto';
import { UpdateSampleDataDto } from './dto/update-sample-data.dto';
import { UpdateLabStatusDto } from './dto/update-lab-status.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { StaffPermissionType } from '@prisma/client';

/** Resolve the Student profile id (LabAttempt.studentId references Student.id). */
function requireStudentId(user: any): string {
  if (!user?.studentId) {
    throw new ForbiddenException('Student profile not found for this account');
  }
  return user.studentId;
}

/**
 * Lab Controller
 * 
 * Provides endpoints for government portal lab simulations:
 * - GET /labs - List all labs (students see active only)
 * - GET /labs/:type - Get lab details with sample data
 * - POST /labs/:type/submit - Submit lab attempt
 * - GET /labs/:type/attempts - Get attempt history for a lab type
 * - GET /labs/attempts/:id - Get detailed attempt information
 * - PATCH /labs/:type/sample-data - Update sample data (admin only)
 * 
 * Requirements: R27, R28, R29, R30, R31
 * Task 53: Implement lab endpoints
 * Test Coverage: T6 (Lab operations)
 */
@ApiTags('Labs')
@ApiBearerAuth()
@Controller('labs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LabController {
  constructor(private readonly labService: LabService) {}

  /**
   * Get all labs
   * 
   * GET /labs
   * 
   * Students see only active labs.
   * Administrators see all labs regardless of active status.
   * 
   * Requirements: R27
   */
  @Get()
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all labs' })
  @ApiResponse({
    status: 200,
    description: 'List of labs returned successfully',
  })
  async getAllLabs(@CurrentUser() user: any) {
    return this.labService.getAllLabs(user.role);
  }

  /**
   * Get lab by type with sample data
   * 
   * GET /labs/:type
   * 
   * Returns lab details including sample data for the specified type.
   * Students can only access active labs.
   * 
   * Requirements: R27, R28, R29, R30
   */
  @Get(':type')
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get lab details by type' })
  @ApiResponse({
    status: 200,
    description: 'Lab details returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Lab not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Lab is not active (students only)',
  })
  async getLabByType(
    @Param('type') type: string,
    @CurrentUser() user: any,
  ) {
    // Validate lab type
    if (!Object.values(LabType).includes(type as LabType)) {
      throw new BadRequestException('Invalid lab type');
    }

    return this.labService.getLabByType(type as LabType, user.role);
  }

  /**
   * Submit lab attempt
   * 
   * POST /labs/:type/submit
   * 
   * Validates form data, generates simulated result, and stores the attempt.
   * Each lab type has different form requirements:
   * - GST_REGISTRATION: businessName, businessType, pan, address, signatory
   * - INCOME_TAX_RETURN: taxpayerName, pan, incomeSource, grossIncome, deductions
   * - MCA_INCORPORATION: companyName, directors[], registeredAddress, authorizedCapital
   * 
   * Requirements: R28, R29, R30, R31
   */
  @Post(':type/submit')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit lab attempt' })
  @ApiResponse({
    status: 201,
    description: 'Lab attempt submitted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 403,
    description: 'Lab is not active',
  })
  @ApiResponse({
    status: 404,
    description: 'Lab not found',
  })
  async submitLabAttempt(
    @Param('type') type: string,
    @Body() body: SubmitGstLabDto | SubmitItrLabDto | SubmitMcaLabDto,
    @CurrentUser() user: any,
  ) {
    // Validate lab type
    if (!Object.values(LabType).includes(type as LabType)) {
      throw new BadRequestException('Invalid lab type');
    }

    return this.labService.submitLabAttempt(
      type as LabType,
      body,
      requireStudentId(user),
    );
  }

  /**
   * Get lab attempts for a specific lab type
   * 
   * GET /labs/:type/attempts?studentId=xxx
   * 
   * Students can only view their own attempts.
   * Administrators can view all attempts or filter by student.
   * 
   * Requirements: R31
   */
  @Get(':type/attempts')
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get lab attempt history for a lab type' })
  @ApiResponse({
    status: 200,
    description: 'Lab attempts returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Lab not found',
  })
  async getLabAttempts(
    @Param('type') type: string,
    @Query('studentId') studentId: string | undefined,
    @CurrentUser() user: any,
  ) {
    // Validate lab type
    if (!Object.values(LabType).includes(type as LabType)) {
      throw new BadRequestException('Invalid lab type');
    }

    const ownerId =
      user.role === UserRole.STUDENT ? requireStudentId(user) : user.userId;

    return this.labService.getLabAttempts(
      type as LabType,
      ownerId,
      user.role,
      studentId,
    );
  }

  /**
   * Get lab attempt by ID
   * 
   * GET /labs/attempts/:id
   * 
   * Students can only view their own attempts.
   * Administrators can view any attempt.
   * 
   * Requirements: R31
   */
  @Get('attempts/:id')
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get detailed lab attempt information' })
  @ApiResponse({
    status: 200,
    description: 'Lab attempt details returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Lab attempt not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot view another student\'s attempt',
  })
  async getLabAttemptById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const ownerId =
      user.role === UserRole.STUDENT ? requireStudentId(user) : user.userId;

    return this.labService.getLabAttemptById(id, ownerId, user.role);
  }

  /**
   * Update lab sample data
   * 
   * PATCH /labs/:type/sample-data
   * 
   * Administrator-only endpoint to update the sample data for a lab type.
   * Sample data structure depends on lab type.
   * 
   * Requirements: R27
   */
  @Patch(':type/sample-data')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_LABS)
  @ApiOperation({ summary: 'Update lab sample data (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Sample data updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Lab not found',
  })
  async updateSampleData(
    @Param('type') type: string,
    @Body() updateSampleDataDto: UpdateSampleDataDto,
    @CurrentUser() user: any,
  ) {
    // Validate lab type
    if (!Object.values(LabType).includes(type as LabType)) {
      throw new BadRequestException('Invalid lab type');
    }

    return this.labService.updateSampleData(
      type as LabType,
      updateSampleDataDto.sampleData,
      user.userId,
    );
  }

  /**
   * Activate or deactivate a lab
   *
   * PATCH /labs/:type/status
   *
   * Administrator-only. Inactive labs are hidden from students.
   *
   * Requirements: R27
   */
  @Patch(':type/status')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_LABS)
  @ApiOperation({ summary: 'Activate or deactivate a lab (admin only)' })
  @ApiResponse({ status: 200, description: 'Lab status updated successfully' })
  @ApiResponse({ status: 404, description: 'Lab not found' })
  async updateLabStatus(
    @Param('type') type: string,
    @Body() dto: UpdateLabStatusDto,
  ) {
    if (!Object.values(LabType).includes(type as LabType)) {
      throw new BadRequestException('Invalid lab type');
    }

    return this.labService.updateLabStatus(type as LabType, dto.isActive);
  }
}
