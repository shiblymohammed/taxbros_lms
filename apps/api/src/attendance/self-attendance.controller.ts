import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffPermissionType, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { SelfAttendanceService } from './self-attendance.service';
import { LocationDto, StudentCheckInDto } from './dto/self-check-in.dto';
import { normalizeIp, type Coordinates } from './self-check';

const coordsOf = (dto: LocationDto): Coordinates | null =>
  typeof dto?.latitude === 'number' && typeof dto?.longitude === 'number' ? { latitude: dto.latitude, longitude: dto.longitude } : null;

/** Client address as Express sees it (honours the "trust proxy" setting behind a host's proxy). */
const ipOf = (req: any): string => normalizeIp(req.ip ?? req.socket?.remoteAddress);

/**
 * Self attendance: staff check-in/out, the teacher's class QR session, and student check-in.
 */
@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SelfAttendanceController {
  constructor(private readonly selfAttendance: SelfAttendanceService) {}

  /** The address the API sees for this device, so an administrator can add the institute network. */
  @Get('self/network')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: "This device's network address, as the server sees it" })
  network(@Request() req: any) {
    return { ip: ipOf(req) };
  }

  // ---- Staff

  @Get('self/staff/today')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: "My attendance today and the check-in rules (staff)" })
  staffToday(@Request() req: any) {
    return this.selfAttendance.staffToday(req.user, ipOf(req));
  }

  @Post('self/staff/check-in')
  @Roles(UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check in for today (staff, at the institute)' })
  staffCheckIn(@Body() dto: LocationDto, @Request() req: any) {
    return this.selfAttendance.staffCheckIn(req.user, ipOf(req), coordsOf(dto));
  }

  @Post('self/staff/check-out')
  @Roles(UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check out for today (staff, at the institute)' })
  staffCheckOut(@Body() dto: LocationDto, @Request() req: any) {
    return this.selfAttendance.staffCheckOut(req.user, ipOf(req), coordsOf(dto));
  }

  // ---- Teacher: class QR session

  @Post('student/registers/:id/self-check-in/start')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Start student self check-in on today's register" })
  startClassCheckIn(@Param('id') id: string) {
    return this.selfAttendance.startClassCheckIn(id);
  }

  @Get('student/registers/:id/self-check-in')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
  @ApiOperation({ summary: 'Current class code and how many students have checked in' })
  classCheckInState(@Param('id') id: string) {
    return this.selfAttendance.classCheckInState(id);
  }

  @Post('student/registers/:id/self-check-in/close')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close self check-in; students without a mark become Absent' })
  closeClassCheckIn(@Param('id') id: string, @Request() req: any) {
    return this.selfAttendance.closeClassCheckIn(id, req.user.userId);
  }

  // ---- Student

  @Get('self/student/today')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: "My classes today and whether check-in is open (student)" })
  studentToday(@Request() req: any) {
    return this.selfAttendance.studentToday(req.user);
  }

  @Post('self/student/check-in')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check in to a class with the code on the teacher screen (student)' })
  studentCheckIn(@Body() dto: StudentCheckInDto, @Request() req: any) {
    return this.selfAttendance.studentCheckIn(req.user, { code: dto.code, registerId: dto.registerId }, ipOf(req), coordsOf(dto));
  }
}
