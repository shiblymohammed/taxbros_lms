import { Module } from '@nestjs/common';
import { LabValidationService } from './lab-validation.service';
import { GstLabService } from './gst-lab.service';
import { ItrLabService } from './itr-lab.service';
import { McaLabService } from './mca-lab.service';
import { LabService } from './lab.service';
import { LabController } from './lab.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Lab Module
 * 
 * Module for government portal simulation features.
 * Provides shared validation services for GST, ITR, and MCA labs.
 * Includes REST API endpoints for lab management and submissions.
 * 
 * Requirements: R27, R28, R29, R30, R31
 * Task 53: Implement lab endpoints
 */

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LabController],
  providers: [
    LabValidationService,
    GstLabService,
    ItrLabService,
    McaLabService,
    LabService,
  ],
  exports: [
    LabValidationService,
    GstLabService,
    ItrLabService,
    McaLabService,
    LabService,
  ],
})
export class LabModule {}
