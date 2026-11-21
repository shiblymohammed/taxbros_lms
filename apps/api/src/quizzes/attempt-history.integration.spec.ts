import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { QuizzesModule } from './quizzes.module';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '@prisma/client';

/**
 * Integration tests for Quiz Attempt History endpoints
 * 
 * Requirements:
 * - R26: Quiz attempt history and review
 * - Task 40: Attempt history endpoints
 * 
 * Test Coverage: T5 (Attempt history)
 */
describe('Quiz Attempt History (Integration)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  // Mock data IDs
  const quizId = 'test-quiz-123';
  const studentUserId = 'student-456';
  const adminUserId = 'admin-789';
  const attemptId = 'attempt-101';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [QuizzesModule],
    })
      // Sign every request in as an administrator; RolesGuard still runs for real
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { userId: adminUserId, id: adminUserId, role: UserRole.ADMINISTRATOR };
          return true;
        },
      })
      .overrideProvider(PrismaService)
      .useValue({
        quiz: {
          findUnique: jest.fn(),
        },
        quizAttempt: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /quizzes/:id/attempts', () => {
    const mockQuiz = { id: quizId, title: 'Test Quiz' };
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
    ];

    it('should return attempts for a quiz', async () => {
      jest.spyOn(prismaService.quiz, 'findUnique').mockResolvedValue(mockQuiz as any);
      jest.spyOn(prismaService.quizAttempt, 'findMany').mockResolvedValue(mockAttempts as any);

      const response = await request(app.getHttpServer())
        .get(`/quizzes/${quizId}/attempts`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 'attempt-1',
        quizId,
        studentId: studentUserId,
        studentName: 'John Doe',
        admissionId: 'ADM001',
        score: 85,
        passed: true,
      });
    });

    it('should filter attempts by studentId when provided', async () => {
      jest.spyOn(prismaService.quiz, 'findUnique').mockResolvedValue(mockQuiz as any);
      jest.spyOn(prismaService.quizAttempt, 'findMany').mockResolvedValue(mockAttempts as any);

      await request(app.getHttpServer())
        .get(`/quizzes/${quizId}/attempts?studentId=${studentUserId}`)
        .expect(200);

      expect(prismaService.quizAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ studentId: studentUserId }),
        }),
      );
    });

    it('should return 404 if quiz does not exist', async () => {
      jest.spyOn(prismaService.quiz, 'findUnique').mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/quizzes/${quizId}/attempts`)
        .expect(404);
    });
  });

  describe('GET /attempts/:id', () => {
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

    it('should return detailed attempt information', async () => {
      jest.spyOn(prismaService.quizAttempt, 'findUnique').mockResolvedValue(mockAttempt as any);

      const response = await request(app.getHttpServer())
        .get(`/quizzes/attempts/${attemptId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: attemptId,
        quizId,
        quizTitle: 'Math Quiz',
        studentName: 'Jane Smith',
        admissionId: 'ADM002',
        score: 85,
        totalMarks: 100,
        passMark: 70,
        passed: true,
      });

      expect(response.body.questions).toHaveLength(2);
      expect(response.body.questions[0]).toMatchObject({
        questionText: 'What is 2+2?',
        correctAnswer: 'a',
        selectedAnswer: 'a',
        isCorrect: true,
        marksAwarded: 50,
      });
    });

    it('should return 404 if attempt does not exist', async () => {
      jest.spyOn(prismaService.quizAttempt, 'findUnique').mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/quizzes/attempts/${attemptId}`)
        .expect(404);
    });

    it('should show correct and incorrect answers', async () => {
      const attemptWithWrongAnswer = {
        ...mockAttempt,
        answers: [
          { questionId: 'q1', selectedAnswer: 'b' }, // Wrong
          { questionId: 'q2', selectedAnswer: 'b' }, // Correct
        ],
        score: 50,
      };

      jest.spyOn(prismaService.quizAttempt, 'findUnique').mockResolvedValue(attemptWithWrongAnswer as any);

      const response = await request(app.getHttpServer())
        .get(`/quizzes/attempts/${attemptId}`)
        .expect(200);

      expect(response.body.questions[0].isCorrect).toBe(false);
      expect(response.body.questions[0].marksAwarded).toBe(0);
      expect(response.body.questions[1].isCorrect).toBe(true);
      expect(response.body.questions[1].marksAwarded).toBe(50);
    });
  });
});
