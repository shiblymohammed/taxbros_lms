import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Courses Module
 * 
 * Provides functionality for:
 * - Course CRUD operations (Task 26)
 * - Module management (Task 28)
 * - Lesson management (Task 29)
 * - Course enrollment (Task 30)
 * 
 * Requirements:
 * - R5: Course enrollment management
 * - R15: Course creation and management
 * - R16: Course publishing
 * - R17: Module management
 * - R18: Lesson creation
 * - R19: Lesson publishing
 * - R22: Course progress dashboard
 */
@Module({
  imports: [PrismaModule],
  controllers: [CoursesController, ModulesController, LessonsController],
  providers: [CoursesService, ModulesService, LessonsService],
  exports: [CoursesService, ModulesService, LessonsService],
})
export class CoursesModule {}
