import { Test, TestingModule } from '@nestjs/testing';
import { QuizzesService } from './quizzes.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  UserRole,
  QuizStatus,
  QuizAttachmentType,
  CourseEnrollmentStatus,
} from '@prisma/client';
import { plausibleStart } from './quizzes.service';

describe('QuizzesService', () => {
  let service: QuizzesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    quiz: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    quizQuestion: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    quizAttempt: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    courseEnrollment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    course: {
      findUnique: jest.fn(),
    },
    courseModule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    lesson: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizzesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QuizzesService>(QuizzesService);
    prismaService = module.get<PrismaService>(PrismaService);

    // These tests cover enrolment and answer masking; the learning order (quiz gate) has its own tests
    // in progress/course-access.spec.ts, so here every quiz is open and nothing has been passed yet
    (service as any).access = {
      forCourse: jest.fn(async () => ({ access: { lessons: new Map(), quizzes: { get: () => ({ open: true }) } }, quizzes: [] })),
      assertQuizOpen: jest.fn(async () => undefined),
      hasPassed: jest.fn(async () => false),
      studyTarget: jest.fn(async () => ({ courseId: null, lessonId: null })),
    };

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a quiz successfully', async () => {
      const createDto = {
        title: 'Test Quiz',
        description: 'Test Description',
        attachmentType: QuizAttachmentType.COURSE,
        courseId: 'course-123',
        passMark: 70,
        totalMarks: 100,
        timeLimit: 60,
      };
      const createdBy = 'admin-123';

      mockPrismaService.course.findUnique.mockResolvedValue({ id: 'course-123' });
      mockPrismaService.quiz.create.mockResolvedValue({
        id: 'quiz-123',
        ...createDto,
        status: QuizStatus.DRAFT,
        createdBy,
      });

      const result = await service.create(createDto as any, createdBy);

      expect(result.status).toBe(QuizStatus.DRAFT);
      expect(result.title).toBe(createDto.title);
    });

    it('should throw BadRequestException if passMark exceeds totalMarks', async () => {
      const createDto = {
        title: 'Test Quiz',
        attachmentType: QuizAttachmentType.COURSE,
        courseId: 'course-123',
        passMark: 110,
        totalMarks: 100,
      };

      mockPrismaService.course.findUnique.mockResolvedValue({ id: 'course-123' });

      await expect(service.create(createDto as any, 'admin-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if course does not exist', async () => {
      const createDto = {
        title: 'Test Quiz',
        attachmentType: QuizAttachmentType.COURSE,
        courseId: 'invalid-course',
        passMark: 70,
        totalMarks: 100,
      };

      mockPrismaService.course.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto as any, 'admin-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll answer masking (R23.10, R25.2)', () => {
    const quizzes = [
      {
        id: 'q1',
        status: QuizStatus.PUBLISHED,
        courseId: 'c1',
        moduleId: null,
        lessonId: null,
        questions: [{ id: 'qq1', questionText: 'Q', options: [], correctAnswer: 'opt-2', marks: 1 }],
      },
    ];

    it('forces PUBLISHED and strips correct answers for students', async () => {
      mockPrismaService.quiz.findMany.mockResolvedValue(quizzes);
      mockPrismaService.courseEnrollment.findMany.mockResolvedValue([{ courseId: 'c1' }]);
      const result: any[] = await service.findAll({ status: QuizStatus.DRAFT }, 'STUDENT' as any, 'student-1');

      expect(mockPrismaService.quiz.findMany.mock.calls.at(-1)[0].where.status).toBe(QuizStatus.PUBLISHED);
      expect(result[0].questions[0]).not.toHaveProperty('correctAnswer');
      expect(result[0].questions[0].questionText).toBe('Q');
    });

    it('keeps answers and the requested status for administrators', async () => {
      mockPrismaService.quiz.findMany.mockResolvedValue(quizzes);
      const result: any[] = await service.findAll({ status: QuizStatus.DRAFT }, 'ADMINISTRATOR' as any);

      expect(mockPrismaService.quiz.findMany.mock.calls.at(-1)[0].where.status).toBe(QuizStatus.DRAFT);
      expect(result[0].questions[0].correctAnswer).toBe('opt-2');
    });
  });

  describe('findAll for students: enrolled courses only, any attachment (R2.11, R23)', () => {
    const quiz = (id: string, ids: { courseId?: string; moduleId?: string; lessonId?: string }) => ({
      id,
      status: QuizStatus.PUBLISHED,
      courseId: ids.courseId ?? null,
      moduleId: ids.moduleId ?? null,
      lessonId: ids.lessonId ?? null,
      questions: [],
    });

    beforeEach(() => {
      mockPrismaService.quiz.findMany.mockResolvedValue([
        quiz('course-quiz', { courseId: 'c1' }),
        quiz('module-quiz', { moduleId: 'm1' }),
        quiz('lesson-quiz', { lessonId: 'l1' }),
        quiz('other-course-quiz', { courseId: 'c2' }),
      ]);
      mockPrismaService.courseModule.findMany.mockResolvedValue([{ id: 'm1', courseId: 'c1' }]);
      mockPrismaService.lesson.findMany.mockResolvedValue([{ id: 'l1', module: { courseId: 'c1' } }]);
    });

    it('returns course, module and lesson quizzes of enrolled courses, with their course', async () => {
      mockPrismaService.courseEnrollment.findMany.mockResolvedValue([{ courseId: 'c1' }]);
      const result: any[] = await service.findAll({}, 'STUDENT' as any, 'student-1');

      expect(result.map((q) => q.id)).toEqual(['course-quiz', 'module-quiz', 'lesson-quiz']);
      expect(result.every((q) => q.owningCourseId === 'c1')).toBe(true);
      expect(mockPrismaService.courseEnrollment.findMany).toHaveBeenCalledWith({
        where: { studentId: 'student-1', status: 'ACTIVE' },
        select: { courseId: true },
      });
    });

    it('returns nothing to a student without a profile', async () => {
      await expect(service.findAll({}, 'STUDENT' as any)).resolves.toEqual([]);
    });

    it('gives staff and admins every quiz with its course', async () => {
      const result: any[] = await service.findAll({}, 'ADMINISTRATOR' as any);
      expect(result.map((q) => q.owningCourseId)).toEqual(['c1', 'c1', 'c1', 'c2']);
    });
  });

  describe('publish', () => {
    it('should publish a quiz successfully', async () => {
      const quizId = 'quiz-123';
      const draftQuiz = {
        id: quizId,
        title: 'Test Quiz',
        status: QuizStatus.DRAFT,
        totalMarks: 3,
        questions: [{ marks: 1 }, { marks: 2 }],
      };
      const publishedQuiz = {
        ...draftQuiz,
        status: QuizStatus.PUBLISHED,
        questions: [],
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(draftQuiz);
      mockPrismaService.quiz.update.mockResolvedValue(publishedQuiz);

      const result = await service.publish(quizId);

      expect(prismaService.quiz.update).toHaveBeenCalledWith({
        where: { id: quizId },
        data: { status: QuizStatus.PUBLISHED },
        include: {
          questions: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      expect(result.status).toBe(QuizStatus.PUBLISHED);
    });

    it('refuses to publish a quiz without questions (R24.8)', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue({ id: 'q', totalMarks: 5, questions: [] });
      await expect(service.publish('q')).rejects.toThrow(/at least one question/);
    });

    it('refuses to publish when question marks do not add up to the total (R24.8)', async () => {
      mockPrismaService.quiz.update.mockClear();
      mockPrismaService.quiz.findUnique.mockResolvedValue({ id: 'q', totalMarks: 5, questions: [{ marks: 1 }, { marks: 2 }] });
      await expect(service.publish('q')).rejects.toThrow(/add up to 3, but the quiz total is 5/);
      expect(mockPrismaService.quiz.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if quiz does not exist', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(null);

      await expect(service.publish('invalid-quiz')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addQuestion', () => {
    it('should add a question to a quiz', async () => {
      const quizId = 'quiz-123';
      const createQuestionDto = {
        questionText: 'What is 2+2?',
        options: [
          { id: 'opt1', text: '3' },
          { id: 'opt2', text: '4' },
        ],
        correctAnswer: 'opt2',
        marks: 10,
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue({ id: quizId });
      mockPrismaService.quizQuestion.create.mockResolvedValue({
        id: 'question-123',
        ...createQuestionDto,
        quizId,
      });

      const result = await service.addQuestion(quizId, createQuestionDto as any);

      expect(result.questionText).toBe(createQuestionDto.questionText);
      expect(result.quizId).toBe(quizId);
    });

    it('should throw NotFoundException if quiz does not exist', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(null);

      await expect(
        service.addQuestion('invalid-quiz', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if correctAnswer does not match option ID', async () => {
      const quizId = 'quiz-123';
      const createQuestionDto = {
        questionText: 'What is 2+2?',
        options: [
          { id: 'opt1', text: '3' },
          { id: 'opt2', text: '4' },
        ],
        correctAnswer: 'opt3', // Invalid - doesn't exist in options
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue({ id: quizId });

      await expect(
        service.addQuestion(quizId, createQuestionDto as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateQuestion', () => {
    it('should update a question successfully', async () => {
      const questionId = 'question-123';
      const updateDto = {
        questionText: 'Updated question text',
        marks: 15,
      };
      const existingQuestion = {
        id: questionId,
        questionText: 'Original text',
        options: [
          { id: 'opt1', text: '3' },
          { id: 'opt2', text: '4' },
        ],
        correctAnswer: 'opt2',
        marks: 10,
      };

      mockPrismaService.quizQuestion.findUnique.mockResolvedValue(existingQuestion);
      mockPrismaService.quizQuestion.update.mockResolvedValue({
        ...existingQuestion,
        ...updateDto,
      });

      const result = await service.updateQuestion(questionId, updateDto as any);

      expect(result.questionText).toBe(updateDto.questionText);
      expect(result.marks).toBe(updateDto.marks);
    });

    it('should throw NotFoundException if question does not exist', async () => {
      mockPrismaService.quizQuestion.findUnique.mockResolvedValue(null);

      await expect(
        service.updateQuestion('invalid-question', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate correctAnswer when updating options', async () => {
      const questionId = 'question-123';
      const updateDto = {
        options: [
          { id: 'opt1', text: '3' },
          { id: 'opt2', text: '4' },
        ],
        correctAnswer: 'opt3', // Invalid
      };
      const existingQuestion = {
        id: questionId,
        correctAnswer: 'opt2',
        options: [
          { id: 'opt1', text: '3' },
          { id: 'opt2', text: '4' },
        ],
      };

      mockPrismaService.quizQuestion.findUnique.mockResolvedValue(existingQuestion);

      await expect(
        service.updateQuestion(questionId, updateDto as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeQuestion', () => {
    it('should delete a question successfully', async () => {
      const questionId = 'question-123';
      mockPrismaService.quizQuestion.findUnique.mockResolvedValue({
        id: questionId,
      });
      mockPrismaService.quizQuestion.delete.mockResolvedValue({});

      const result = await service.removeQuestion(questionId);

      expect(result.message).toBe('Question deleted successfully');
    });

    it('should throw NotFoundException if question does not exist', async () => {
      mockPrismaService.quizQuestion.findUnique.mockResolvedValue(null);

      await expect(service.removeQuestion('invalid-question')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne with Answer Masking', () => {
    const quizId = 'quiz-123';
    const studentUserId = 'student-456';
    const adminUserId = 'admin-789';
    const courseId = 'course-123';

    const mockQuiz = {
      id: quizId,
      title: 'Introduction Quiz',
      description: 'Test your knowledge',
      attachmentType: QuizAttachmentType.COURSE,
      courseId,
      moduleId: null,
      lessonId: null,
      passMark: 70,
      totalMarks: 100,
      timeLimit: 3600,
      maxAttempts: 3,
      displayOrder: 1,
      status: QuizStatus.PUBLISHED,
      createdBy: adminUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      questions: [
        {
          id: 'q1',
          quizId,
          questionText: 'What is 2+2?',
          options: [
            { id: 'opt1', text: '3' },
            { id: 'opt2', text: '4' },
            { id: 'opt3', text: '5' },
          ],
          correctAnswer: 'opt2',
          marks: 10,
          displayOrder: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'q2',
          quizId,
          questionText: 'What is the capital of France?',
          options: [
            { id: 'opt1', text: 'London' },
            { id: 'opt2', text: 'Paris' },
            { id: 'opt3', text: 'Berlin' },
          ],
          correctAnswer: 'opt2',
          marks: 10,
          displayOrder: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      attempts: [
        {
          id: 'attempt-1',
          score: 80,
          passed: true,
          startedAt: new Date(),
          submittedAt: new Date(),
        },
      ],
    };

    it('should throw NotFoundException if quiz does not exist', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(quizId, studentUserId, UserRole.STUDENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mask correctAnswer field for STUDENT role', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId: studentUserId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });

      const result = await service.findOne(
        quizId,
        studentUserId,
        UserRole.STUDENT,
      );

      expect(result.questions[0]).not.toHaveProperty('correctAnswer');
      expect(result.questions[1]).not.toHaveProperty('correctAnswer');
      expect(result.questions[0]).toHaveProperty('options');
      expect(result.questions[1]).toHaveProperty('options');
    });

    it('should include correctAnswer field for ADMINISTRATOR role', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);

      const result = await service.findOne(
        quizId,
        adminUserId,
        UserRole.ADMINISTRATOR,
      );

      expect((result.questions[0] as any).correctAnswer).toBe('opt2');
      expect((result.questions[1] as any).correctAnswer).toBe('opt2');
    });

    it('should include correctAnswer field for STAFF role', async () => {
      const staffUserId = 'staff-999';
      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);

      const result = await service.findOne(
        quizId,
        staffUserId,
        UserRole.STAFF,
      );

      expect((result.questions[0] as any).correctAnswer).toBe('opt2');
      expect((result.questions[1] as any).correctAnswer).toBe('opt2');
    });

    it('should throw ForbiddenException if student tries to access DRAFT quiz', async () => {
      const draftQuiz = { ...mockQuiz, status: QuizStatus.DRAFT };
      mockPrismaService.quiz.findUnique.mockResolvedValue(draftQuiz);

      await expect(
        service.findOne(quizId, studentUserId, UserRole.STUDENT),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.findOne(quizId, studentUserId, UserRole.STUDENT),
      ).rejects.toThrow('Quiz is not available');
    });

    it('should throw ForbiddenException if student is not enrolled in course', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(quizId, studentUserId, UserRole.STUDENT),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.findOne(quizId, studentUserId, UserRole.STUDENT),
      ).rejects.toThrow('You must be enrolled in the course to access this quiz');
    });

    it('should validate enrollment for course-attached quiz', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId: studentUserId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });

      await service.findOne(quizId, studentUserId, UserRole.STUDENT);

      expect(prismaService.courseEnrollment.findFirst).toHaveBeenCalledWith({
        where: {
          studentId: studentUserId,
          courseId,
          status: CourseEnrollmentStatus.ACTIVE,
        },
      });
    });

    it('should validate enrollment for module-attached quiz', async () => {
      const moduleId = 'module-123';
      const moduleQuiz = {
        ...mockQuiz,
        attachmentType: QuizAttachmentType.MODULE,
        courseId: null,
        moduleId,
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(moduleQuiz);
      mockPrismaService.courseModule.findUnique.mockResolvedValue({
        id: moduleId,
        courseId,
      });
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId: studentUserId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });

      await service.findOne(quizId, studentUserId, UserRole.STUDENT);

      expect(prismaService.courseModule.findUnique).toHaveBeenCalledWith({
        where: { id: moduleId },
        select: { courseId: true },
      });
      expect(prismaService.courseEnrollment.findFirst).toHaveBeenCalledWith({
        where: {
          studentId: studentUserId,
          courseId,
          status: CourseEnrollmentStatus.ACTIVE,
        },
      });
    });

    it('should validate enrollment for lesson-attached quiz', async () => {
      const lessonId = 'lesson-123';
      const _moduleId = 'module-123';
      const lessonQuiz = {
        ...mockQuiz,
        attachmentType: QuizAttachmentType.LESSON,
        courseId: null,
        moduleId: null,
        lessonId,
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(lessonQuiz);
      mockPrismaService.lesson.findUnique.mockResolvedValue({
        id: lessonId,
        module: { courseId },
      });
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId: studentUserId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });

      await service.findOne(quizId, studentUserId, UserRole.STUDENT);

      expect(prismaService.lesson.findUnique).toHaveBeenCalledWith({
        where: { id: lessonId },
        include: { module: { select: { courseId: true } } },
      });
      expect(prismaService.courseEnrollment.findFirst).toHaveBeenCalledWith({
        where: {
          studentId: studentUserId,
          courseId,
          status: CourseEnrollmentStatus.ACTIVE,
        },
      });
    });

    it('should calculate remaining attempts correctly', async () => {
      const quizWith2Attempts = {
        ...mockQuiz,
        maxAttempts: 3,
        attempts: [
          {
            id: 'attempt-1',
            score: 80,
            passed: true,
            startedAt: new Date(),
            submittedAt: new Date(),
          },
          {
            id: 'attempt-2',
            score: 70,
            passed: true,
            startedAt: new Date(),
            submittedAt: new Date(),
          },
        ],
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(quizWith2Attempts);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId: studentUserId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });

      const result = await service.findOne(
        quizId,
        studentUserId,
        UserRole.STUDENT,
      );

      expect(result.attemptCount).toBe(2);
      expect(result.remainingAttempts).toBe(1);
      expect(result.hasAttemptsRemaining).toBe(true);
    });

    it('should handle unlimited attempts (maxAttempts = null)', async () => {
      const unlimitedQuiz = {
        ...mockQuiz,
        maxAttempts: null,
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(unlimitedQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId: studentUserId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });

      const result = await service.findOne(
        quizId,
        studentUserId,
        UserRole.STUDENT,
      );

      expect(result.remainingAttempts).toBeNull();
      expect(result.hasAttemptsRemaining).toBe(true);
    });

    it('should indicate no attempts remaining when maxAttempts reached', async () => {
      const quizNoAttemptsLeft = {
        ...mockQuiz,
        maxAttempts: 2,
        attempts: [
          {
            id: 'attempt-1',
            score: 80,
            passed: true,
            startedAt: new Date(),
            submittedAt: new Date(),
          },
          {
            id: 'attempt-2',
            score: 70,
            passed: true,
            startedAt: new Date(),
            submittedAt: new Date(),
          },
        ],
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(quizNoAttemptsLeft);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId: studentUserId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });

      const result = await service.findOne(
        quizId,
        studentUserId,
        UserRole.STUDENT,
      );

      expect(result.attemptCount).toBe(2);
      expect(result.remainingAttempts).toBe(0);
      expect(result.hasAttemptsRemaining).toBe(false);
    });

    it('should not validate enrollment for admin users', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);

      await service.findOne(quizId, adminUserId, UserRole.ADMINISTRATOR);

      expect(prismaService.courseEnrollment.findFirst).not.toHaveBeenCalled();
    });

    it('should allow admin to view DRAFT quizzes', async () => {
      const draftQuiz = { ...mockQuiz, status: QuizStatus.DRAFT };
      mockPrismaService.quiz.findUnique.mockResolvedValue(draftQuiz);

      const result = await service.findOne(
        quizId,
        adminUserId,
        UserRole.ADMINISTRATOR,
      );

      expect(result.id).toBe(quizId);
      expect(result.status).toBe(QuizStatus.DRAFT);
    });
  });

  describe('getQuizAttempts', () => {
    const quizId = 'quiz-123';
    const studentUserId = 'student-456';
    const adminUserId = 'admin-789';

    const mockAttempts = [
      {
        id: 'attempt-1',
        quizId,
        studentId: studentUserId,
        score: 85,
        passed: true,
        startedAt: new Date('2024-01-15T10:00:00'),
        submittedAt: new Date('2024-01-15T10:30:00'),
        student: {
          id: studentUserId,
          firstName: 'John',
          lastName: 'Doe',
          admissionId: 'ADM001',
        },
      },
      {
        id: 'attempt-2',
        quizId,
        studentId: studentUserId,
        score: 70,
        passed: true,
        startedAt: new Date('2024-01-14T10:00:00'),
        submittedAt: new Date('2024-01-14T10:30:00'),
        student: {
          id: studentUserId,
          firstName: 'John',
          lastName: 'Doe',
          admissionId: 'ADM001',
        },
      },
    ];

    it('should return student own attempts only for STUDENT role', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue({ id: quizId });
      mockPrismaService.quizAttempt = {
        findMany: jest.fn().mockResolvedValue(mockAttempts),
      } as any;

      const result = await service.getQuizAttempts(
        quizId,
        studentUserId,
        UserRole.STUDENT,
      );

      expect(mockPrismaService.quizAttempt.findMany).toHaveBeenCalledWith({
        where: { quizId, studentId: studentUserId },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionId: true,
            },
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0].studentName).toBe('John Doe');
      expect(result[0].score).toBe(85);
    });

    it('should return all attempts for admin when no studentId filter', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue({ id: quizId });
      mockPrismaService.quizAttempt = {
        findMany: jest.fn().mockResolvedValue(mockAttempts),
      } as any;

      const result = await service.getQuizAttempts(
        quizId,
        adminUserId,
        UserRole.ADMINISTRATOR,
      );

      expect(mockPrismaService.quizAttempt.findMany).toHaveBeenCalledWith({
        where: { quizId },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionId: true,
            },
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
      });
      expect(result).toHaveLength(2);
    });

    it('should filter by studentId for admin when provided', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue({ id: quizId });
      mockPrismaService.quizAttempt = {
        findMany: jest.fn().mockResolvedValue([mockAttempts[0]]),
      } as any;

      const result = await service.getQuizAttempts(
        quizId,
        adminUserId,
        UserRole.ADMINISTRATOR,
        studentUserId,
      );

      expect(mockPrismaService.quizAttempt.findMany).toHaveBeenCalledWith({
        where: { quizId, studentId: studentUserId },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionId: true,
            },
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
      });
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException if quiz does not exist', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(null);

      await expect(
        service.getQuizAttempts(quizId, studentUserId, UserRole.STUDENT),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAttemptDetail', () => {
    const attemptId = 'attempt-123';
    const quizId = 'quiz-456';
    const studentUserId = 'student-789';
    const adminUserId = 'admin-101';

    const mockAttempt = {
      id: attemptId,
      quizId,
      studentId: studentUserId,
      answers: [
        { questionId: 'q1', selectedAnswer: 'a' },
        { questionId: 'q2', selectedAnswer: 'b' },
      ],
      score: 85,
      passed: true,
      startedAt: new Date('2024-01-15T10:00:00'),
      submittedAt: new Date('2024-01-15T10:30:00'),
      quiz: {
        id: quizId,
        title: 'Math Quiz',
        totalMarks: 100,
        passMark: 70,
        questions: [
          {
            id: 'q1',
            questionText: 'What is 2+2?',
            options: [
              { id: 'a', text: '4' },
              { id: 'b', text: '5' },
            ],
            correctAnswer: 'a',
            marks: 50,
            displayOrder: 0,
          },
          {
            id: 'q2',
            questionText: 'What is 3+3?',
            options: [
              { id: 'a', text: '5' },
              { id: 'b', text: '6' },
            ],
            correctAnswer: 'b',
            marks: 50,
            displayOrder: 1,
          },
        ],
      },
      student: {
        id: studentUserId,
        firstName: 'Jane',
        lastName: 'Smith',
        admissionId: 'ADM002',
      },
    };

    it('should return detailed attempt for student own attempt', async () => {
      mockPrismaService.quizAttempt = {
        findUnique: jest.fn().mockResolvedValue(mockAttempt),
      } as any;

      const result = await service.getAttemptDetail(
        attemptId,
        studentUserId,
        UserRole.STUDENT,
      );

      expect(result.id).toBe(attemptId);
      expect(result.quizTitle).toBe('Math Quiz');
      expect(result.studentName).toBe('Jane Smith');
      expect(result.score).toBe(85);
      expect(result.passed).toBe(true);
      expect(result.questions).toHaveLength(2);
      expect(result.questions[0].isCorrect).toBe(true);
      expect(result.questions[0].marksAwarded).toBe(50);
      expect(result.questions[1].isCorrect).toBe(true);
      expect(result.questions[1].marksAwarded).toBe(50);
    });

    it('should throw ForbiddenException if student tries to view another student attempt', async () => {
      mockPrismaService.quizAttempt = {
        findUnique: jest.fn().mockResolvedValue(mockAttempt),
      } as any;

      await expect(
        service.getAttemptDetail('attempt-123', 'other-student', UserRole.STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to view any attempt', async () => {
      mockPrismaService.quizAttempt = {
        findUnique: jest.fn().mockResolvedValue(mockAttempt),
      } as any;

      const result = await service.getAttemptDetail(
        attemptId,
        adminUserId,
        UserRole.ADMINISTRATOR,
      );

      expect(result.id).toBe(attemptId);
      expect(result.questions).toHaveLength(2);
    });

    it('should throw NotFoundException if attempt does not exist', async () => {
      mockPrismaService.quizAttempt = {
        findUnique: jest.fn().mockResolvedValue(null),
      } as any;

      await expect(
        service.getAttemptDetail(attemptId, studentUserId, UserRole.STUDENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('should correctly mark wrong answers', async () => {
      const attemptWithWrongAnswer = {
        ...mockAttempt,
        answers: [
          { questionId: 'q1', selectedAnswer: 'b' }, // Wrong answer
          { questionId: 'q2', selectedAnswer: 'b' }, // Correct answer
        ],
        score: 50,
      };

      mockPrismaService.quizAttempt = {
        findUnique: jest.fn().mockResolvedValue(attemptWithWrongAnswer),
      } as any;

      const result = await service.getAttemptDetail(
        attemptId,
        studentUserId,
        UserRole.STUDENT,
      );

      expect(result.questions[0].isCorrect).toBe(false);
      expect(result.questions[0].marksAwarded).toBe(0);
      expect(result.questions[1].isCorrect).toBe(true);
      expect(result.questions[1].marksAwarded).toBe(50);
    });
  });

  describe('submitQuiz', () => {
    const quizId = 'quiz-123';
    const studentId = 'student-456';
    const courseId = 'course-789';

    const mockQuiz = {
      id: quizId,
      title: 'Test Quiz',
      status: QuizStatus.PUBLISHED,
      passMark: 70,
      totalMarks: 100,
      maxAttempts: 3,
      attachmentType: QuizAttachmentType.COURSE,
      courseId,
      questions: [
        {
          id: 'q1',
          questionText: 'What is 2+2?',
          correctAnswer: 'a',
          marks: 50,
          displayOrder: 0,
        },
        {
          id: 'q2',
          questionText: 'What is 3+3?',
          correctAnswer: 'b',
          marks: 50,
          displayOrder: 1,
        },
      ],
    };

    beforeEach(() => {
      mockPrismaService.quizAttempt = {
        count: jest.fn(),
        create: jest.fn(),
      } as any;
    });

    it('should successfully submit quiz with all correct answers', async () => {
      const submitDto = {
        answers: [
          { questionId: 'q1', selectedAnswer: 'a' },
          { questionId: 'q2', selectedAnswer: 'b' },
        ],
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });
      mockPrismaService.quizAttempt.count.mockResolvedValue(0);
      mockPrismaService.quizAttempt.create.mockResolvedValue({
        id: 'attempt-123',
        quizId,
        studentId,
        answers: submitDto.answers,
        score: 100,
        passed: true,
        startedAt: new Date(),
        submittedAt: new Date(),
      });

      const result = await service.submitQuiz(quizId, studentId, submitDto);

      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.correctAnswers).toHaveLength(2);
      expect(result.correctAnswers[0].questionId).toBe('q1');
      expect(result.correctAnswers[0].correctAnswer).toBe('a');
      expect(result.correctAnswers[1].questionId).toBe('q2');
      expect(result.correctAnswers[1].correctAnswer).toBe('b');
      expect(result.attemptId).toBe('attempt-123');
    });

    it('should calculate score correctly with some wrong answers', async () => {
      const submitDto = {
        answers: [
          { questionId: 'q1', selectedAnswer: 'b' }, // wrong
          { questionId: 'q2', selectedAnswer: 'b' }, // correct
        ],
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });
      mockPrismaService.quizAttempt.count.mockResolvedValue(0);
      mockPrismaService.quizAttempt.create.mockResolvedValue({
        id: 'attempt-123',
        quizId,
        studentId,
        answers: submitDto.answers,
        score: 50,
        passed: false,
        startedAt: new Date(),
        submittedAt: new Date(),
      });

      const result = await service.submitQuiz(quizId, studentId, submitDto);

      expect(result.score).toBe(50);
      expect(result.passed).toBe(false);
      expect(result.passMark).toBe(70);
      expect(result.totalMarks).toBe(100);
    });

    it('should set passed to true when score equals passMark', async () => {
      const quizWithLowerPass = {
        ...mockQuiz,
        passMark: 50,
      };

      const submitDto = {
        answers: [
          { questionId: 'q1', selectedAnswer: 'b' }, // wrong
          { questionId: 'q2', selectedAnswer: 'b' }, // correct
        ],
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(quizWithLowerPass);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });
      mockPrismaService.quizAttempt.count.mockResolvedValue(0);
      mockPrismaService.quizAttempt.create.mockResolvedValue({
        id: 'attempt-123',
        quizId,
        studentId,
        answers: submitDto.answers,
        score: 50,
        passed: true,
        startedAt: new Date(),
        submittedAt: new Date(),
      });

      const result = await service.submitQuiz(quizId, studentId, submitDto);

      expect(result.score).toBe(50);
      expect(result.passed).toBe(true);
    });

    it('should throw NotFoundException if quiz does not exist', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(null);

      await expect(
        service.submitQuiz(quizId, studentId, { answers: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if quiz is not published', async () => {
      const draftQuiz = { ...mockQuiz, status: QuizStatus.DRAFT };
      mockPrismaService.quiz.findUnique.mockResolvedValue(draftQuiz);

      await expect(
        service.submitQuiz(quizId, studentId, { answers: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if student is not enrolled', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.submitQuiz(quizId, studentId, { answers: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if max attempts reached', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });
      mockPrismaService.quizAttempt.count.mockResolvedValue(3); // Max attempts reached

      await expect(
        service.submitQuiz(quizId, studentId, { answers: [] }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.quizAttempt.count).toHaveBeenCalledWith({
        where: { quizId, studentId },
      });
    });

    it('should throw BadRequestException if missing answers', async () => {
      const submitDto = {
        answers: [{ questionId: 'q1', selectedAnswer: 'a' }], // Missing q2
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });
      mockPrismaService.quizAttempt.count.mockResolvedValue(0);

      await expect(
        service.submitQuiz(quizId, studentId, submitDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if extra answers provided', async () => {
      const submitDto = {
        answers: [
          { questionId: 'q1', selectedAnswer: 'a' },
          { questionId: 'q2', selectedAnswer: 'b' },
          { questionId: 'q3', selectedAnswer: 'c' }, // Extra question not in quiz
        ],
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });
      mockPrismaService.quizAttempt.count.mockResolvedValue(0);

      await expect(
        service.submitQuiz(quizId, studentId, submitDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle quiz with zero score correctly', async () => {
      const submitDto = {
        answers: [
          { questionId: 'q1', selectedAnswer: 'wrong' },
          { questionId: 'q2', selectedAnswer: 'wrong' },
        ],
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });
      mockPrismaService.quizAttempt.count.mockResolvedValue(0);
      mockPrismaService.quizAttempt.create.mockResolvedValue({
        id: 'attempt-123',
        quizId,
        studentId,
        answers: submitDto.answers,
        score: 0,
        passed: false,
        startedAt: new Date(),
        submittedAt: new Date(),
      });

      const result = await service.submitQuiz(quizId, studentId, submitDto);

      expect(result.score).toBe(0);
      expect(result.passed).toBe(false);
    });

    it('should allow unlimited attempts when maxAttempts is null', async () => {
      const unlimitedQuiz = { ...mockQuiz, maxAttempts: null };
      const submitDto = {
        answers: [
          { questionId: 'q1', selectedAnswer: 'a' },
          { questionId: 'q2', selectedAnswer: 'b' },
        ],
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(unlimitedQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });
      mockPrismaService.quizAttempt.create.mockResolvedValue({
        id: 'attempt-123',
        quizId,
        studentId,
        answers: submitDto.answers,
        score: 100,
        passed: true,
        startedAt: new Date(),
        submittedAt: new Date(),
      });

      const result = await service.submitQuiz(quizId, studentId, submitDto);

      expect(result.attemptId).toBe('attempt-123');
      // count should not be called when maxAttempts is null
      expect(mockPrismaService.quizAttempt.count).not.toHaveBeenCalled();
    });

    it('should store answers as JSON array in correct format', async () => {
      const submitDto = {
        answers: [
          { questionId: 'q1', selectedAnswer: 'a' },
          { questionId: 'q2', selectedAnswer: 'b' },
        ],
      };

      mockPrismaService.quiz.findUnique.mockResolvedValue(mockQuiz);
      mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        studentId,
        courseId,
        status: CourseEnrollmentStatus.ACTIVE,
      });
      mockPrismaService.quizAttempt.count.mockResolvedValue(0);
      mockPrismaService.quizAttempt.create.mockResolvedValue({
        id: 'attempt-123',
        quizId,
        studentId,
        answers: submitDto.answers,
        score: 100,
        passed: true,
        startedAt: new Date(),
        submittedAt: new Date(),
      });

      await service.submitQuiz(quizId, studentId, submitDto);

      expect(mockPrismaService.quizAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          answers: submitDto.answers,
        }),
      });
    });

    describe('time limit (R25)', () => {
      const enrol = () => {
        mockPrismaService.courseEnrollment.findFirst.mockResolvedValue({
          id: 'enrollment-1', studentId, courseId, status: CourseEnrollmentStatus.ACTIVE,
        });
        mockPrismaService.quizAttempt.count.mockResolvedValue(0);
        mockPrismaService.quizAttempt.create.mockImplementation(async ({ data }: any) => ({ id: 'attempt-t', ...data }));
      };
      const partial = { answers: [{ questionId: 'q1', selectedAnswer: 'a' }] };

      it('accepts a timed-out submission with gaps and scores the gaps as 0', async () => {
        mockPrismaService.quiz.findUnique.mockResolvedValue({ ...mockQuiz, timeLimit: 10 });
        enrol();
        const result = await service.submitQuiz(quizId, studentId, { ...partial, timedOut: true });
        expect(result.score).toBe(50);
        expect(result.passed).toBe(false);
      });

      it('still requires every answer when the quiz has no time limit', async () => {
        mockPrismaService.quiz.findUnique.mockResolvedValue({ ...mockQuiz, timeLimit: null });
        enrol();
        await expect(service.submitQuiz(quizId, studentId, { ...partial, timedOut: true })).rejects.toThrow(
          'All questions must be answered',
        );
      });

      it('records a plausible start time and ignores implausible ones', () => {
        const now = new Date('2026-11-21T10:00:00Z');
        expect(plausibleStart('2026-11-21T09:50:00Z', now).toISOString()).toBe('2026-11-21T09:50:00.000Z');
        expect(plausibleStart('2026-11-21T11:00:00Z', now)).toBe(now); // future
        expect(plausibleStart('2026-11-19T09:00:00Z', now)).toBe(now); // over a day old
        expect(plausibleStart(undefined, now)).toBe(now);
      });
    });
  });
  describe('quizzes after videos (lesson and module quizzes)', () => {
    const questions = [
      { id: 'q1', questionText: 'Q1', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctAnswer: 'a', marks: 5, displayOrder: 0 },
      { id: 'q2', questionText: 'Q2', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctAnswer: 'b', marks: 5, displayOrder: 1 },
    ];
    const quizOf = (attachmentType: QuizAttachmentType) => ({
      id: 'quiz-1',
      title: 'Lesson quiz',
      attachmentType,
      courseId: attachmentType === QuizAttachmentType.COURSE ? 'course-1' : null,
      moduleId: null,
      lessonId: attachmentType === QuizAttachmentType.LESSON ? 'lesson-1' : null,
      passMark: 10,
      totalMarks: 10,
      maxAttempts: 2,
      timeLimit: null,
      status: QuizStatus.PUBLISHED,
      questions,
    });
    const failingAnswers = { answers: [{ questionId: 'q1', selectedAnswer: 'a' }, { questionId: 'q2', selectedAnswer: 'a' }] };

    const setUpSubmit = (attachmentType: QuizAttachmentType, attemptsSoFar: number) => {
      mockPrismaService.quiz.findUnique = jest.fn().mockResolvedValue(quizOf(attachmentType));
      mockPrismaService.lesson.findUnique = jest.fn().mockResolvedValue({ id: 'lesson-1', module: { courseId: 'course-1' } });
      mockPrismaService.courseEnrollment.findFirst = jest.fn().mockResolvedValue({ id: 'enrol-1' });
      mockPrismaService.quizAttempt = {
        ...mockPrismaService.quizAttempt,
        count: jest.fn().mockResolvedValue(attemptsSoFar),
        create: jest.fn().mockResolvedValue({ id: 'attempt-new', submittedAt: new Date() }),
      } as any;
    };

    it('lets students retry without an attempt limit and hides answers until they pass', async () => {
      setUpSubmit(QuizAttachmentType.LESSON, 5);
      const result = await service.submitQuiz('quiz-1', 'student-1', failingAnswers as any);
      expect(result.passed).toBe(false);
      expect(result.answersVisible).toBe(false);
      expect(result.correctAnswers).toEqual([]);
    });

    it('shows the answers as soon as the student passes', async () => {
      setUpSubmit(QuizAttachmentType.LESSON, 1);
      const result = await service.submitQuiz('quiz-1', 'student-1', {
        answers: [{ questionId: 'q1', selectedAnswer: 'a' }, { questionId: 'q2', selectedAnswer: 'b' }],
      } as any);
      expect(result.passed).toBe(true);
      expect(result.answersVisible).toBe(true);
      expect(result.correctAnswers).toHaveLength(2);
    });

    it('keeps course quizzes as before: attempt limit applies and answers are shown', async () => {
      setUpSubmit(QuizAttachmentType.COURSE, 2);
      await expect(service.submitQuiz('quiz-1', 'student-1', failingAnswers as any)).rejects.toThrow('Maximum attempts (2) reached');

      setUpSubmit(QuizAttachmentType.COURSE, 0);
      const result = await service.submitQuiz('quiz-1', 'student-1', failingAnswers as any);
      expect(result.answersVisible).toBe(true);
      expect(result.correctAnswers).toHaveLength(2);
    });

    it('hides correct answers in a failed attempt review until the quiz is passed, but keeps the score', async () => {
      mockPrismaService.quizAttempt = {
        ...mockPrismaService.quizAttempt,
        findUnique: jest.fn().mockResolvedValue({
          id: 'attempt-1',
          quizId: 'quiz-1',
          studentId: 'student-1',
          answers: failingAnswers.answers,
          score: 5,
          passed: false,
          startedAt: new Date(),
          submittedAt: new Date(),
          quiz: quizOf(QuizAttachmentType.LESSON),
          student: { id: 'student-1', firstName: 'A', lastName: 'B', admissionId: 'X' },
        }),
      } as any;
      const result = await service.getAttemptDetail('attempt-1', 'student-1', UserRole.STUDENT);
      expect(result.answersVisible).toBe(false);
      expect(result.correctCount).toBe(1);
      expect(result.questions.every((q) => q.correctAnswer === null && q.isCorrect === null)).toBe(true);
      expect(result.questions[0].selectedAnswer).toBe('a');

      // Staff always see the full review
      const staffView = await service.getAttemptDetail('attempt-1', 'staff-1', UserRole.STAFF);
      expect(staffView.questions[0].correctAnswer).toBe('a');
    });
  });
});
