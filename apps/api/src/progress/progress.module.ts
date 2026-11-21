import { Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Progress Module
 * 
 * Handles lesson progress tracking and video position management.
 * 
 * Requirements:
 * - R20: Video playback and position tracking
 * - R21: Lesson progress tracking
 * - R22: Course progress dashboard
 */
@Module({
  imports: [PrismaModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
