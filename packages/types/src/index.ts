// Shared TypeScript types for TAXBROS LMS

// User Roles
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMINISTRATOR = 'ADMINISTRATOR',
  STAFF = 'STAFF',
  STUDENT = 'STUDENT',
}

// User Status
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

// Attendance Status
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
}

// Course Status
export enum CourseStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

// Lesson Progress Status
export enum LessonProgressStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

// Staff Permissions
export enum StaffPermission {
  MARK_ATTENDANCE = 'MARK_ATTENDANCE',
  VIEW_REPORTS = 'VIEW_REPORTS',
  MANAGE_COURSES = 'MANAGE_COURSES',
  MANAGE_STUDENTS = 'MANAGE_STUDENTS',
  MANAGE_STAFF = 'MANAGE_STAFF',
  MANAGE_CLASSES = 'MANAGE_CLASSES',
}

// Lab Types
export enum LabType {
  GST_REGISTRATION = 'GST_REGISTRATION',
  INCOME_TAX_RETURN = 'INCOME_TAX_RETURN',
  MCA_INCORPORATION = 'MCA_INCORPORATION',
}

// Base User interface
export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
