import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { CreateQuizWithQuestionsDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QueryQuizDto } from './dto/query-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { StaffPermissionType } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

/**
 * Quizzes Controller
 * 
 * Provides endpoints for:
 * - POST /quizzes - Create quiz (admin only)
 * - GET /quizzes - List all quizzes (with filters)
 * - GET /quizzes/:id - Get quiz details (answers hidden for students)
 * - PATCH /quizzes/:id - Update quiz (admin only)
 * - DELETE /quizzes/:id - Delete quiz (admin only)
 * - POST /quizzes/:id/questions - Add question to quiz (admin only)
 * - PATCH /questions/:id - Update question (admin only)
 * - DELETE /questions/:id - Delete question (admin only)
 * 
 * Requirements:
 * - R23: Quiz creation and configuration
 * - R24: Quiz question management
 * - R25: Quiz access with answer masking
 * 
 * Access Control:
 * - POST, PATCH, DELETE: ADMINISTRATOR role required
 * - GET /quizzes: Students see only PUBLISHED quizzes
 * - GET /quizzes/:id: Students cannot see correct answers
 * - Enrollment validation for quiz access is handled in submission (Task 39)
 */
/**
 * The id quiz records use for the caller: students are identified by their Student profile
 * (QuizAttempt.studentId references Student.id), everyone else by their user id.
 */
function quizActorId(user: { userId: string; role: UserRole; studentId?: string }): string {
  if (user.role !== UserRole.STUDENT) return user.userId;
  if (!user.studentId) {
    throw new ForbiddenException('This account has no student profile');
  }
  return user.studentId;
}

