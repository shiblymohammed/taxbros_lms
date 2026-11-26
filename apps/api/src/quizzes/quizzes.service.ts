import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuizDto, CreateQuizWithQuestionsDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { CourseAccessService, isAfterVideoQuiz } from '../progress/course-access.service';
import {
  QuizAttachmentType,
  QuizStatus,
  UserRole,
  CourseEnrollmentStatus,
} from '@prisma/client';

/**
 * Quizzes Service
 * 
 * Provides business logic for:
 * - Quiz CRUD operations
 * - Quiz question management
 * - Quiz retrieval with answer masking for students
 * - Access control based on enrollment
 * 
 * Requirements:
 * - R23: Quiz creation and configuration
 * - R24: Quiz question management
 * - R25: Quiz attempt submission (partially)
 */
@Injectable()
export class QuizzesService {
  /** Learning order: quizzes after videos open in sequence (only needs the database client) */
  private readonly access: CourseAccessService;

  constructor(private readonly prisma: PrismaService) {
    this.access = new CourseAccessService(prisma);
  }

  /**
   * Create a new quiz
   * 
   * Requirements:
   * - R23.1: Require title, passMark, totalMarks
   * - R23.2-5: Validate attachment type and corresponding ID
   * - R23.6: Set status to DRAFT by default
   */
  async create(createQuizDto: CreateQuizDto, createdBy: string) {
    // Validate attachment exists
    await this.validateAttachment(createQuizDto);

    // Validate passMark <= totalMarks
    if (createQuizDto.passMark > createQuizDto.totalMarks) {
      throw new BadRequestException('Pass mark cannot exceed total marks');
    }

    const quiz = await this.prisma.quiz.create({
      data: {
        title: createQuizDto.title,
        description: createQuizDto.description,
        attachmentType: createQuizDto.attachmentType,
        courseId: createQuizDto.courseId,
        moduleId: createQuizDto.moduleId,
        lessonId: createQuizDto.lessonId,
        passMark: createQuizDto.passMark,
        totalMarks: createQuizDto.totalMarks,
        timeLimit: createQuizDto.timeLimit,
        maxAttempts: createQuizDto.maxAttempts,
        displayOrder: createQuizDto.displayOrder || 0,
        status: QuizStatus.DRAFT,
        createdBy,
      },
      include: {
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return quiz;
  }

  /**
   * Create a new quiz with questions in one transaction
   * 
   * Requirements:
   * - R23: Quiz creation
   * - R24: Question creation
   * - Create quiz and questions atomically
   */
  async createWithQuestions(createQuizDto: CreateQuizWithQuestionsDto, createdBy: string) {
    // Validate attachment exists
    await this.validateAttachment(createQuizDto);

    // Validate passMark <= totalMarks
    if (createQuizDto.passMark > createQuizDto.totalMarks) {
      throw new BadRequestException('Pass mark cannot exceed total marks');
    }

    // Validate questions if provided
    if (createQuizDto.questions && createQuizDto.questions.length > 0) {
      for (const question of createQuizDto.questions) {
        const optionIds = question.options.map((opt) => opt.id);
        if (!optionIds.includes(question.correctAnswer)) {
          throw new BadRequestException(
            `Question "${question.questionText}": Correct answer must match one of the option IDs`,
          );
        }
      }
    }

    const quiz = await this.prisma.quiz.create({
      data: {
        title: createQuizDto.title,
        description: createQuizDto.description,
        attachmentType: createQuizDto.attachmentType,
        courseId: createQuizDto.courseId,
        moduleId: createQuizDto.moduleId,
        lessonId: createQuizDto.lessonId,
        passMark: createQuizDto.passMark,
        totalMarks: createQuizDto.totalMarks,
        timeLimit: createQuizDto.timeLimit,
        maxAttempts: createQuizDto.maxAttempts,
        displayOrder: createQuizDto.displayOrder || 0,
        status: QuizStatus.DRAFT,
        createdBy,
        questions: createQuizDto.questions
          ? {
              create: createQuizDto.questions.map((q) => ({
                questionText: q.questionText,
                options: q.options as any,
                correctAnswer: q.correctAnswer,
                marks: q.marks ?? 1,
                displayOrder: q.displayOrder ?? 0,
              })),
            }
          : undefined,
      },
      include: {
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return quiz;
  }

  /**
   * Find all quizzes with optional filters
   * 
   * Requirements:
   * - R23.10: Hide DRAFT quizzes from students
   */
  async findAll(
    filters?: {
      status?: QuizStatus;
      attachmentType?: QuizAttachmentType;
      courseId?: string;
      moduleId?: string;
      lessonId?: string;
    },
    userRole?: UserRole,
    studentId?: string,
  ) {
    const isStudent = userRole === UserRole.STUDENT;
    // A student account without a Student profile has no courses, so no quizzes
    if (isStudent && !studentId) return [];
    if (isStudent) {
      // R23.10: a student can't ask for drafts or archived quizzes
      filters = { ...filters, status: QuizStatus.PUBLISHED };
    }
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.attachmentType) {
      where.attachmentType = filters.attachmentType;
    }

    if (filters?.courseId) {
      where.courseId = filters.courseId;
    }

    if (filters?.moduleId) {
      where.moduleId = filters.moduleId;
    }

    if (filters?.lessonId) {
      where.lessonId = filters.lessonId;
    }

    // A student's active enrolments, read at the same time as the quizzes (used below)
    const enrolmentsLoad = isStudent
      ? this.prisma.courseEnrollment.findMany({ where: { studentId, status: 'ACTIVE' }, select: { courseId: true } })
      : Promise.resolve([] as Array<{ courseId: string }>);

    const quizzes = await this.prisma.quiz.findMany({
      where,
      include: {
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Every quiz belongs to a course, directly or through its module or lesson
    const withCourse = await this.attachOwningCourse(quizzes);

    if (!isStudent) {
      return withCourse;
    }

    // Students only get quizzes from courses they are actively enrolled in (R2.11)
    const enrolments = await enrolmentsLoad;
    const enrolled = new Set(enrolments.map((e) => e.courseId));

    const mine = withCourse.filter((quiz) => quiz.owningCourseId && enrolled.has(quiz.owningCourseId));

    // Quizzes after videos open in learning order: say which are still locked and why
    const gatedCourses = [...new Set(mine.filter(isAfterVideoQuiz).map((q) => q.owningCourseId as string))];
    const accessByCourse = new Map(
      await Promise.all(gatedCourses.map(async (courseId) => [courseId, (await this.access.forCourse(studentId!, courseId)).access] as const)),
    );

    // R25.2: never send answer keys to students
    return mine.map((quiz) => {
      const state = isAfterVideoQuiz(quiz) ? accessByCourse.get(quiz.owningCourseId as string)?.quizzes.get(quiz.id) : undefined;
      return {
        ...quiz,
        afterVideo: isAfterVideoQuiz(quiz),
        locked: isAfterVideoQuiz(quiz) ? !state?.open : false,
        blockedBy: state?.blockedBy ?? null,
        questions: quiz.questions.map(({ correctAnswer: _correctAnswer, ...question }) => question),
      };
    });
  }

  /** Adds owningCourseId: the course a quiz belongs to, whether attached to the course, a module or a lesson. */
  private async attachOwningCourse<T extends { courseId: string | null; moduleId: string | null; lessonId: string | null }>(
    quizzes: T[],
  ): Promise<Array<T & { owningCourseId: string | null }>> {
    const moduleIds = [...new Set(quizzes.map((q) => q.moduleId).filter((id): id is string => !!id))];
    const lessonIds = [...new Set(quizzes.map((q) => q.lessonId).filter((id): id is string => !!id))];
    const [modules, lessons] = await Promise.all([
      moduleIds.length
        ? this.prisma.courseModule.findMany({ where: { id: { in: moduleIds } }, select: { id: true, courseId: true } })
        : [],
      lessonIds.length
        ? this.prisma.lesson.findMany({
            where: { id: { in: lessonIds } },
            select: { id: true, module: { select: { courseId: true } } },
          })
        : [],
    ]);
    const moduleCourse = new Map(modules.map((m) => [m.id, m.courseId]));
    const lessonCourse = new Map(lessons.map((l) => [l.id, l.module.courseId]));
    return quizzes.map((q) => ({
      ...q,
      owningCourseId:
        q.courseId ?? (q.moduleId ? moduleCourse.get(q.moduleId) : undefined) ?? (q.lessonId ? lessonCourse.get(q.lessonId) : undefined) ?? null,
    }));
  }

  /**
   * Find one quiz by ID with role-based answer masking
   * 
   * Requirements:
   * - R25.1: Display all questions with options
   * - R25.2: NOT display correct answers before submission (for students)
   * - Task 38: Mask correctAnswer field for students
   * - Task 38: Include quiz settings (timeLimit, maxAttempts, passMark, totalMarks)
   * - Task 38: Include student's attempt history
   * - Task 38: Check if student has remaining attempts
   * 
   * @param id Quiz ID
   * @param userId Current user ID
   * @param userRole Current user role
   * @returns Quiz with questions (answers masked for students)
   */
  async findOne(id: string, userId: string, userRole: UserRole) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
        attempts: {
          where: { studentId: userId },
          orderBy: { submittedAt: 'desc' },
          select: {
            id: true,
            score: true,
            passed: true,
            startedAt: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    // For students, validate enrollment and mask correct answers
    if (userRole === UserRole.STUDENT) {
      // Validate quiz is published
      if (quiz.status !== QuizStatus.PUBLISHED) {
        throw new ForbiddenException('Quiz is not available');
      }

      // Validate student enrollment based on attachment type
      await this.validateStudentEnrollment(quiz, userId);

      // Quizzes after videos open only once the student reaches them
      await this.access.assertQuizOpen(userId, quiz);
      const afterVideo = isAfterVideoQuiz(quiz);

      // Mask correct answers for students
      const maskedQuestions = quiz.questions.map((question) => {
        const { correctAnswer, ...questionWithoutAnswer } = question;
        return questionWithoutAnswer;
      });

      // Calculate remaining attempts
      const attemptCount = quiz.attempts.length;
      const remainingAttempts = quiz.maxAttempts
        ? quiz.maxAttempts - attemptCount
        : null; // null means unlimited

      // Quizzes after videos can be retried without limit until passed
      return {
        ...quiz,
        questions: maskedQuestions,
        attemptCount,
        remainingAttempts: afterVideo ? null : remainingAttempts,
        hasAttemptsRemaining: afterVideo || !quiz.maxAttempts ? true : attemptCount < quiz.maxAttempts,
        afterVideo,
        passed: quiz.attempts.some((a) => a.passed),
      };
    }

    // For admins and staff, return full quiz including correct answers
    return {
      ...quiz,
      attemptCount: quiz.attempts.length,
      remainingAttempts: null, // Not applicable for admin/staff
      hasAttemptsRemaining: true,
    };
  }

  /**
   * Update a quiz
   * 
   * Requirements:
   * - R23.9: Support publishing
   */
  async update(id: string, updateQuizDto: UpdateQuizDto) {
    // Check if quiz exists
    const existingQuiz = await this.prisma.quiz.findUnique({
      where: { id },
    });

    if (!existingQuiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    // If updating attachment, validate it exists
    if (
      updateQuizDto.attachmentType ||
      updateQuizDto.courseId ||
      updateQuizDto.moduleId ||
      updateQuizDto.lessonId
    ) {
      await this.validateAttachment({
        attachmentType:
          updateQuizDto.attachmentType || existingQuiz.attachmentType,
        courseId: updateQuizDto.courseId || existingQuiz.courseId,
        moduleId: updateQuizDto.moduleId || existingQuiz.moduleId,
        lessonId: updateQuizDto.lessonId || existingQuiz.lessonId,
      } as CreateQuizDto);
    }

    // Validate passMark <= totalMarks
    const passMark = updateQuizDto.passMark ?? existingQuiz.passMark;
    const totalMarks = updateQuizDto.totalMarks ?? existingQuiz.totalMarks;
    if (passMark > totalMarks) {
      throw new BadRequestException('Pass mark cannot exceed total marks');
    }

    const quiz = await this.prisma.quiz.update({
      where: { id },
      data: updateQuizDto,
      include: {
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return quiz;
  }

  /**
   * Publish a quiz
   * 
   * Requirements:
   * - R23.9: Publish quiz (status → PUBLISHED)
   */
  async publish(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: { select: { marks: true } } },
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    // R24.8: a published quiz must be answerable and its marks must add up
    if (quiz.questions.length === 0) {
      throw new BadRequestException('Add at least one question before publishing');
    }
    const questionMarks = quiz.questions.reduce((sum, q) => sum + q.marks, 0);
    if (questionMarks !== quiz.totalMarks) {
      throw new BadRequestException(
        `Question marks add up to ${questionMarks}, but the quiz total is ${quiz.totalMarks}. Adjust the marks or the total before publishing.`,
      );
    }

    const updatedQuiz = await this.prisma.quiz.update({
      where: { id },
      data: { status: QuizStatus.PUBLISHED },
      include: {
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return updatedQuiz;
  }

  /**
   * Delete a quiz
   * 
   * Requirements:
   * - Cascade delete questions (R24.7)
   */
  async remove(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    await this.prisma.quiz.delete({
      where: { id },
    });

    return { message: 'Quiz deleted successfully' };
  }

  /**
   * Add a question to a quiz
   * 
   * Requirements:
   * - R24.1: Require question text, options, correct answer
   * - R24.2: Store options as JSON array
   * - R24.3: Validate correct answer matches one option ID
   * - R24.4: Default marks to 1
   */
  async addQuestion(quizId: string, createQuestionDto: CreateQuestionDto) {
    // Check if quiz exists
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${quizId} not found`);
    }

    // Validate correct answer matches one option ID
    const optionIds = createQuestionDto.options.map((opt) => opt.id);
    if (!optionIds.includes(createQuestionDto.correctAnswer)) {
      throw new BadRequestException(
        'Correct answer must match one of the option IDs',
      );
    }

    const question = await this.prisma.quizQuestion.create({
      data: {
        quizId,
        questionText: createQuestionDto.questionText,
        options: createQuestionDto.options as any,
        correctAnswer: createQuestionDto.correctAnswer,
        marks: createQuestionDto.marks ?? 1,
        displayOrder: createQuestionDto.displayOrder ?? 0,
      },
    });

    return question;
  }

  /**
   * Update a question
   * 
   * Requirements:
   * - R24.6: Allow editing question text, options, correct answer
   */
  async updateQuestion(
    questionId: string,
    updateQuestionDto: UpdateQuestionDto,
  ) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    // If updating options or correct answer, validate correct answer matches
    if (updateQuestionDto.options || updateQuestionDto.correctAnswer) {
      const options = updateQuestionDto.options || (question.options as any[]);
      const correctAnswer =
        updateQuestionDto.correctAnswer || question.correctAnswer;

      const optionIds = options.map((opt: any) => opt.id);
      if (!optionIds.includes(correctAnswer)) {
        throw new BadRequestException(
          'Correct answer must match one of the option IDs',
        );
      }
    }

    const updatedQuestion = await this.prisma.quizQuestion.update({
      where: { id: questionId },
      data: {
        ...updateQuestionDto,
        options: updateQuestionDto.options as any,
      },
    });

    return updatedQuestion;
  }

  /**
   * Delete a question
   */
  async removeQuestion(questionId: string) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    await this.prisma.quizQuestion.delete({
      where: { id: questionId },
    });

    return { message: 'Question deleted successfully' };
  }

  /**
   * Submit quiz answers and calculate score
   * 
   * Requirements:
   * - R25.3: Validate all questions have answers
   * - R25.4: Calculate score by comparing to correctAnswer
   * - R25.5: Set passed flag to TRUE when score >= passMark
   * - R25.6: Set passed flag to FALSE when score < passMark
   * - R25.7: Record startedAt timestamp
   * - R25.8: Record submittedAt timestamp
   * - R25.9: Store answers as JSON array
   * - R25.10: Return score and passed status immediately
   * 
   * Task 39: Quiz submission and scoring endpoint
   * 
   * @param quizId Quiz ID
   * @param studentId Student user ID
   * @param submitQuizDto Submitted answers
   * @returns Score, passed flag, correct answers array, and attempt ID
   */
  async submitQuiz(
    quizId: string,
    studentId: string,
    submitQuizDto: SubmitQuizDto,
  ) {
    // Fetch quiz with questions
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${quizId} not found`);
    }

    // Validate quiz is published
    if (quiz.status !== QuizStatus.PUBLISHED) {
      throw new BadRequestException('Quiz is not available for submission');
    }

    // Validate student enrollment
    await this.validateStudentEnrollment(quiz, studentId);

    // Quizzes after videos open only once the student reaches them, and have no attempt limit
    await this.access.assertQuizOpen(studentId, quiz);
    const afterVideo = isAfterVideoQuiz(quiz);

    // Check if student has remaining attempts
    if (quiz.maxAttempts && !afterVideo) {
      const attemptCount = await this.prisma.quizAttempt.count({
        where: {
          quizId,
          studentId,
        },
      });

      if (attemptCount >= quiz.maxAttempts) {
        throw new BadRequestException(
          `Maximum attempts (${quiz.maxAttempts}) reached for this quiz`,
        );
      }
    }

    // Validate all questions have answers
    const questionIds = quiz.questions.map((q) => q.id);
    const submittedQuestionIds = submitQuizDto.answers.map((a) => a.questionId);

    // Check if all questions are answered
    const missingQuestions = questionIds.filter(
      (qId) => !submittedQuestionIds.includes(qId),
    );

    // A timed quiz that ran out of time may be submitted with gaps; those questions score 0
    const allowGaps = submitQuizDto.timedOut === true && !!quiz.timeLimit;
    if (missingQuestions.length > 0 && !allowGaps) {
      throw new BadRequestException(
        `All questions must be answered. Missing answers for ${missingQuestions.length} question(s)`,
      );
    }

    // Check for extra answers (submitted answers not in quiz)
    const extraAnswers = submittedQuestionIds.filter(
      (qId) => !questionIds.includes(qId),
    );

    if (extraAnswers.length > 0) {
      throw new BadRequestException(
        'Invalid question IDs in submission',
      );
    }

    // Calculate score by comparing answers to correct answers
    let totalScore = 0;
    const correctAnswers: { questionId: string; correctAnswer: string }[] = [];

    for (const question of quiz.questions) {
      const submittedAnswer = submitQuizDto.answers.find(
        (a) => a.questionId === question.id,
      );

      correctAnswers.push({
        questionId: question.id,
        correctAnswer: question.correctAnswer,
      });

      // Award marks only if the selected answer matches the correct answer
      if (
        submittedAnswer &&
        submittedAnswer.selectedAnswer === question.correctAnswer
      ) {
        totalScore += question.marks;
      }
    }

    // Determine if passed (score >= passMark)
    const passed = totalScore >= quiz.passMark;

    // Create QuizAttempt record
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        studentId,
        answers: submitQuizDto.answers as any,
        score: totalScore,
        passed,
        startedAt: plausibleStart(submitQuizDto.startedAt),
        submittedAt: new Date(),
      },
    });

    // Quizzes after videos reveal the answers only once the student has passed
    const answersVisible = !afterVideo || passed || (await this.access.hasPassed(studentId, quizId));

    // Return score, passed status, correct answers array, and attempt ID
    return {
      attemptId: attempt.id,
      score: totalScore,
      totalMarks: quiz.totalMarks,
      passMark: quiz.passMark,
      passed,
      answersVisible,
      correctAnswers: answersVisible ? correctAnswers : [],
      submittedAt: attempt.submittedAt,
    };
  }

  /**
   * Validate that the attachment (course/module/lesson) exists
   * 
   * Requirements:
   * - R23.3-5: Validate attachment exists
   */
  private async validateAttachment(dto: CreateQuizDto) {
    if (dto.attachmentType === QuizAttachmentType.COURSE && dto.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: dto.courseId },
      });
      if (!course) {
        throw new NotFoundException(`Course with ID ${dto.courseId} not found`);
      }
    } else if (
      dto.attachmentType === QuizAttachmentType.MODULE &&
      dto.moduleId
    ) {
      const module = await this.prisma.courseModule.findUnique({
        where: { id: dto.moduleId },
      });
      if (!module) {
        throw new NotFoundException(`Module with ID ${dto.moduleId} not found`);
      }
    } else if (
      dto.attachmentType === QuizAttachmentType.LESSON &&
      dto.lessonId
    ) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: dto.lessonId },
      });
      if (!lesson) {
        throw new NotFoundException(`Lesson with ID ${dto.lessonId} not found`);
      }
    }
  }

  /**
   * Validate student enrollment based on quiz attachment type
   * 
   * Requirements:
   * - Task 38: Check student enrollment before granting access
   */
  private async validateStudentEnrollment(quiz: any, studentId: string) {
    if (quiz.attachmentType === QuizAttachmentType.COURSE) {
      const enrollment = await this.prisma.courseEnrollment.findFirst({
        where: {
          studentId,
          courseId: quiz.courseId,
          status: CourseEnrollmentStatus.ACTIVE,
        },
      });

      if (!enrollment) {
        throw new ForbiddenException(
          'You must be enrolled in the course to access this quiz',
        );
      }
    } else if (quiz.attachmentType === QuizAttachmentType.MODULE) {
      // Get the course ID from the module
      const module = await this.prisma.courseModule.findUnique({
        where: { id: quiz.moduleId },
        select: { courseId: true },
      });

      if (!module) {
        throw new NotFoundException('Module not found');
      }

      const enrollment = await this.prisma.courseEnrollment.findFirst({
        where: {
          studentId,
          courseId: module.courseId,
          status: CourseEnrollmentStatus.ACTIVE,
        },
      });

      if (!enrollment) {
        throw new ForbiddenException(
          'You must be enrolled in the course to access this quiz',
        );
      }
    } else if (quiz.attachmentType === QuizAttachmentType.LESSON) {
      // Get the course ID from the lesson's module
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: quiz.lessonId },
        include: { module: { select: { courseId: true } } },
      });

      if (!lesson) {
        throw new NotFoundException('Lesson not found');
      }

      const enrollment = await this.prisma.courseEnrollment.findFirst({
        where: {
          studentId,
          courseId: lesson.module.courseId,
          status: CourseEnrollmentStatus.ACTIVE,
        },
      });

      if (!enrollment) {
        throw new ForbiddenException(
          'You must be enrolled in the course to access this quiz',
        );
      }
    }
  }

