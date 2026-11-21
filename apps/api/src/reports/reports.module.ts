import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Reports Module
 * 
 * Provides attendance reporting functionality:
 * - Monthly student attendance reports
 * - Student attendance history
 * - Monthly staff attendance reports (future)
 * - Staff attendance history (future)
 */
@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