@Controller('quizzes')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  /**
   * Create a new quiz
   * 
   * POST /quizzes
   * 
   * Requirements:
   * - R23.1: Create quiz with title, passMark, totalMarks
   * - R23.2: Validate attachmentType and corresponding ID
   * - R23.3: Set passMark and totalMarks
   * 
   * Access: ADMINISTRATOR only
   */
  @Post()
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createQuizDto: CreateQuizWithQuestionsDto, @Req() req: any) {
    // Check if questions are included
    if (createQuizDto.questions && createQuizDto.questions.length > 0) {
      return this.quizzesService.createWithQuestions(
        createQuizDto,
        req.user.userId,
      );
    }
    return this.quizzesService.create(createQuizDto, req.user.userId);
  }

  /**
   * Get detailed view of a single quiz attempt
   * 
   * GET /quizzes/attempts/:id
   * 
   * Requirements:
   * - R26: Quiz attempt review
   * - Task 40: Detail view with questions, answers, correct answers
   * - Task 40: Display score, passed status, submitted timestamp
   * 
   * Access:
   * - Students can only view their own attempts
   * - Admins/staff can view any attempt
   */
  @Get('attempts/:id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  getAttemptDetail(@Param('id') attemptId: string, @Req() req: any) {
    return this.quizzesService.getAttemptDetail(
      attemptId,
      quizActorId(req.user),
      req.user.role,
    );
  }

  /**
   * List all quizzes with optional filters
   * 
   * GET /quizzes?status=PUBLISHED&attachmentType=COURSE&courseId=xxx
   * 
   * Requirements:
   * - R23: Support filtering by status, attachmentType, etc.
   * - R25: Students see only PUBLISHED quizzes
   * 
   * Access:
   * - Students see only PUBLISHED quizzes
   * - Admins see all quizzes based on filter
   */
  @Get()
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  findAll(@Query() query: QueryQuizDto, @Req() req: any) {
    // Students only ever see published quizzes, without answers (R23.10, R25.2)
    // and only from courses they're enrolled in
    return this.quizzesService.findAll(query, req.user.role, req.user.studentId);
  }

  /**
   * Get single quiz with details
   * 
   * GET /quizzes/:id
   * 
   * Requirements:
   * - R24: Return quiz with questions
   * - R25: Mask correctAnswer field for students
   * - Task 38: Validate student enrollment before access
   * - Task 38: Filter by status (PUBLISHED for students)
   * 
   * Access: All authenticated users
   * Note: Students cannot see correct answers
   */
  @Get(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.quizzesService.findOne(id, quizActorId(req.user), req.user.role);
  }

  /**
   * Update quiz details
   * 
   * PATCH /quizzes/:id
   * 
   * Requirements:
   * - R23.6: Update quiz fields
   * - R23.7: Publish quiz (status → PUBLISHED)
   * 
   * Access: ADMINISTRATOR only
   */
  @Patch(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  update(@Param('id') id: string, @Body() updateQuizDto: UpdateQuizDto) {
    return this.quizzesService.update(id, updateQuizDto);
  }

  /**
   * Publish a quiz
   * 
   * PATCH /quizzes/:id/publish
   * 
   * Requirements:
   * - R23.9: Publish quiz (status → PUBLISHED)
   * 
   * Access: ADMINISTRATOR only
   */
  @Patch(':id/publish')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  publish(@Param('id') id: string) {
    return this.quizzesService.publish(id);
  }

  /**
   * Delete a quiz
   * 
   * DELETE /quizzes/:id
   * 
   * Requirements:
   * - R23: Admin can delete quizzes
   * 
   * Access: ADMINISTRATOR only
   */
  @Delete(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.quizzesService.remove(id);
  }

  /**
   * Add a question to a quiz
   * 
   * POST /quizzes/:id/questions
   * 
   * Requirements:
   * - R24.1: Create question with options
   * - R24.2: Validate correctAnswer matches option ID
   * 
   * Access: ADMINISTRATOR only
   */
  @Post(':id/questions')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.CREATED)
  addQuestion(
    @Param('id') quizId: string,
    @Body() createQuestionDto: CreateQuestionDto,
  ) {
    return this.quizzesService.addQuestion(quizId, createQuestionDto);
  }

  /**
   * Update a question
   * 
   * PATCH /questions/:id
   * 
   * Requirements:
   * - R24.4: Update question fields
   * 
   * Access: ADMINISTRATOR only
   */
  @Patch('/questions/:id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  updateQuestion(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ) {
    return this.quizzesService.updateQuestion(id, updateQuestionDto);
  }

  /**
   * Delete a question
   * 
   * DELETE /questions/:id
   * 
   * Requirements:
   * - R24: Admin can delete questions
   * 
   * Access: ADMINISTRATOR only
   */
  @Delete('/questions/:id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.OK)
  removeQuestion(@Param('id') id: string) {
    return this.quizzesService.removeQuestion(id);
  }

  /**
   * Submit quiz answers for scoring
   * 
   * POST /quizzes/:id/submit
   * 
   * Requirements:
   * - R25.3: Validate all questions have answers
   * - R25.4: Calculate score by comparing to correctAnswer
   * - R25.5: Set passed flag based on score >= passMark
   * - R25.6: Set passed flag to FALSE when score < passMark
   * - R25.9: Store answers as JSON array
   * - R25.10: Return score and passed status immediately
   * 
   * Task 39: Quiz submission and scoring endpoint
   * 
   * Access: STUDENT only
   * 
   * Response:
   * - score: Total marks earned
   * - passed: True if score >= passMark
   * - correctAnswers: Array of correct answer IDs for each question
   * - attemptId: ID of the created attempt record
   */
  @Post(':id/submit')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  submitQuiz(
    @Param('id') quizId: string,
    @Body() submitQuizDto: SubmitQuizDto,
    @Req() req: any,
  ) {
    return this.quizzesService.submitQuiz(quizId, quizActorId(req.user), submitQuizDto);
  }

  /**
   * Get all attempts for a quiz
   * 
   * GET /quizzes/:id/attempts?studentId=xxx
   * 
   * Requirements:
   * - R26: Quiz attempt history
   * - Task 40: List view of attempts
   * - Task 40: Filter by studentId for admin, own attempts for students
   * 
   * Access:
   * - Students see only their own attempts
   * - Admins/staff can see all attempts or filter by studentId
   */
  @Get(':id/attempts')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  getQuizAttempts(
    @Param('id') quizId: string,
    @Query('studentId') studentId: string | undefined,
    @Req() req: any,
  ) {
    return this.quizzesService.getQuizAttempts(
      quizId,
      quizActorId(req.user),
      req.user.role,
      studentId,
    );
  }
}
