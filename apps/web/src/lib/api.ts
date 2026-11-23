import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  API_BASE_URL,
  clearSession,
  getAccessToken,
  getStoredUser,
  loginRedirectUrl,
  refreshAccessToken,
  setSession,
} from './auth';
import { PASSWORD_CHANGE_REQUIRED_CODE } from './password-policy';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Attach the access token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// On 401: refresh the access token once and retry; otherwise send the user to /login
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthCall = /\/auth\/(login|refresh|logout)/.test(config?.url ?? '');

    if (error.response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return apiClient(config);
      }
      clearSession();
      if (typeof window !== 'undefined') {
        window.location.href = loginRedirectUrl();
      }
    }
    // R36.3: the API refuses everything until a required password change is done
    const data = error.response?.data as { code?: string } | undefined;
    if (error.response?.status === 403 && data?.code === PASSWORD_CHANGE_REQUIRED_CODE && typeof window !== 'undefined') {
      const user = getStoredUser();
      if (user) setSession(getAccessToken() ?? '', { ...user, mustChangePassword: true });
      if (!window.location.pathname.startsWith('/change-password')) {
        // Outside React (axios interceptor), so a full navigation is the only option here
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/change-password?next=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(error);
  },
);

export interface MonthlyStudentAttendanceRow {
  studentId: string;
  studentName: string;
  admissionId: string;
  className: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  unmarkedCount: number;
  percentage: number | null;
}

export interface MonthlyStaffAttendanceRow {
  staffId: string;
  staffName: string;
  staffEmployeeId: string;
  designation: string;
  department: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  percentage: number | null;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  status: string;
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
}

export interface StaffMember {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
  user: {
    id: string;
    email: string;
    status: string;
  };
}

export interface MarkStaffAttendancePayload {
  staffId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface StaffAttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  attendanceDate: string;
  status: AttendanceStatus;
  remarks?: string;
  markedBy: string;
  markedAt: string;
}

export interface StaffAttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  designation: string;
  department: string;
  attendanceDate: string;
  status: AttendanceStatus;
  remarks?: string;
  markedBy: string;
  markedAt: string;
}

export interface MonthlyStudentReport {
  year: number;
  month: number;
  classId?: string;
  generatedAt: string;
  students: MonthlyStudentAttendanceRow[];
}

export const reportsApi = {
  getMonthlyStudentReport: async (params: {
    year: number;
    month: number;
    classId?: string;
  }): Promise<MonthlyStudentReport> => {
    const response = await apiClient.get('/reports/attendance/student/monthly', {
      params,
    });
    return response.data;
  },

  getMonthlyStaffReport: async (params: {
    year: number;
    month: number;
    department?: string;
    category?: string;
  }): Promise<MonthlyStaffAttendanceRow[]> => {
    const response = await apiClient.get('/reports/attendance/staff/monthly', {
      params,
    });
    return response.data;
  },
};

export const classesApi = {
  /** Active classes. The API paginates (`{ data, pagination }`); 100 covers a single institute. */
  getAll: async (): Promise<Class[]> => {
    const response = await apiClient.get<{ data: Class[] }>('/classes', {
      params: { status: 'ACTIVE', limit: 100 },
    });
    return response.data.data;
  },
};

export interface RegisterStudent {
  studentId: string;
  admissionId: string;
  firstName: string;
  lastName: string;
  status?: AttendanceStatus | null;
  remarks?: string | null;
  markedAt?: string | null;
}

/** A class register for one day. `students` is the roster frozen when the register was first opened. */
export interface AttendanceRegister {
  id: string;
  classId: string;
  className: string;
  attendanceDate: string;
  status: 'DRAFT' | 'SAVED';
  students: RegisterStudent[];
  createdAt: string;
  updatedAt: string;
}

export interface RegisterMark {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export const registersApi = {
  /** Open (or fetch) the register for a class and date (YYYY-MM-DD). Requires MARK_ATTENDANCE for staff. */
  open: async (classId: string, attendanceDate: string): Promise<AttendanceRegister> => {
    const response = await apiClient.post('/attendance/student/registers', { classId, attendanceDate });
    return response.data;
  },

