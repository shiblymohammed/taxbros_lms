import { apiClient, type Quiz } from './api';
import type { UserRole } from './auth';

/** Administrator API calls: users, permissions, classes, course enrolments, quiz authoring. */

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';
export type StaffCategory = 'TEACHING' | 'NON_TEACHING';
export type { StaffPermission } from './staff-access';
import type { StaffPermission } from './staff-access';

/** Every staff permission and what it opens (R3.2). Administrators always have all of them. */
export const ENFORCED_PERMISSIONS: Array<{ value: StaffPermission; label: string; description: string }> = [
  { value: 'MARK_ATTENDANCE', label: 'Mark attendance', description: 'Open and mark class registers' },
  { value: 'VIEW_REPORTS', label: 'View reports', description: 'Monthly student and staff attendance reports' },
  { value: 'MANAGE_STUDENTS', label: 'Manage students', description: 'Create and edit student accounts, reset their passwords, view student profiles' },
  { value: 'MANAGE_STAFF', label: 'Manage staff', description: 'Create and edit staff accounts with no more permissions than their own' },
  { value: 'MANAGE_CLASSES', label: 'Manage classes', description: 'Create, rename and archive classes; add and remove students' },
  { value: 'MANAGE_COURSES', label: 'Manage courses', description: 'Courses, modules, lessons, quizzes and course enrolments' },
  { value: 'MANAGE_LABS', label: 'Manage labs', description: 'Lab sample data and turning labs on or off' },
];

