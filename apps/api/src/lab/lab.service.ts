import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GstLabService } from './gst-lab.service';
import { ItrLabService } from './itr-lab.service';
import { McaLabService } from './mca-lab.service';
import { LabType, UserRole } from '@prisma/client';

/**
 * Lab Service
 * 
 * Main service for managing lab operations:
 * - Fetching lab information
 * - Processing lab submissions
 * - Managing lab attempts
 * - Updating sample data
 * 
 * Requirements: R27, R28, R29, R30, R31
 * Task 53: Implement lab endpoints
 */
@Injectable()
export class LabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gstLabService: GstLabService,
    private readonly itrLabService: ItrLabService,
    private readonly mcaLabService: McaLabService,
  ) {}

  /**
   * Get all labs
   * 
   * Students see only active labs, admins see all labs.
   * 
   * @param userRole - The role of the requesting user
   * @returns Array of labs
   * 
   * Requirements: R27
   */
  async getAllLabs(userRole: UserRole) {
    const where =
      userRole === UserRole.STUDENT ? { isActive: true } : undefined;

    return this.prisma.lab.findMany({
      where,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { type: 'asc' },
    });
  }

  /**
   * Get lab by type with sample data
   * 
   * @param type - The lab type
   * @param userRole - The role of the requesting user
   * @returns Lab with sample data
   * @throws NotFoundException if lab not found
   * @throws ForbiddenException if student tries to access inactive lab
   * 
   * Requirements: R27, R28, R29, R30
   */
  async getLabByType(type: LabType, userRole: UserRole) {
    const lab = await this.prisma.lab.findUnique({
      where: { type },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with type ${type} not found`);
    }

    // Students cannot access inactive labs
    if (userRole === UserRole.STUDENT && !lab.isActive) {
      throw new ForbiddenException('This lab is not currently active');
    }

    return lab;
  }

  /**
   * Submit lab attempt
   * 
   * Validates form data, generates result, and stores attempt.
   * 
   * @param type - The lab type
   * @param formData - The form data to submit
   * @param studentId - The ID of the student submitting
   * @returns Created lab attempt
   * @throws NotFoundException if lab not found
   * @throws ForbiddenException if lab is inactive
   * @throws BadRequestException if validation fails
   * 
   * Requirements: R28, R29, R30, R31
   */
  async submitLabAttempt(
    type: LabType,
    formData: any,
    studentId: string,
  ) {
    // Find the lab
    const lab = await this.prisma.lab.findUnique({
      where: { type },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with type ${type} not found`);
    }

    if (!lab.isActive) {
      throw new ForbiddenException('This lab is not currently active');
    }

    // Process submission based on lab type, normalising each lab's output
    // into the { formData, result } shape stored on LabAttempt.
    let storedFormData: any;
    let storedResult: any;

    switch (type) {
      case LabType.GST_REGISTRATION: {
        const gst = this.gstLabService.processGstSubmission(formData);
        storedFormData = gst.formData;
        storedResult = gst.result;
        break;
      }

      case LabType.INCOME_TAX_RETURN: {
        // Keep the illustrative calculation alongside the acknowledgement (R29)
        const itr = this.itrLabService.submitItrForm(formData);
        storedFormData = itr.formData;
        storedResult = { ...itr.result, calculation: itr.calculation };
        break;
      }

      case LabType.MCA_INCORPORATION: {
        // McaLabService returns the result object directly
        storedFormData = formData;
        storedResult = await this.mcaLabService.submitMcaForm(formData);
        break;
      }

      default:
        throw new BadRequestException('Invalid lab type');
    }

    // Store the attempt
    const labAttempt = await this.prisma.labAttempt.create({
      data: {
        labId: lab.id,
        studentId,
        formData: storedFormData,
        result: storedResult,
      },
      include: {
        lab: {
          select: {
            type: true,
            title: true,
          },
        },
      },
    });

    return labAttempt;
  }

  /**
   * Get lab attempts for a specific lab type
   * 
   * Students can only view their own attempts.
   * Admins can view all attempts or filter by student.
   * 
   * @param type - The lab type
   * @param userId - The ID of the requesting user
   * @param userRole - The role of the requesting user
   * @param studentId - Optional student ID filter (admin only)
   * @returns Array of lab attempts
   * @throws NotFoundException if lab not found
   * 
   * Requirements: R31
   */
  async getLabAttempts(
    type: LabType,
    userId: string,
    userRole: UserRole,
    studentId?: string,
  ) {
    // Find the lab
    const lab = await this.prisma.lab.findUnique({
      where: { type },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with type ${type} not found`);
    }

    // Build where clause
    const where: any = { labId: lab.id };

    if (userRole === UserRole.STUDENT) {
      // Students can only see their own attempts
      where.studentId = userId;
    } else if (studentId) {
      // Admins can filter by student
      where.studentId = studentId;
    }

    return this.prisma.labAttempt.findMany({
      where,
      include: {
        lab: {
          select: {
            type: true,
            title: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  /**
   * Get lab attempt by ID
   * 
   * Students can only view their own attempts.
   * Admins can view any attempt.
   * 
   * @param attemptId - The attempt ID
   * @param userId - The ID of the requesting user
   * @param userRole - The role of the requesting user
   * @returns Lab attempt details
   * @throws NotFoundException if attempt not found
   * @throws ForbiddenException if student tries to view another student's attempt
   * 
   * Requirements: R31
   */
  async getLabAttemptById(
    attemptId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const attempt = await this.prisma.labAttempt.findUnique({
      where: { id: attemptId },
      include: {
        lab: {
          select: {
            type: true,
            title: true,
            description: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Lab attempt not found');
    }

    // Students can only view their own attempts
    if (userRole === UserRole.STUDENT && attempt.studentId !== userId) {
      throw new ForbiddenException(
        'You can only view your own lab attempts',
      );
    }

    return attempt;
  }

  /**
   * Update lab sample data
   * 
   * Admin-only operation to update the sample data for a lab type.
   * 
   * @param type - The lab type
   * @param sampleData - The new sample data
   * @param updatedBy - The ID of the admin updating
   * @returns Updated lab
   * @throws NotFoundException if lab not found
   * 
   * Requirements: R27
   */
  async updateSampleData(
    type: LabType,
    sampleData: any,
    updatedBy: string,
  ) {
    const lab = await this.prisma.lab.findUnique({
      where: { type },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with type ${type} not found`);
    }

    return this.prisma.lab.update({
      where: { type },
      data: {
        sampleData,
        updatedBy, // R27.4: who changed it (updatedAt records when)
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Activate or deactivate a lab (admin only)
   *
   * Requirements: R27
   */
  async updateLabStatus(type: LabType, isActive: boolean) {
    const lab = await this.prisma.lab.findUnique({ where: { type } });

    if (!lab) {
      throw new NotFoundException(`Lab with type ${type} not found`);
    }

    return this.prisma.lab.update({
      where: { type },
      data: { isActive },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }
}
