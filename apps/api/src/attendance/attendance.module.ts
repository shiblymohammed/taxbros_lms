import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceCalculationService } from './attendance-calculation.service';
import { AttendanceController } from './attendance.controller';
import { SelfAttendanceController } from './self-attendance.controller';
import { SelfAttendanceService } from './self-attendance.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Attendance Module
 * 
 * Provides attendance marking, retrieval, and monthly calculation functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [AttendanceController, SelfAttendanceController],
  providers: [AttendanceService, AttendanceCalculationService, SelfAttendanceService],
  exports: [AttendanceService, AttendanceCalculationService],
})
export class AttendanceModule {}