  /**
   * Get all attempts for a quiz
   * 
   * Requirements:
   * - R26: Quiz attempt history
   * - Task 40: GET /quizzes/:id/attempts for list view
   * - Task 40: Filter by studentId for admin, own attempts for students
   * 
   * @param quizId Quiz ID
   * @param userId Current user ID
   * @param userRole Current user role
   * @param studentId Optional student ID for admin filtering
   * @returns Array of quiz attempts with basic information
   */
  async getQuizAttempts(
    quizId: string,
    userId: string,
    userRole: UserRole,
    studentId?: string,
  ) {
    // Check if quiz exists
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${quizId} not found`);
    }

    // Build where clause based on role
    const where: any = { quizId };

    if (userRole === UserRole.STUDENT) {
      // Students can only see their own attempts
      where.studentId = userId;
    } else if (studentId) {
      // Admins/staff can filter by studentId if provided
      where.studentId = studentId;
    }

    // Fetch attempts with student information
    const attempts = await this.prisma.quizAttempt.findMany({
      where,
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

    // Return formatted attempts
    return attempts.map((attempt) => ({
      id: attempt.id,
      quizId: attempt.quizId,
      studentId: attempt.studentId,
      studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
      admissionId: attempt.student.admissionId,
      score: attempt.score,
      passed: attempt.passed,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
    }));
  }

  /**
   * Get detailed view of a single quiz attempt
   * 
   * Requirements:
   * - R26: Quiz attempt review
   * - Task 40: GET /attempts/:id for detail view
   * - Task 40: Return attempt with questions, answers, correct answers
   * - Task 40: Display score, passed status, submitted timestamp
   * 
   * @param attemptId Quiz attempt ID
   * @param userId Current user ID
   * @param userRole Current user role
   * @returns Detailed attempt information with questions and answers
   */
  async getAttemptDetail(attemptId: string, userId: string, userRole: UserRole) {
    // Fetch attempt with related data
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionId: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`Attempt with ID ${attemptId} not found`);
    }

    // Students can only view their own attempts
    if (userRole === UserRole.STUDENT && attempt.studentId !== userId) {
      throw new ForbiddenException('You can only view your own quiz attempts');
    }

    // Parse answers from JSON
    const answers = attempt.answers as Array<{
      questionId: string;
      selectedAnswer: string;
    }>;

    // Quizzes after videos: a student sees the correct answers only after passing
    const afterVideo = isAfterVideoQuiz(attempt.quiz);
    const answersVisible =
      userRole !== UserRole.STUDENT || !afterVideo || attempt.passed || (await this.access.hasPassed(attempt.studentId, attempt.quiz.id));

    // Build detailed questions with answers
    const questionsWithAnswers = attempt.quiz.questions.map((question) => {
      const studentAnswer = answers.find((a) => a.questionId === question.id);

      const isCorrect = studentAnswer?.selectedAnswer === question.correctAnswer;
      return {
        id: question.id,
        questionText: question.questionText,
        options: question.options,
        correctAnswer: answersVisible ? question.correctAnswer : null,
        marks: question.marks,
        displayOrder: question.displayOrder,
        selectedAnswer: studentAnswer?.selectedAnswer || null,
        isCorrect: answersVisible ? isCorrect : null,
        marksAwarded: answersVisible ? (isCorrect ? question.marks : 0) : null,
      };
    });
    const correctCount = attempt.quiz.questions.filter((question) => {
      const studentAnswer = answers.find((a) => a.questionId === question.id);
      return studentAnswer?.selectedAnswer === question.correctAnswer;
    }).length;
    // Where to rewatch before trying again, and the course to continue in
    const studyTarget = await this.access.studyTarget(attempt.quiz);

    return {
      id: attempt.id,
      quizId: attempt.quiz.id,
      quizTitle: attempt.quiz.title,
      studentId: attempt.studentId,
      studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
      admissionId: attempt.student.admissionId,
      score: attempt.score,
      totalMarks: attempt.quiz.totalMarks,
      passMark: attempt.quiz.passMark,
      passed: attempt.passed,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      attachmentType: attempt.quiz.attachmentType,
      afterVideo,
      answersVisible,
      correctCount,
      courseId: studyTarget.courseId,
      studyLessonId: studyTarget.lessonId,
      questions: questionsWithAnswers,
    };
  }
}

/** Use the start time the app sends if it is plausible (not in the future, under a day old); otherwise now. */
export function plausibleStart(value?: string, now: Date = new Date()): Date {
  if (!value) return now;
  const t = new Date(value);
  const age = now.getTime() - t.getTime();
  return Number.isNaN(t.getTime()) || age < 0 || age > 24 * 60 * 60 * 1000 ? now : t;
}