export interface StudentProfile {
  id: string;
  admissionId: string;
  firstName: string;
  lastName: string;
  admissionDate: string;
  phoneNumber?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface StaffProfile {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
  category: StaffCategory;
  joiningDate: string;
  phoneNumber?: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  studentProfile?: StudentProfile | null;
  staffProfile?: StaffProfile | null;
}

export interface Paged<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface UserFilters {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  page?: number;
  limit?: number;
  // Student filters (R1.11)
  admissionId?: string;
  classId?: string;
  admissionDateFrom?: string;
  admissionDateTo?: string;
  // Staff filters (R1.12)
  staffId?: string;
  department?: string;
  category?: StaffCategory;
  designation?: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: UserRole;
  studentProfile?: { admissionId: string; firstName: string; lastName: string; admissionDate: string; phoneNumber?: string };
  staffProfile?: {
    staffId: string;
    firstName: string;
    lastName: string;
    designation: string;
    department: string;
    category: StaffCategory;
    joiningDate: string;
    phoneNumber?: string;
  };
}

export function displayName(user: AdminUser): string {
  const p = user.studentProfile ?? user.staffProfile;
  return p ? `${p.firstName} ${p.lastName}` : user.email;
}

export const usersApi = {
  list: async (filters: UserFilters = {}): Promise<Paged<AdminUser>> => {
    const { data } = await apiClient.get('/users', { params: cleanFilters(filters) });
    return data;
  },
  create: async (payload: CreateUserPayload): Promise<AdminUser> => (await apiClient.post('/users', payload)).data,
  update: async (id: string, payload: Record<string, unknown>): Promise<AdminUser> =>
    (await apiClient.patch(`/users/${id}`, payload)).data,
  activate: async (id: string): Promise<AdminUser> => (await apiClient.patch(`/users/${id}/activate`)).data,
  deactivate: async (id: string): Promise<AdminUser> => (await apiClient.patch(`/users/${id}/deactivate`)).data,
  resetPassword: async (id: string): Promise<{ temporaryPassword: string; email: string }> =>
    (await apiClient.post(`/users/${id}/reset-password`)).data,
};

export interface GrantedPermission {
  id: string;
  permission: StaffPermission;
  grantedAt: string;
}

export const staffPermissionsApi = {
  list: async (staffId: string): Promise<GrantedPermission[]> =>
    (await apiClient.get(`/staff/${staffId}/permissions`)).data,
  grant: async (staffId: string, permission: StaffPermission): Promise<GrantedPermission> =>
    (await apiClient.post(`/staff/${staffId}/permissions`, { permission })).data,
  revoke: async (staffId: string, permissionId: string): Promise<void> => {
    await apiClient.delete(`/staff/${staffId}/permissions/${permissionId}`);
  },
};

export interface ClassSummary {
  id: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  _count?: { enrollments: number };
}

export interface ClassDetail extends ClassSummary {
  enrollments: Array<{
    id: string;
    enrolledAt: string;
    student: StudentProfile & { user: { email: string; status: UserStatus } };
  }>;
}

export const classesAdminApi = {
  list: async (status?: 'ACTIVE' | 'ARCHIVED'): Promise<ClassSummary[]> =>
    (await apiClient.get('/classes', { params: { limit: 100, ...(status ? { status } : {}) } })).data.data,
  get: async (id: string): Promise<ClassDetail> => (await apiClient.get(`/classes/${id}`)).data,
  create: async (payload: { name: string; description?: string }): Promise<ClassSummary> =>
    (await apiClient.post('/classes', payload)).data,
  update: async (id: string, payload: { name?: string; description?: string; status?: 'ACTIVE' | 'ARCHIVED' }) =>
    (await apiClient.patch(`/classes/${id}`, payload)).data,
  enroll: async (classId: string, studentId: string) =>
    (await apiClient.post(`/classes/${classId}/students`, { studentId })).data,
  remove: async (classId: string, studentId: string) => {
    await apiClient.delete(`/classes/${classId}/students/${studentId}`);
  },
};

export interface CourseEnrollmentRow {
  id: string;
  studentId: string;
  courseId: string;
  status: 'ACTIVE' | 'DROPPED' | 'COMPLETED';
  progressPercentage: number;
  enrolledAt: string;
  student: StudentProfile & { user?: { email: string } };
}

export const courseEnrollmentsApi = {
  list: async (courseId: string): Promise<CourseEnrollmentRow[]> =>
    (await apiClient.get(`/courses/${courseId}/enrollments`, { params: { limit: 100 } })).data.data,
  enroll: async (courseId: string, studentId: string) =>
    (await apiClient.post(`/courses/${courseId}/enroll`, { studentId })).data,
  remove: async (enrollmentId: string) => {
    await apiClient.delete(`/courses/enrollments/${enrollmentId}`);
  },
};

export interface QuizOption {
  id: string;
  text: string;
}

export interface AdminQuizQuestion {
  id: string;
  questionText: string;
  options: QuizOption[];
  correctAnswer: string;
  marks: number;
  displayOrder: number;
}

export interface AdminQuiz extends Quiz {
  questions: AdminQuizQuestion[];
}

export interface QuizPayload {
  title: string;
  description?: string;
  attachmentType: 'COURSE' | 'MODULE' | 'LESSON';
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  passMark: number;
  totalMarks: number;
  timeLimit?: number;
  maxAttempts?: number;
}

export interface QuestionPayload {
  questionText: string;
  options: QuizOption[];
  correctAnswer: string;
  marks: number;
  displayOrder?: number;
}

export const quizAdminApi = {
  list: async (): Promise<AdminQuiz[]> => (await apiClient.get('/quizzes')).data,
  get: async (id: string): Promise<AdminQuiz> => (await apiClient.get(`/quizzes/${id}`)).data,
  create: async (payload: QuizPayload): Promise<AdminQuiz> => (await apiClient.post('/quizzes', payload)).data,
  update: async (id: string, payload: Partial<QuizPayload> & { status?: 'DRAFT' | 'PUBLISHED' }) =>
    (await apiClient.patch(`/quizzes/${id}`, payload)).data,
  publish: async (id: string): Promise<AdminQuiz> => (await apiClient.patch(`/quizzes/${id}/publish`)).data,
  remove: async (id: string) => {
    await apiClient.delete(`/quizzes/${id}`);
  },
  addQuestion: async (quizId: string, payload: QuestionPayload) =>
    (await apiClient.post(`/quizzes/${quizId}/questions`, payload)).data,
  updateQuestion: async (questionId: string, payload: Partial<QuestionPayload>) =>
    (await apiClient.patch(`/quizzes/questions/${questionId}`, payload)).data,
  removeQuestion: async (questionId: string) => {
    await apiClient.delete(`/quizzes/questions/${questionId}`);
  },
};

/** Sum of question marks and whether it matches the quiz total (R24.8; publishing requires a match). */
export function marksSummary(quiz: { totalMarks: number; questions: Array<{ marks: number }> }) {
  const sum = quiz.questions.reduce((s, q) => s + q.marks, 0);
  return { sum, matches: quiz.questions.length > 0 && sum === quiz.totalMarks };
}

/** Temporary password for new accounts: meets the policy; the user must change it at first sign-in. */
export function generateTemporaryPassword(length = 12): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '#$%@!*?'];
  const all = sets.join('');
  const random = (n: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  };
  const chars = sets.map((s) => s[random(s.length)]);
  while (chars.length < length) chars.push(all[random(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ---------- Student profile (R5.4, R26.5) ----------

export interface StudentProfileDetail extends StudentProfile {
  userId: string;
  user: { id: string; email: string; status: UserStatus; lastLoginAt?: string | null };
  courseEnrollments: Array<{
    id: string;
    status: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
    progressPercentage: number;
    enrolledAt: string;
    lastAccessedAt?: string | null;
    course: { id: string; title: string; status: string };
  }>;
  classEnrollments: Array<{
    id: string;
    status: 'ACTIVE' | 'INACTIVE';
    enrolledAt: string;
    class: { id: string; name: string; status: string };
  }>;
  quizAttempts: Array<{
    id: string;
    score: number;
    passed: boolean;
    submittedAt: string;
    quiz: { id: string; title: string; totalMarks: number; passMark: number };
  }>;
}

export const studentProfileApi = {
  get: async (studentId: string): Promise<StudentProfileDetail> => (await apiClient.get(`/students/${studentId}`)).data,
};

// ---------- Institute settings (R6) ----------

export type SettingKey =
  | 'timezone'
  | 'instituteName'
  // Self attendance
  | 'attendanceNetworks'
  | 'attendanceLocation'
  | 'attendanceRadiusMeters'
  | 'staffCheckInWindow'
  | 'staffLateAfter'
  | 'studentLateAfterMinutes'
  | 'studentNetworkCheck';

/** Settings shown under "Self attendance" on the settings page */
export const ATTENDANCE_SETTING_KEYS: SettingKey[] = [
  'attendanceNetworks',
  'attendanceLocation',
  'attendanceRadiusMeters',
  'staffCheckInWindow',
  'staffLateAfter',
  'studentLateAfterMinutes',
  'studentNetworkCheck',
];

export interface InstituteSetting {
  key: SettingKey;
  label: string;
  description: string;
  value: string;
  isDefault: boolean;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export const settingsApi = {
  list: async (): Promise<InstituteSetting[]> => (await apiClient.get('/settings')).data,
  update: async (key: SettingKey, value: string): Promise<InstituteSetting> =>
    (await apiClient.patch(`/settings/${key}`, { value })).data,
};

/** Every IANA timezone the browser knows, with the institute default first. */
export function timezoneOptions(current?: string): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const all = intl.supportedValuesOf?.('timeZone') ?? ['Asia/Kolkata', 'UTC'];
  const set = new Set(['Asia/Kolkata', ...(current ? [current] : []), ...all]);
  return [...set];
}

/** Drops empty and whitespace-only filter values so they aren't sent to the API. */
export function cleanFilters<T extends object>(filters: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== ''),
  ) as Partial<T>;
}

// ---------- Student list (pickers) ----------

export interface StudentListItem extends StudentProfile {
  user: { id: string; email: string; status: UserStatus };
}

export const studentsListApi = {
  list: async (filters: { search?: string; activeOnly?: boolean; classId?: string; page?: number; limit?: number }): Promise<Paged<StudentListItem>> =>
    (await apiClient.get('/students', { params: cleanFilters(filters) })).data,
};
