import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

/**
 * Modules Service
 * 
 * Provides business logic for:
 * - Creating modules within courses
 * - Retrieving module details
 * - Updating module properties and display order
 * - Soft deleting modules (cascade to lessons)
 * 
 * Requirements:
 * - R17: Module management within courses
 */
@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new module within a course
   * 
   * Requirements:
   * - R17.1: Require title
   * - R17.2: Associate with parent course
   * 
   * @param courseId - Parent course ID
   * @param createModuleDto - Module data
   * @returns Created module
   */
  async create(courseId: string, createModuleDto: CreateModuleDto) {
    // Verify course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    // If displayOrder not provided, set to next available order
    let displayOrder = createModuleDto.displayOrder;
    if (displayOrder === undefined) {
      const maxOrder = await this.prisma.courseModule.aggregate({
        where: { courseId },
        _max: { displayOrder: true },
      });
      displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;
    }

    // Create module
    const module = await this.prisma.courseModule.create({
      data: {
        courseId,
        title: createModuleDto.title,
        description: createModuleDto.description,
        displayOrder,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        lessons: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return module;
  }

  /**
   * Get module by ID with lessons
   * 
   * Requirements:
   * - R17.7: Display modules ordered by display_order
   * 
   * @param id - Module ID
   * @returns Module with lessons
   */
  async findOne(id: string) {
    const module = await this.prisma.courseModule.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        lessons: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    return module;
  }

  /**
   * Update module properties
   * 
   * Requirements:
   * - R17: Support updating title, description, displayOrder
   * - R17.6: Allow reordering without changing other properties
   * 
   * @param id - Module ID
   * @param updateModuleDto - Update data
   * @returns Updated module
   */
  async update(id: string, updateModuleDto: UpdateModuleDto) {
    // Verify module exists
    const existingModule = await this.prisma.courseModule.findUnique({
      where: { id },
    });

    if (!existingModule) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    // Update module
    const module = await this.prisma.courseModule.update({
      where: { id },
      data: updateModuleDto,
      include: {
        course: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        lessons: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return module;
  }

  /**
   * Delete module (soft delete via cascade)
   * 
   * Requirements:
   * - R17.3: Cascade delete associated lessons
   * 
   * @param id - Module ID
   * @returns Deleted module
   */
  async remove(id: string) {
    // Verify module exists
    const existingModule = await this.prisma.courseModule.findUnique({
      where: { id },
      include: {
        lessons: true,
      },
    });

    if (!existingModule) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    // Delete module (cascade to lessons)
    const module = await this.prisma.courseModule.delete({
      where: { id },
    });

    return {
      message: `Module "${existingModule.title}" deleted successfully`,
      deletedModule: module,
      deletedLessonsCount: existingModule.lessons.length,
    };
  }
}
