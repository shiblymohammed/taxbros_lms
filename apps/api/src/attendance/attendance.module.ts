import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceCalculationService } from './attendance-calculation.service';
import { AttendanceController } from './attendance.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Attendance Module
 * 
 * Provides attendance marking, retrieval, and monthly calculation functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceCalculationService],
  exports: [AttendanceService, AttendanceCalculationService],
})
export class AttendanceModule {}
