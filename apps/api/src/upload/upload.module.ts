import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { CoursesModule } from '../courses/courses.module';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Upload Module
 * 
 * Handles file uploads for the application
 * 
 * Features:
 * - Course cover image upload with validation
 * - Image resizing and optimization
 * - File storage management
 * 
 * Requirements: R15 (Course cover images)
 */
@Module({
  imports: [
    MulterModule.register({
      storage: undefined, // Use memory storage for processing
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit
      },
    }),
    CoursesModule,
    PrismaModule,
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