  /** Save or correct marks; returns the updated register. */
  mark: async (registerId: string, marks: RegisterMark[]): Promise<AttendanceRegister> => {
    const response = await apiClient.post(`/attendance/student/registers/${registerId}/mark`, { marks });
    return response.data;
  },
};

export const staffApi = {
  async getAllStaff(params?: { page?: number; limit?: number; search?: string }) {
    const response = await apiClient.get<{
      data: StaffMember[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>('/staff', { params });
    return response.data;
  },

  async markAttendance(payload: MarkStaffAttendancePayload) {
    const response = await apiClient.post('/attendance/staff', payload);
    return response.data;
  },

  async getAttendanceByDate(date: string) {
    const response = await apiClient.get('/attendance/staff', {
      params: {
        dateFrom: date,
        dateTo: date,
      },
    });
    return response.data;
  },
};

export interface Course {
  id: string;
  title: string;
  description?: string | null;
  // Prisma returns null when no cover has been uploaded
  coverImage?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface CourseEnrollment {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseCoverImage: string | null;
  enrollmentStatus: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  progressPercentage: number;
  totalLessons: number;
  completedLessons: number;
  lastAccessedAt: string | null;
  enrolledAt: string;
}

export interface LessonProgress {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  displayOrder: number;
  duration: number | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  lastPosition: number;
  watchedDuration: number;
  completedAt: string | null;
}

export interface CourseProgress {
  courseId: string;
  courseTitle: string;
  enrollmentStatus: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  progressPercentage: number;
  lessons: LessonProgress[];
}

export interface StudentProgress {
  studentId: string;
  studentName: string;
  courses: CourseEnrollment[];
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  videoUrl: string;
  duration?: number;
  status: 'DRAFT' | 'PUBLISHED';
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseWithModules extends Course {
  modules: Module[];
}

export interface CreateCoursePayload {
  title: string;
  description?: string;
  coverImage?: string;
}

export interface UpdateCoursePayload {
  title?: string;
  description?: string;
  coverImage?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  displayOrder?: number;
}

export interface CreateModulePayload {
  title: string;
  description?: string;
  displayOrder?: number;
}

export interface UpdateModulePayload {
  title?: string;
  description?: string;
  displayOrder?: number;
}

export interface CreateLessonPayload {
  title: string;
  description?: string;
  videoUrl: string;
  duration?: number;
  displayOrder?: number;
}

export interface UpdateLessonPayload {
  title?: string;
  description?: string;
  videoUrl?: string;
  duration?: number;
  status?: 'DRAFT' | 'PUBLISHED';
  displayOrder?: number;
}

export const coursesApi = {
  async getCourse(courseId: string): Promise<Course> {
    const response = await apiClient.get(`/courses/${courseId}`);
    return response.data;
  },

  async getCourseWithModules(courseId: string): Promise<CourseWithModules> {
    const response = await apiClient.get(`/courses/${courseId}`);
    return response.data;
  },

  /** All courses. The API paginates (`{ data, meta }`); 100 covers a single institute. */
  async getAllCourses(params?: { status?: string }): Promise<Course[]> {
    const response = await apiClient.get<{ data: Course[] } | Course[]>('/courses', {
      params: { limit: 100, ...params },
    });
    return Array.isArray(response.data) ? response.data : response.data.data;
  },

  async createCourse(payload: CreateCoursePayload): Promise<Course> {
    const response = await apiClient.post('/courses', payload);
    return response.data;
  },

  async updateCourse(courseId: string, payload: UpdateCoursePayload): Promise<Course> {
    const response = await apiClient.patch(`/courses/${courseId}`, payload);
    return response.data;
  },

  /**
   * Deletes a course nobody has been enrolled in (with its modules, lessons and quizzes);
   * a course with enrolment history is archived instead. `action` says which happened.
   */
  async deleteCourse(courseId: string): Promise<{ action: 'deleted' | 'archived'; message: string }> {
    const response = await apiClient.delete(`/courses/${courseId}`);
    return response.data;
  },

  async publishCourse(courseId: string): Promise<Course> {
    const response = await apiClient.patch(`/courses/${courseId}`, { status: 'PUBLISHED' });
    return response.data;
  },

  async unpublishCourse(courseId: string): Promise<Course> {
    const response = await apiClient.patch(`/courses/${courseId}`, { status: 'DRAFT' });
    return response.data;
  },

  /** Uploads and saves a course's cover image; returns its stored path ("/uploads/..."). */
  async uploadCoverImage(courseId: string, file: File): Promise<{ coverImage: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/upload/course-cover/${courseId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getCourseProgress(courseId: string): Promise<CourseProgress> {
    const response = await apiClient.get(`/courses/${courseId}/progress`);
    return response.data;
  },

  async getStudentProgress(studentId: string): Promise<StudentProgress> {
    const response = await apiClient.get(`/students/${studentId}/progress`);
    return response.data;
  },

  async getStudentEnrollments(studentId: string): Promise<CourseEnrollment[]> {
    const response = await apiClient.get(`/courses/students/${studentId}/enrollments`);
    return response.data;
  },
};

export const modulesApi = {
  async createModule(courseId: string, payload: CreateModulePayload): Promise<Module> {
    const response = await apiClient.post(`/courses/${courseId}/modules`, payload);
    return response.data;
  },

  async getModule(moduleId: string): Promise<Module> {
    const response = await apiClient.get(`/modules/${moduleId}`);
    return response.data;
  },

  async updateModule(moduleId: string, payload: UpdateModulePayload): Promise<Module> {
    const response = await apiClient.patch(`/modules/${moduleId}`, payload);
    return response.data;
  },

  async deleteModule(moduleId: string): Promise<void> {
    await apiClient.delete(`/modules/${moduleId}`);
  },
};

export const lessonsApi = {
  async createLesson(moduleId: string, payload: CreateLessonPayload): Promise<Lesson> {
    const response = await apiClient.post(`/modules/${moduleId}/lessons`, payload);
    return response.data;
  },

  async getLesson(lessonId: string): Promise<Lesson> {
    const response = await apiClient.get(`/lessons/${lessonId}`);
    return response.data;
  },

  async updateLesson(lessonId: string, payload: UpdateLessonPayload): Promise<Lesson> {
    const response = await apiClient.patch(`/lessons/${lessonId}`, payload);
    return response.data;
  },

  async deleteLesson(lessonId: string): Promise<void> {
    await apiClient.delete(`/lessons/${lessonId}`);
  },

  async publishLesson(lessonId: string): Promise<Lesson> {
    const response = await apiClient.patch(`/lessons/${lessonId}`, { status: 'PUBLISHED' });
    return response.data;
  },

  async unpublishLesson(lessonId: string): Promise<Lesson> {
    const response = await apiClient.patch(`/lessons/${lessonId}`, { status: 'DRAFT' });
    return response.data;
  },
};

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  attachmentType: 'COURSE' | 'MODULE' | 'LESSON';
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  /** The course the quiz belongs to, directly or through its module or lesson (from the API) */
  owningCourseId?: string | null;
  passMark: number;
  totalMarks: number;
  timeLimit?: number;
  maxAttempts?: number;
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
}

export interface QuizAttemptSummary {
  id: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalMarks: number;
  passed: boolean;
  submittedAt: string;
}

export interface AvailableQuiz {
  id: string;
  title: string;
  description?: string;
  courseTitle: string;
  totalMarks: number;
  passMark: number;
  timeLimit?: number;
  maxAttempts?: number;
  attemptCount: number;
  bestScore?: number;
  bestAttemptPassed: boolean;
  lastAttemptDate?: string;
}

export interface QuizSubmissionPayload {
  answers: Array<{
    questionId: string;
    selectedAnswer: string;
  }>;
}

export interface QuizSubmissionResponse {
  attemptId: string;
  score: number;
  totalMarks: number;
  passMark: number;
  passed: boolean;
  correctAnswers: Array<{
    questionId: string;
    correctAnswer: string;
  }>;
  submittedAt: string;
}

export interface QuestionResult {
  id: string;
  questionText: string;
  options: Array<{ id: string; text: string }>;
  correctAnswer: string;
  marks: number;
  displayOrder: number;
  selectedAnswer: string | null;
  isCorrect: boolean;
  marksAwarded: number;
}

export interface AttemptDetail {
  id: string;
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  admissionId: string;
  score: number;
  totalMarks: number;
  passMark: number;
  passed: boolean;
  startedAt: string;
  submittedAt: string;
  questions: QuestionResult[];
}

export const quizzesApi = {
  /** Published quizzes from the signed-in student's courses (the API works out which). */
  async getAvailableQuizzes(_studentId?: string): Promise<Quiz[]> {
    // Get all published quizzes
    const response = await apiClient.get('/quizzes', {
      params: { status: 'PUBLISHED' }
    });
    return response.data;
  },

  async getQuizAttempts(quizId: string): Promise<QuizAttemptSummary[]> {
    const response = await apiClient.get(`/quizzes/${quizId}/attempts`);
    return response.data;
  },

  async getAllStudentAttempts(studentId: string): Promise<QuizAttemptSummary[]> {
    // This would need a backend endpoint to aggregate all attempts for a student
    // For now, we'll need to fetch quizzes and their attempts separately
    const quizzes = await this.getAvailableQuizzes(studentId);
    const allAttempts: QuizAttemptSummary[] = [];
    
    for (const quiz of quizzes) {
      try {
        const attempts = await this.getQuizAttempts(quiz.id);
        allAttempts.push(...attempts);
      } catch (error) {
        console.error(`Failed to fetch attempts for quiz ${quiz.id}:`, error);
      }
    }
    
    return allAttempts;
  },

  async submitQuiz(quizId: string, payload: QuizSubmissionPayload): Promise<QuizSubmissionResponse> {
    const response = await apiClient.post(`/quizzes/${quizId}/submit`, payload);
    return response.data;
  },

  async getQuiz(quizId: string): Promise<Quiz> {
    const response = await apiClient.get(`/quizzes/${quizId}`);
    return response.data;
  },

  async getAttemptDetail(attemptId: string): Promise<AttemptDetail> {
    const response = await apiClient.get(`/quizzes/attempts/${attemptId}`);
    return response.data;
  },
};

// Lab Types and Interfaces
export type LabType = 'GST_REGISTRATION' | 'INCOME_TAX_RETURN' | 'MCA_INCORPORATION';

export interface Lab {
  id: string;
  type: LabType;
  title: string;
  description?: string;
  sampleData: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GstFormData {
  businessName: string;
  businessType: string;
  pan: string;
  address: string;
  signatory: string;
}

export interface GstResult {
  gstin: string;
  arn: string;
  applicationDate: string;
  status: string;
}

export interface LabAttempt {
  id: string;
  labId: string;
  studentId: string;
  formData: Record<string, any>;
  result: Record<string, any>;
  completedAt: string;
}

export interface GstLabAttemptResponse {
  id: string;
  labId: string;
  studentId: string;
  formData: GstFormData;
  result: GstResult;
  completedAt: string;
}

export interface ItrFormData {
  taxpayerName: string;
  pan: string;
  incomeSource: string;
  grossIncome: number;
  deductions: number;
}

export interface ItrResult {
  acknowledgementNumber: string;
  taxpayerName: string;
  pan: string;
  taxableIncome: number;
  taxAmount: number;
  filingDate: string;
  status: string;
  calculation?: {
    grossIncome: number;
    deductions: number;
    taxableIncome: number;
    taxAmount: number;
    taxBrackets: Array<{ from: number; to: number | null; rate: number; taxOnBracket: number }>;
  };
}

export interface McaDirector {
  name: string;
  din: string;
  email: string;
  address?: string;
}

export interface McaFormData {
  companyName: string;
  directors: McaDirector[];
  registeredAddress: string;
  authorizedCapital: number;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface McaResult {
  cin: string;
  certificateDate: string;
  companyName: string;
  registrationNumber: string;
  submittedAt: string;
}

export interface LabAttemptResponse<TForm, TResult> {
  id: string;
  labId: string;
  studentId: string;
  formData: TForm;
  result: TResult;
  completedAt: string;
}

export const labsApi = {
  async getAllLabs(): Promise<Lab[]> {
    const response = await apiClient.get('/labs');
    return response.data;
  },

  async getLabByType(type: LabType): Promise<Lab> {
    const response = await apiClient.get(`/labs/${type}`);
    return response.data;
  },

  async submitGstLab(formData: GstFormData): Promise<GstLabAttemptResponse> {
    const response = await apiClient.post('/labs/GST_REGISTRATION/submit', formData);
    return response.data;
  },

  async submitItrLab(formData: ItrFormData): Promise<LabAttemptResponse<ItrFormData, ItrResult>> {
    const response = await apiClient.post('/labs/INCOME_TAX_RETURN/submit', formData);
    return response.data;
  },

  async submitMcaLab(formData: McaFormData): Promise<LabAttemptResponse<McaFormData, McaResult>> {
    const response = await apiClient.post('/labs/MCA_INCORPORATION/submit', formData);
    return response.data;
  },

  /** Administrator: replace a lab's sample data */
  async updateSampleData(type: LabType, sampleData: Record<string, any>): Promise<Lab> {
    const response = await apiClient.patch(`/labs/${type}/sample-data`, { sampleData });
    return response.data;
  },

  /** Administrator: activate or deactivate a lab */
  async updateLabStatus(type: LabType, isActive: boolean): Promise<Lab> {
    const response = await apiClient.patch(`/labs/${type}/status`, { isActive });
    return response.data;
  },

  async getLabAttempts(type: LabType): Promise<LabAttempt[]> {
    const response = await apiClient.get(`/labs/${type}/attempts`);
    return response.data;
  },

  async getLabAttemptById(attemptId: string): Promise<LabAttempt> {
    const response = await apiClient.get(`/labs/attempts/${attemptId}`);
    return response.data;
  },
};
