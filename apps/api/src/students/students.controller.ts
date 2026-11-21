import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StaffPermissionType, UserRole } from '@prisma/client';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateStudentDto,
  UpdateStudentDto,
  FilterStudentsDto,
  GetStudentAttendanceQueryDto,
} from './dto';
import { StaffAccessService } from '../auth/staff-access.service';

/**
 * Students Controller
 * 
 * Provides student profile management endpoints for administrators.
 * All endpoints require ADMINISTRATOR role except GET /students/:id which
 * also allows STUDENT role (students can view their own profile).
 * 
 * Endpoints:
 * - POST /students - Create student account with User and profile
 * - GET /students - List students with filtering and pagination
 * - GET /students/:id - Get single student with enrollments
 * - PATCH /students/:id - Update student profile with validation
 * 
 * Requirements:
 * - R1: User management (Student accounts)
 * 
 * Test Coverage:
 * - T1: User management (Student accounts)
 */
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly access: StaffAccessService,
  ) {}

  /**
   * Create a new student account
   * 
   * POST /students
   * 
   * Requirements:
   * - R1: Email, password required for User account
   * - R1: admissionId, firstName, lastName, admissionDate required
   * - R1: Enforce unique email and admissionId
   * - R1: Hash passwords with bcrypt (12 salt rounds)
   * - R1: Set mustChangePassword to TRUE
   * 
   * Request Body:
   * {
   *   "email": "student@example.com",
   *   "password": "SecurePass123",
   *   "admissionId": "STU2024001",
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "admissionDate": "2024-01-15",
   *   "dateOfBirth": "2005-05-20",
   *   "gender": "Male",
   *   "phoneNumber": "1234567890",
   *   "address": "123 Main St",
   *   "city": "Mumbai",
   *   "state": "Maharashtra",
   *   "pincode": "400001"
   * }
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "userId": "uuid",
   *   "admissionId": "STU2024001",
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "admissionDate": "2024-01-15T00:00:00.000Z",
   *   "user": {
   *     "id": "uuid",
   *     "email": "student@example.com",
   *     "role": "STUDENT",
   *     "status": "PENDING",
   *     "mustChangePassword": true
   *   }
   * }
   * 
   * Errors:
   * - 400: Missing required fields or password too short
   * - 409: Email or admissionId already in use
   */
  @Post()
  @Roles(UserRole.STAFF)
  async create(
    @Body() createStudentDto: CreateStudentDto,
    @CurrentUser('userId') currentUserId: string,
    @Request() req: any,
  ) {
    await this.access.assertAny(req.user, [StaffPermissionType.MANAGE_STUDENTS]);
    return this.studentsService.create(createStudentDto, currentUserId);
  }

  /**
   * List students with filtering and pagination
   * 
   * GET /students?search=john&classId=uuid&admissionDateFrom=2024-01-01&page=1&limit=20
   * 
   * Requirements:
   * - R1: Support filtering by admission ID, class enrollment, admission date range
   * - R1: Support searching by name, email, admission ID
   * - Pagination with page, limit, and metadata
   * 
   * Query Parameters:
   * - search: string (optional) - Search by name, email, or admission ID
   * - classId: string (optional) - Filter by class enrollment (UUID)
   * - admissionDateFrom: string (optional) - Filter by admission date from (ISO date)
   * - admissionDateTo: string (optional) - Filter by admission date to (ISO date)
   * - page: number (optional, default: 1) - Page number
   * - limit: number (optional, default: 10, max: 100) - Results per page
   * 
   * Response:
   * {
   *   "data": [
   *     {
   *       "id": "uuid",
   *       "userId": "uuid",
   *       "admissionId": "STU2024001",
   *       "firstName": "John",
   *       "lastName": "Doe",
   *       "admissionDate": "2024-01-15T00:00:00.000Z",
   *       "user": {
   *         "id": "uuid",
   *         "email": "student@example.com",
   *         "role": "STUDENT",
   *         "status": "ACTIVE"
   *       }
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
  @Roles(UserRole.STAFF)
  async findAll(@Query() filters: FilterStudentsDto, @Request() req: any) {
    // Staff who manage students, classes or course enrolments need the student list
    await this.access.assertAny(req.user, [
      StaffPermissionType.MANAGE_STUDENTS,
      StaffPermissionType.MANAGE_CLASSES,
      StaffPermissionType.MANAGE_COURSES,
    ]);
    return this.studentsService.findAll(filters);
  }

  /**
   * Get a single student by ID with enrollments
   * 
   * GET /students/:id
   * 
   * Requirements:
   * - R1: Get student with User data and enrollments
   * - Students can only view their own profile
   * - Administrators can view any student profile
   * - Includes class enrollments and course enrollments
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "userId": "uuid",
   *   "admissionId": "STU2024001",
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "admissionDate": "2024-01-15T00:00:00.000Z",
   *   "dateOfBirth": "2005-05-20T00:00:00.000Z",
   *   "gender": "Male",
   *   "phoneNumber": "1234567890",
   *   "address": "123 Main St",
   *   "city": "Mumbai",
   *   "state": "Maharashtra",
   *   "pincode": "400001",
   *   "user": {
   *     "id": "uuid",
   *     "email": "student@example.com",
   *     "role": "STUDENT",
   *     "status": "ACTIVE"
   *   },
   *   "classEnrollments": [
   *     {
   *       "id": "uuid",
   *       "classId": "uuid",
   *       "status": "ACTIVE",
   *       "class": {
   *         "id": "uuid",
   *         "name": "Class A"
   *       }
   *     }
   *   ],
   *   "courseEnrollments": [
   *     {
   *       "id": "uuid",
   *       "courseId": "uuid",
   *       "status": "ACTIVE",
   *       "progressPercentage": 45,
   *       "course": {
   *         "id": "uuid",
   *         "title": "Tax Fundamentals"
   *       }
   *     }
   *   ]
   * }
   * 
   * Errors:
   * - 404: Student not found
   * - 403: Student accessing another student's profile
   */
  @Get(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STUDENT)
  async findOne(@Param('id') id: string, @Request() req: any) {
    if (req.user?.role === UserRole.STAFF) {
      await this.access.assertCanManageProfile(req.user, 'student', id);
    }
    // Students may only read their own profile (R2.5); the service enforces it
    return this.studentsService.findOne(id, req.user?.userId, req.user?.role);
  }

  /**
   * Update student profile
   * 
   * PATCH /students/:id
   * 
   * Requirements:
   * - R1: Validate all required fields
   * - R1: Enforce uniqueness constraints for email and admissionId
   * - Profile updates are merged (not replaced)
   * 
   * Request Body (all fields optional):
   * {
   *   "firstName": "Jane",
   *   "phoneNumber": "9876543210",
   *   "city": "Delhi"
   * }
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "userId": "uuid",
   *   "admissionId": "STU2024001",
   *   "firstName": "Jane",
   *   "lastName": "Doe",
   *   "phoneNumber": "9876543210",
   *   "city": "Delhi",
   *   "user": {
   *     "id": "uuid",
   *     "email": "student@example.com",
   *     "role": "STUDENT",
   *     "status": "ACTIVE"
   *   }
   * }
   * 
   * Errors:
   * - 404: Student not found
   * - 409: Email or admissionId already in use
   */
  @Patch(':id')
  @Roles(UserRole.STAFF)
  async update(
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @Request() req: any,
  ) {
    await this.access.assertCanManageProfile(req.user, 'student', id);
    return this.studentsService.update(id, updateStudentDto);
  }

  /**
   * Get attendance history for a specific student
   * 
   * GET /students/:id/attendance
   * 
   * Requirements:
   * - R10.1: Support filtering by Student ID (via route param)
   * - R10.2: Support filtering by class ID (query param)
   * - R10.3: Support filtering by date range (query params)
   * - R10.4: Support filtering by attendance status (query param)
   * - R10.5: Students can only view their own records
   * - R10.6: Return results ordered by date descending
   * - R10.7: Display Student name, class name, date, status, and remarks
   * - R10.8: Students see records from all enrolled classes
   * 
   * Query Parameters:
   * - classId: string (optional) - Filter by class ID (UUID)
   * - dateFrom: string (optional) - Start date filter (ISO date format)
   * - dateTo: string (optional) - End date filter (ISO date format)
   * - status: AttendanceStatus (optional) - Filter by status (PRESENT, ABSENT, LATE)
   * 
   * Authorization:
   * - Students can only view their own attendance
   * - Administrators can view any student's attendance
   * 
   * Response:
   * [
   *   {
   *     "id": "uuid",
   *     "studentId": "uuid",
   *     "studentName": "John Doe",
   *     "admissionId": "STU2024001",
   *     "classId": "uuid",
   *     "className": "Class A",
   *     "attendanceDate": "2024-01-15T00:00:00.000Z",
   *     "status": "PRESENT",
   *     "remarks": "On time",
   *     "markedBy": "uuid",
   *     "markedAt": "2024-01-15T10:30:00.000Z"
   *   }
   * ]
   * 
   * Errors:
   * - 404: Student not found
   * - 403: Student accessing another student's attendance
   */
  @Get(':id/attendance')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STUDENT)
  async getStudentAttendance(
    @Param('id') studentId: string,
    @Query() query: GetStudentAttendanceQueryDto,
    @Request() req: any,
  ) {
    if (req.user.role === UserRole.STAFF) {
      await this.access.assertAny(req.user, [StaffPermissionType.MANAGE_STUDENTS, StaffPermissionType.VIEW_REPORTS]);
    }
    return this.studentsService.getStudentAttendance(
      studentId,
      query,
      req.user.userId,
      req.user.role,
    );
  }

  /**
   * Get attendance history for all students with filtering
   * 
   * GET /students/attendance/all
   * 
   * Requirements:
   * - R10.1: Support filtering by Student ID (query param)
   * - R10.2: Support filtering by class ID (query param)
   * - R10.3: Support filtering by date range (query params)
   * - R10.4: Support filtering by attendance status (query param)
   * - R10.6: Return results ordered by date descending
   * - R10.7: Display Student name, class name, date, status, and remarks
   * 
   * Query Parameters:
   * - studentId: string (optional) - Filter by student ID (UUID)
   * - classId: string (optional) - Filter by class ID (UUID)
   * - dateFrom: string (optional) - Start date filter (ISO date format)
   * - dateTo: string (optional) - End date filter (ISO date format)
   * - status: AttendanceStatus (optional) - Filter by status (PRESENT, ABSENT, LATE)
   * 
   * Authorization:
   * - Only administrators can access this endpoint
   * 
   * Response:
   * [
   *   {
   *     "id": "uuid",
   *     "studentId": "uuid",
   *     "studentName": "John Doe",
   *     "admissionId": "STU2024001",
   *     "classId": "uuid",
   *     "className": "Class A",
   *     "attendanceDate": "2024-01-15T00:00:00.000Z",
   *     "status": "PRESENT",
   *     "remarks": "On time",
   *     "markedBy": "uuid",
   *     "markedAt": "2024-01-15T10:30:00.000Z"
   *   }
   * ]
   */
  @Get('attendance/all')
  @Roles(UserRole.ADMINISTRATOR)
  async getAllStudentsAttendance(@Query() query: GetStudentAttendanceQueryDto) {
    return this.studentsService.getAllStudentsAttendance(query);
  }
}
