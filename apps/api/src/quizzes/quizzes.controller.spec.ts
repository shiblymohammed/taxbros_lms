import { Test, TestingModule } from '@nestjs/testing';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { UserRole, QuizStatus, QuizAttachmentType } from '@prisma/client';
import { CreateQuizDto, CreateQuizWithQuestionsDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { PrismaService } from '../prisma/prisma.service';

describe('QuizzesController', () => {
  let controller: QuizzesController;
  let service: QuizzesService;

  const mockQuizzesService = {
    findOne: jest.fn(),
    create: jest.fn(),
    createWithQuestions: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    publish: jest.fn(),
    remove: jest.fn(),
    addQuestion: jest.fn(),
    updateQuestion: jest.fn(),
    removeQuestion: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizzesController],
      providers: [
        { provide: PrismaService, useValue: {} },
        {
          provide: QuizzesService,
          useValue: mockQuizzesService,
        },
      ],
    }).compile();

    controller = module.get<QuizzesController>(QuizzesController);
    service = module.get<QuizzesService>(QuizzesService);

    jest.clearAllMocks();
  });

  describe('create - POST /quizzes', () => {
    it('should create a quiz without questions', async () => {
      const createDto: CreateQuizDto = {
        title: 'Test Quiz',
        description: 'Test Description',
        attachmentType: QuizAttachmentType.COURSE,
        courseId: 'course-123',
        passMark: 70,
        totalMarks: 100,
        timeLimit: 60,
      };

      const req = { user: { userId: 'admin-123' } };
      const expectedQuiz = { id: 'quiz-123', ...createDto, status: QuizStatus.DRAFT };

      mockQuizzesService.create.mockResolvedValue(expectedQuiz);

      const result = await controller.create(createDto as CreateQuizWithQuestionsDto, req);

      expect(service.create).toHaveBeenCalledWith(createDto, 'admin-123');
      expect(result).toEqual(expectedQuiz);
    });

    it('should create a quiz with questions', async () => {
      const createDto: CreateQuizWithQuestionsDto = {
        title: 'Test Quiz',
        description: 'Test Description',
        attachmentType: QuizAttachmentType.COURSE,
        courseId: 'course-123',
        passMark: 70,
        totalMarks: 100,
        questions: [
          {
            questionText: 'What is 2+2?',
            options: [
              { id: 'opt1', text: '3' },
              { id: 'opt2', text: '4' },
            ],
            correctAnswer: 'opt2',
            marks: 10,
          },
        ],
      };

      const req = { user: { userId: 'admin-123' } };
      const expectedQuiz = { id: 'quiz-123', ...createDto, status: QuizStatus.DRAFT };

      mockQuizzesService.createWithQuestions.mockResolvedValue(expectedQuiz);

      const result = await controller.create(createDto, req);

      expect(service.createWithQuestions).toHaveBeenCalledWith(createDto, 'admin-123');
      expect(result).toEqual(expectedQuiz);
    });
  });

  describe('findAll - GET /quizzes', () => {
    it('should return all quizzes for administrators', async () => {
      const query = { status: QuizStatus.PUBLISHED };
      const req = { user: { role: UserRole.ADMINISTRATOR } };
      const expectedQuizzes = [
        { id: 'quiz-1', title: 'Quiz 1', status: QuizStatus.PUBLISHED },
        { id: 'quiz-2', title: 'Quiz 2', status: QuizStatus.DRAFT },
      ];

      mockQuizzesService.findAll.mockResolvedValue(expectedQuizzes);

      const result = await controller.findAll(query, req);

      expect(service.findAll).toHaveBeenCalledWith(query, UserRole.ADMINISTRATOR, undefined);
      expect(result).toEqual(expectedQuizzes);
    });

    it('passes the student role so the service forces PUBLISHED and hides answers', async () => {
      const query = {};
      const req = { user: { role: UserRole.STUDENT, studentId: 'student-1' } };
      const expectedQuizzes = [
        { id: 'quiz-1', title: 'Quiz 1', status: QuizStatus.PUBLISHED },
      ];

      mockQuizzesService.findAll.mockResolvedValue(expectedQuizzes);

      await controller.findAll(query, req);

      // The rule lives in QuizzesService.findAll (covered in quizzes.service.spec.ts)
      expect(service.findAll).toHaveBeenCalledWith(query, UserRole.STUDENT, 'student-1');
    });
  });

  describe('findOne - GET /quizzes/:id', () => {
    const quizId = 'quiz-123';
    const studentUserId = 'student-456';
    const adminUserId = 'admin-789';

    const mockQuizWithAnswers = {
      id: quizId,
      title: 'Introduction Quiz',
      description: 'Test your knowledge',
      attachmentType: QuizAttachmentType.COURSE,
      courseId: 'course-123',
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
        },
      ],
      attemptCount: 1,
      remainingAttempts: 2,
      hasAttemptsRemaining: true,
    };

    const mockQuizWithoutAnswers = {
      ...mockQuizWithAnswers,
      questions: mockQuizWithAnswers.questions.map((q) => {
        const { correctAnswer, ...rest } = q;
        return rest;
      }),
    };

    it('should return quiz with masked answers for STUDENT role', async () => {
      const req = {
        user: { userId: studentUserId, role: UserRole.STUDENT, studentId: 'student-profile-1' },
      };

      mockQuizzesService.findOne.mockResolvedValue(mockQuizWithoutAnswers);

      const result = await controller.findOne(quizId, req);

      // Quiz records use the Student profile id, not the user id
      expect(service.findOne).toHaveBeenCalledWith(
        quizId,
        'student-profile-1',
        UserRole.STUDENT,
      );
      expect(result).toEqual(mockQuizWithoutAnswers);
      expect(result.questions[0]).not.toHaveProperty('correctAnswer');
      expect(result.questions[1]).not.toHaveProperty('correctAnswer');
    });

    it('should return quiz with correct answers for ADMINISTRATOR role', async () => {
      const req = {
        user: { userId: adminUserId, role: UserRole.ADMINISTRATOR },
      };

      mockQuizzesService.findOne.mockResolvedValue(mockQuizWithAnswers);

      const result = await controller.findOne(quizId, req);

      expect(service.findOne).toHaveBeenCalledWith(
        quizId,
        adminUserId,
        UserRole.ADMINISTRATOR,
      );
      expect(result).toEqual(mockQuizWithAnswers);
      expect((result.questions[0] as any).correctAnswer).toBe('opt2');
      expect((result.questions[1] as any).correctAnswer).toBe('opt2');
    });

    it('should return quiz with correct answers for STAFF role', async () => {
      const staffUserId = 'staff-999';
      const req = {
        user: { userId: staffUserId, role: UserRole.STAFF },
      };

      mockQuizzesService.findOne.mockResolvedValue(mockQuizWithAnswers);

      const result = await controller.findOne(quizId, req);

      expect(service.findOne).toHaveBeenCalledWith(
        quizId,
        staffUserId,
        UserRole.STAFF,
      );
      expect(result).toEqual(mockQuizWithAnswers);
      expect((result.questions[0] as any).correctAnswer).toBe('opt2');
      expect((result.questions[1] as any).correctAnswer).toBe('opt2');
    });

    it('should include attempt count and remaining attempts for students', async () => {
      const req = {
        user: { userId: studentUserId, role: UserRole.STUDENT, studentId: 'student-profile-1' },
      };

      mockQuizzesService.findOne.mockResolvedValue(mockQuizWithoutAnswers);

      const result = await controller.findOne(quizId, req);

      expect(result.attemptCount).toBe(1);
      expect(result.remainingAttempts).toBe(2);
      expect(result.hasAttemptsRemaining).toBe(true);
    });

    it('passes the Student profile id for students and the user id for staff', async () => {
      mockQuizzesService.findOne.mockResolvedValue(mockQuizWithoutAnswers);

      await controller.findOne(quizId, { user: { userId: 'u-1', role: UserRole.STUDENT, studentId: 's-1' } });
      expect(service.findOne).toHaveBeenLastCalledWith(quizId, 's-1', UserRole.STUDENT);

      await controller.findOne(quizId, { user: { userId: 'u-2', role: UserRole.STAFF } });
      expect(service.findOne).toHaveBeenLastCalledWith(quizId, 'u-2', UserRole.STAFF);
    });

    it('refuses a student account without a Student profile', () => {
      expect(() => controller.findOne(quizId, { user: { userId: 'u-1', role: UserRole.STUDENT } })).toThrow(
        'This account has no student profile',
      );
      expect(() =>
        controller.submitQuiz(quizId, { answers: [] } as any, { user: { userId: 'u-1', role: UserRole.STUDENT } }),
      ).toThrow('This account has no student profile');
    });
  });

  describe('update - PATCH /quizzes/:id', () => {
    it('should update quiz details', async () => {
      const quizId = 'quiz-123';
      const updateDto: UpdateQuizDto = {
        title: 'Updated Quiz Title',
        passMark: 80,
      };
      const updatedQuiz = { id: quizId, ...updateDto };

      mockQuizzesService.update.mockResolvedValue(updatedQuiz);

      const result = await controller.update(quizId, updateDto);

      expect(service.update).toHaveBeenCalledWith(quizId, updateDto);
      expect(result).toEqual(updatedQuiz);
    });

    it('should allow status update through update endpoint', async () => {
      const quizId = 'quiz-123';
      const updateDto: UpdateQuizDto = {
        status: QuizStatus.PUBLISHED,
      };
      const updatedQuiz = { id: quizId, status: QuizStatus.PUBLISHED };

      mockQuizzesService.update.mockResolvedValue(updatedQuiz);

      const result = await controller.update(quizId, updateDto);

      expect(service.update).toHaveBeenCalledWith(quizId, updateDto);
      expect(result.status).toBe(QuizStatus.PUBLISHED);
    });
  });

  describe('publish - PATCH /quizzes/:id/publish', () => {
    it('should publish a quiz', async () => {
      const quizId = 'quiz-123';
      const publishedQuiz = { 
        id: quizId, 
        title: 'Test Quiz', 
        status: QuizStatus.PUBLISHED 
      };

      mockQuizzesService.publish.mockResolvedValue(publishedQuiz);

      const result = await controller.publish(quizId);

      expect(service.publish).toHaveBeenCalledWith(quizId);
      expect(result).toEqual(publishedQuiz);
      expect(result.status).toBe(QuizStatus.PUBLISHED);
    });
  });

  describe('remove - DELETE /quizzes/:id', () => {
    it('should delete a quiz', async () => {
      const quizId = 'quiz-123';
      const deleteResponse = { message: 'Quiz deleted successfully' };

      mockQuizzesService.remove.mockResolvedValue(deleteResponse);

      const result = await controller.remove(quizId);

      expect(service.remove).toHaveBeenCalledWith(quizId);
      expect(result).toEqual(deleteResponse);
    });
  });

  describe('addQuestion - POST /quizzes/:id/questions', () => {
    it('should add a question to a quiz', async () => {
      const quizId = 'quiz-123';
      const createQuestionDto: CreateQuestionDto = {
        questionText: 'What is 2+2?',
        options: [
          { id: 'opt1', text: '3' },
          { id: 'opt2', text: '4' },
        ],
        correctAnswer: 'opt2',
        marks: 10,
      };
      const createdQuestion = { id: 'question-123', ...createQuestionDto, quizId };

      mockQuizzesService.addQuestion.mockResolvedValue(createdQuestion);

      const result = await controller.addQuestion(quizId, createQuestionDto);

      expect(service.addQuestion).toHaveBeenCalledWith(quizId, createQuestionDto);
      expect(result).toEqual(createdQuestion);
    });
  });

  describe('updateQuestion - PATCH /questions/:id', () => {
    it('should update a question', async () => {
      const questionId = 'question-123';
      const updateQuestionDto: UpdateQuestionDto = {
        questionText: 'Updated question text',
        marks: 15,
      };
      const updatedQuestion = { id: questionId, ...updateQuestionDto };

      mockQuizzesService.updateQuestion.mockResolvedValue(updatedQuestion);

      const result = await controller.updateQuestion(questionId, updateQuestionDto);

      expect(service.updateQuestion).toHaveBeenCalledWith(questionId, updateQuestionDto);
      expect(result).toEqual(updatedQuestion);
    });
  });

  describe('removeQuestion - DELETE /questions/:id', () => {
    it('should delete a question', async () => {
      const questionId = 'question-123';
      const deleteResponse = { message: 'Question deleted successfully' };

      mockQuizzesService.removeQuestion.mockResolvedValue(deleteResponse);

      const result = await controller.removeQuestion(questionId);

      expect(service.removeQuestion).toHaveBeenCalledWith(questionId);
      expect(result).toEqual(deleteResponse);
    });
  });
});
