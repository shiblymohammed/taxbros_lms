import { Module } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Quizzes Module
 * 
 * Provides quiz and question management functionality:
 * - Quiz CRUD operations
 * - Question CRUD operations
 * - Answer masking for students
 * - Publishing workflow
 * 
 * Requirements:
 * - R23: Quiz creation and configuration
 * - R24: Quiz question management
 * - R25: Quiz access control
 */
@Module({
  imports: [PrismaModule],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService],
})
export class QuizzesModule {}
